import prisma from '../models/prismaClient';
import { sendEmail, getEmailSenderId } from '../utils/emailService';
import { SocketService } from './socket.service';

export interface SendMessageOptions {
  leadId: number;
  campaignId?: number;
  templateId?: number;
  channel: 'EMAIL' | 'WHATSAPP' | 'SMS';
  recipient: string;
  content: string;      // plain/HTML body
  subject?: string;     // email subject
  htmlContent?: string; // full rendered HTML (optional, fallback to content)
  attachments?: any[];  // file attachments array
  messageSendId?: number; // pass existing ID if retrying a PENDING message
}

export const messagingGateway = {
  async sendMessage(options: SendMessageOptions) {

    const providerMessageId = `auto_${options.channel.toLowerCase()}_${Date.now()}`;
    let msgId: number | null = options.messageSendId || null;

    try {
      // 1. Create or Update the MessageSend record first so we have the ID for tracking
      if (msgId) {
        await prisma.messageSend.update({
          where: { id: msgId },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            providerMessageId
          }
        });
      } else {
        const msg = await prisma.messageSend.create({
          data: {
            ...(options.campaignId ? { campaignId: options.campaignId } : {}),
            leadId: options.leadId,
            channel: options.channel,
            subject: options.subject || null,
            templateId: options.templateId,
            status: 'SENT',
            sentAt: new Date(),
            providerMessageId
          }
        });
        msgId = msg.id;
      }

      // Save the actual content sent so it can be viewed in history
      await prisma.engagementEvent.create({
        data: {
          messageSendId: msgId,
          eventType: 'SENT',
          metadataJson: { text: options.content }
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
              messageSendId: msgId,
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

        const sender = await getEmailSenderId();
        await sendEmail({
          from: sender,
          to: options.recipient,
          subject: options.subject,
          html: finalHtmlContent,
          messageId: `${providerMessageId}@algoconnect.local`,
          attachments: options.attachments || []
        });
        
        // Notify user about automated send if triggered by campaign
        if (options.campaignId && lead && lead.userId) {
          const notif = await prisma.notification.create({
            data: {
              userId: lead.userId,
              title: 'Automated Email Sent',
              message: `Email "${options.subject}" was sent to ${lead.name}.`,
              type: 'EMAIL_SENT',
              relatedEntityId: msgId,
              relatedEntity: 'MessageSend'
            }
          });
          SocketService.sendToUser(lead.userId, 'new_notification', notif);
        }
      } else if (options.channel === 'WHATSAPP') {
        const { whatsappService } = require('./whatsapp.service');
        const response = await whatsappService.sendMessage(options.recipient, options.content);
        
        if (options.campaignId && lead && lead.userId) {
          const notif = await prisma.notification.create({
            data: {
              userId: lead.userId,
              title: 'Automated WhatsApp Sent',
              message: `WhatsApp message was sent to ${lead.name}.`,
              type: 'SYSTEM',
              relatedEntityId: msgId,
              relatedEntity: 'MessageSend'
            }
          });
          SocketService.sendToUser(lead.userId, 'new_notification', notif);
        }
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
          messageSendId: msgId,
          eventType: 'SENT',
          metadataJson: sentDetails
        }
      });

      return { success: true, messageId: sentEvent.id };

    } catch (error: any) {
      console.error(`[MessagingGateway] Failed to send ${options.channel}:`, error);

      const isLimitError = error.statusCode === 429 || (error.message && error.message.toLowerCase().includes('limit'));
      const finalStatus = isLimitError ? 'PENDING' : 'FAILED';

      if (msgId) {
        await prisma.messageSend.update({
          where: { id: msgId },
          data: {
            status: finalStatus,
            providerMessageId: isLimitError ? undefined : `fail-${Date.now()}`
          }
        });

        await prisma.engagementEvent.create({
          data: {
            messageSendId: msgId,
            eventType: isLimitError ? 'LIMIT_REACHED' : 'FAILED',
            metadataJson: { error: error.message || 'Failed to dispatch' }
          }
        });
      }

      // If it's a limit error, throw it so the campaign runner can catch it and abort the batch
      if (isLimitError) {
        throw error;
      }

      return { success: false, error };
    }
  }
};
