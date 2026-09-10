import cron from 'node-cron';
import prisma from '../models/prismaClient';
import { checkIMAPReplies } from './imap.service';
import { messagingGateway } from './messagingGateway.service';
import { getEmailPriorityRank, isValidEmail } from '../controllers/campaign.controller';

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
  // Run IMAP checker every 1 minute
  cron.schedule('*/1 * * * *', async () => {
    if (!isEngineRunning) return;
    await checkIMAPReplies();
  });

  // Run campaign processor every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
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

        // Priority Sort Leads: 1) Valid @gmail.com, 2) Other valid emails, 3) Invalid/empty emails last
        campaign.leads.sort((a, b) => {
          const emailA = a.email || a.scrapedEmail;
          const emailB = b.email || b.scrapedEmail;
          const rankA = getEmailPriorityRank(emailA);
          const rankB = getEmailPriorityRank(emailB);
          if (rankA !== rankB) return rankA - rankB;
          return (emailA || '').toLowerCase().localeCompare((emailB || '').toLowerCase());
        });

        let processedCount = 0;
        let limitReached = false;

        for (const lead of campaign.leads) {
          if (processedCount >= BATCH_LIMIT || limitReached) break;

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

            if (existingSend && existingSend.status !== 'PENDING') {
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
              recipient = lead.email || lead.scrapedEmail || '';

              // Email validation check
              if (!isValidEmail(recipient)) {
                if (existingSend) {
                  await prisma.messageSend.update({
                    where: { id: existingSend.id },
                    data: { status: 'BOUNCED' }
                  });
                  await prisma.engagementEvent.create({
                    data: {
                      messageSendId: existingSend.id,
                      eventType: 'BOUNCED',
                      metadataJson: { error: 'INVALID_OR_EMPTY_EMAIL', recipient },
                    }
                  });
                } else {
                  const msg = await prisma.messageSend.create({
                    data: {
                      campaignId: campaign.id,
                      leadId: lead.id,
                      channel: channel,
                      subject: 'Bounced - Invalid or Empty Email',
                      status: 'BOUNCED',
                      providerMessageId: `bounce-invalid-${Date.now()}`
                    }
                  });
                  await prisma.engagementEvent.create({
                    data: {
                      messageSendId: msg.id,
                      eventType: 'BOUNCED',
                      metadataJson: { error: 'INVALID_OR_EMPTY_EMAIL', recipient },
                    }
                  });
                }
                continue;
              }
            } else if (channel === 'WHATSAPP') {
              template = campaign.whatsappTemplate;
              recipient = lead.phone || lead.scrapedPhone || '';
            } else if (channel === 'SMS') {
              template = campaign.smsTemplate;
              recipient = lead.phone || lead.scrapedPhone || '';
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

            let attachments = [];
            if (template.designJson && typeof template.designJson === 'object' && (template.designJson as any).attachments) {
              attachments = (template.designJson as any).attachments.map((att: any) => {
                // If url is /uploads/123.jpg, we resolve it to the full path
                return {
                  filename: att.filename,
                  path: require('path').join(process.cwd(), att.url)
                };
              });
            }

            // Dispatch
            try {
              await messagingGateway.sendMessage({
                campaignId: campaign.id,
                leadId: lead.id,
                templateId: template.id,
                channel: channel as any,
                recipient,
                content: renderedContent,
                subject: renderedSubject,
                htmlContent: renderedContent,
                attachments,
                messageSendId: existingSend?.id
              });
            } catch (error: any) {
              if (error.statusCode === 429 || (error.message && error.message.toLowerCase().includes('limit'))) {
                console.log(`[CampaignRunner] Limit reached for ${channel}. Aborting campaign batch.`);
                limitReached = true;
                break; // Break the channel loop, outer loop will also break due to limitReached
              }
            }

            processedCount++;
          }
        }
      }
    } catch (error) {
      console.error('[CampaignRunner] Error running campaign job:', error);
    }
  });

};
