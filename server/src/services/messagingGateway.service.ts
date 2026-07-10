import prisma from '../models/prismaClient';

export interface SendMessageOptions {
  leadId: number;
  campaignId: number;
  templateId: number;
  channel: 'EMAIL' | 'WHATSAPP' | 'SMS';
  recipient: string;
  content: string;
}

export const messagingGateway = {
  async sendMessage(options: SendMessageOptions) {

    try {
      const sentEvent = await prisma.engagementEvent.create({
        data: {
          campaignId: options.campaignId,
          leadId: options.leadId,
          channel: options.channel,
          eventType: 'SENT',
          details: `providerMessageId: mock_${options.channel.toLowerCase()}_${Date.now()}`
        }
      });

      setTimeout(async () => {
        try {
          await prisma.engagementEvent.create({
            data: {
              leadId: options.leadId,
              campaignId: options.campaignId,
              channel: options.channel,
              eventType: 'DELIVERED',
            }
          });

          if (Math.random() > 0.7) {
            await prisma.engagementEvent.create({
              data: {
                leadId: options.leadId,
                campaignId: options.campaignId,
                channel: options.channel,
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

      await prisma.engagementEvent.create({
        data: {
          campaignId: options.campaignId,
          leadId: options.leadId,
          channel: options.channel,
          eventType: 'FAILED',
          details: 'Failed to dispatch'
        }
      });
      return { success: false, error };
    }
  }
};
