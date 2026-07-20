import prisma from '../models/prismaClient';
import { getEmailTransporter, getEmailSenderId } from '../utils/emailService';

export interface SendMessageOptions {
  leadId: number;
  campaignId?: number;
  templateId?: number;
  channel: 'EMAIL' | 'WHATSAPP' | 'SMS';
  recipient: string;
  content: string;      // plain/HTML body
  subject?: string;     // email subject
  htmlContent?: string; // full rendered HTML (optional, fallback to content)
}

export const messagingGateway = {
  async sendMessage(options: SendMessageOptions) {

    const providerMessageId = `auto_${options.channel.toLowerCase()}_${Date.now()}`;

    try {
      // 1. Create the MessageSend record first so we have the ID for tracking
      const msg = await prisma.messageSend.create({
        data: {
          ...(options.campaignId ? { campaignId: options.campaignId } : {}),
          leadId: options.leadId,
          channel: options.channel,
          subject: options.subject || 'N/A',
          templateId: options.templateId,
          status: 'SENT',
          sentAt: new Date(),
          providerMessageId
        }
      });

      // Update Lead engagementStatus if it's currently 'Not Engaged'
      const lead = await prisma.lead.findUnique({ where: { id: options.leadId } });
      if (lead && lead.engagementStatus === 'Not Engaged') {
        await prisma.lead.update({
          where: { id: options.leadId },
          data: { engagementStatus: 'Sent' }
        });
      }

      let finalHtmlContent = options.htmlContent || options.content;

      // 2. Dispatch real message if channel is EMAIL
      if (options.channel === 'EMAIL') {
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:7700';
        
        // Rewrite links for click tracking
        const hrefRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"/gi;
        let match;
        let modifiedHtmlContent = finalHtmlContent;

        while ((match = hrefRegex.exec(finalHtmlContent)) !== null) {
          const originalUrl = match[1];
          if (originalUrl.startsWith('mailto:') || originalUrl.startsWith('tel:') || originalUrl.startsWith('#')) continue;

          // Create tracking string
          const trackingUrlId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
          
          await prisma.emailLinkTracking.create({
            data: {
              messageSendId: msg.id,
              originalUrl: originalUrl,
              trackingUrl: trackingUrlId
            }
          });
          
          const newUrl = `${backendUrl}/api/track/click/${trackingUrlId}`;
          modifiedHtmlContent = modifiedHtmlContent.replace(`href="${originalUrl}"`, `href="${newUrl}"`);
        }
        finalHtmlContent = modifiedHtmlContent;

        const trackingPixel = `<img src="${backendUrl}/api/track/open/${providerMessageId}" width="1" height="1" style="display:none;" alt="" />`;

        finalHtmlContent = `<div style="font-family: sans-serif;">${finalHtmlContent}</div>${trackingPixel}`;

        const transporter = await getEmailTransporter();
        const sender = await getEmailSenderId();
        await transporter.sendMail({
          from: sender,
          to: options.recipient,
          subject: options.subject,
          html: finalHtmlContent,
          messageId: `${providerMessageId}@algoconnect.local`
        });
      }

      const sentDetails = {
        recipient: options.recipient,
        subject: options.subject || null,
        htmlContent: finalHtmlContent,
        templateId: options.templateId,
      };

      // 3. Log SENT event
      const sentEvent = await prisma.engagementEvent.create({
        data: {
          messageSendId: msg.id,
          eventType: 'SENT',
          metadataJson: sentDetails
        }
      });

      return { success: true, messageId: sentEvent.id };

    } catch (error: any) {
      console.error(`[MessagingGateway] Failed to send ${options.channel}:`, error);

      const msg = await prisma.messageSend.create({
        data: {
          ...(options.campaignId ? { campaignId: options.campaignId } : {}),
          leadId: options.leadId,
          channel: options.channel,
          subject: options.subject || 'N/A',
          templateId: options.templateId,
          status: 'FAILED',
          providerMessageId: `fail-${Date.now()}`
        }
      });
      await prisma.engagementEvent.create({
        data: {
          messageSendId: msg.id,
          eventType: 'FAILED',
          metadataJson: { error: error.message || 'Failed to dispatch' }
        }
      });
      return { success: false, error };
    }
  }
};
