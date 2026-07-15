import cron from 'node-cron';
import prisma from '../models/prismaClient';
import { messagingGateway } from './messagingGateway.service';

const BATCH_LIMIT = 50; // Max leads processed per minute per campaign

let isEngineRunning = true;

export const toggleEngine = (state: boolean) => {
  isEngineRunning = state;
  return isEngineRunning;
};

export const getEngineState = () => {
  return isEngineRunning;
};

export const startCampaignRunner = () => {
  // Run every 10 minute 
  cron.schedule('*/10 10-17 * * *', async () => {
    if (!isEngineRunning) {
      return;
    }

    try {

      const activeCampaigns = await prisma.campaign.findMany({
        where: { status: 'ACTIVE' },
        include: {
          leads: true,
          emailTemplate: true,
          whatsappTemplate: true,
          smsTemplate: true
        }
      });

      if (activeCampaigns.length === 0) {
        return;
      }


      for (const campaign of activeCampaigns) {
        const channels = campaign.channels as string[] || [];
        if (channels.length === 0) continue;

        let processedCount = 0;

        for (const lead of campaign.leads) {
          if (processedCount >= BATCH_LIMIT) break;

          // Global suppression check
          if (lead.consentStatus === 'OPT_OUT') {
            continue;
          }

          // Check each channel
          for (const channel of channels) {
            // Check if already sent in this campaign
            const existingSend = await prisma.messageSend.findFirst({
              where: {
                campaignId: campaign.id,
                leadId: lead.id,
                channel: channel,
              }
            });

            if (existingSend) {
              continue; // Already processed this channel for this lead
            }

            // Check Consent for this channel
            const consent = await prisma.consent.findFirst({
              where: { leadId: lead.id, channel }
            });

            if (consent && consent.status === 'OPT_OUT') {
              // Log that it was skipped due to consent
              const msg = await prisma.messageSend.create({
                data: {
                  campaignId: campaign.id,
                  leadId: lead.id,
                  channel: channel,
                  subject: 'Skipped - Opt Out',
                  status: 'FAILED',
                  providerMessageId: `skip-optout-${Date.now()}`
                }
              });
              await prisma.engagementEvent.create({
                data: {
                  messageSendId: msg.id,
                  eventType: 'FAILED',
                  metadataJson: { error: 'SKIPPED_OPT_OUT' },
                }
              });
              continue;
            }

            // Resolve Template
            let template = null;
            let recipient = '';

            if (channel === 'EMAIL') {
              template = campaign.emailTemplate;
              recipient = lead.email || '';
            } else if (channel === 'WHATSAPP') {
              template = campaign.whatsappTemplate;
              recipient = lead.phone || '';
            } else if (channel === 'SMS') {
              template = campaign.smsTemplate;
              recipient = lead.phone || '';
            }

            if (!template || !recipient) {
              // Missing template or contact info
              const msg = await prisma.messageSend.create({
                data: {
                  campaignId: campaign.id,
                  leadId: lead.id,
                  channel: channel,
                  subject: 'Skipped - Missing Info',
                  status: 'FAILED',
                  providerMessageId: `skip-missing-${Date.now()}`
                }
              });
              await prisma.engagementEvent.create({
                data: {
                  messageSendId: msg.id,
                  eventType: 'FAILED',
                  metadataJson: { error: 'SKIPPED_MISSING_INFO' },
                }
              });
              continue;
            }

            // Parse Merge Tags
            const renderedContent = template.content
              .replace(/{{name}}/g, lead.name || '')
              .replace(/{{contact_name}}/g, lead.contactPerson || lead.name || '')
              .replace(/{{company}}/g, lead.name || '');

            const renderedSubject = (template.subject || '')
              .replace(/{{name}}/g, lead.name || '')
              .replace(/{{company}}/g, lead.name || '');

            // Dispatch
            await messagingGateway.sendMessage({
              campaignId: campaign.id,
              leadId: lead.id,
              templateId: template.id,
              channel: channel as any,
              recipient,
              content: renderedContent,
              subject: renderedSubject,
              htmlContent: renderedContent,
            });

            processedCount++;
          }
        }
      }
    } catch (error) {
      console.error('[CampaignRunner] Error running campaign job:', error);
    }
  });

};
