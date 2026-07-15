import prisma from '../models/prismaClient';

export interface SendMessageOptions {
  leadId: number;
  campaignId: number;
  templateId: number;
  channel: 'EMAIL' | 'WHATSAPP' | 'SMS';
  recipient: string;
  content: string;      // plain/HTML body
  subject?: string;     // email subject
  htmlContent?: string; // full rendered HTML (optional, fallback to content)
}

export const messagingGateway = {
  async sendMessage(options: SendMessageOptions) {

    try {
      const sentDetails = {
        recipient: options.recipient,
        subject: options.subject || null,
        htmlContent: options.htmlContent || options.content,
        templateId: options.templateId,
      };

      const msg = await prisma.messageSend.create({
        data: {
          campaignId: options.campaignId,
          leadId: options.leadId,
          channel: options.channel,
          subject: options.subject || 'N/A',
          status: 'SENT',
          sentAt: new Date(),
          providerMessageId: `mock_${options.channel.toLowerCase()}_${Date.now()}`
        }
      });

      const sentEvent = await prisma.engagementEvent.create({
        data: {
          messageSendId: msg.id,
          eventType: 'SENT',
          metadataJson: sentDetails
        }
      });

      setTimeout(async () => {
        try {
          await prisma.messageSend.update({
            where: { id: msg.id },
            data: { status: 'DELIVERED', deliveredAt: new Date() }
          });
          await prisma.engagementEvent.create({
            data: {
              messageSendId: msg.id,
              eventType: 'DELIVERED',
            }
          });

          if (Math.random() > 0.7) {
            await prisma.messageSend.update({
              where: { id: msg.id },
              data: { status: 'OPENED', openedAt: new Date() }
            });
            await prisma.engagementEvent.create({
              data: {
                messageSendId: msg.id,
                eventType: 'OPENED',
              }
            });
          }
        } catch (err) {
          console.error('[MessagingGateway Mock] Failed to simulate engagement:', err);
        }
      }, 2000);

      return { success: true, messageId: sentEvent.id };
    } catch (error) {
      console.error(`[MessagingGateway] Failed to send ${options.channel}:`, error);

      const msg = await prisma.messageSend.create({
        data: {
          campaignId: options.campaignId,
          leadId: options.leadId,
          channel: options.channel,
          subject: options.subject || 'N/A',
          status: 'FAILED',
          providerMessageId: `mock-fail-${Date.now()}`
        }
      });
      await prisma.engagementEvent.create({
        data: {
          messageSendId: msg.id,
          eventType: 'FAILED',
          metadataJson: { error: 'Failed to dispatch' }
        }
      });
      return { success: false, error };
    }
  }
};
