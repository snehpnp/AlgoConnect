import { PrismaClient } from '@prisma/client';
import { SocketService } from './socket.service';

const prisma = new PrismaClient();

type ESPEventType = 'OPENED' | 'CLICKED' | 'DELIVERED' | 'BOUNCED' | 'SPAM' | 'UNSUBSCRIBED' | 'REPLIED' | 'FAILED';

export class EmailTrackingService {
  
  /**
   * Main entry point for processing incoming webhook events from the Email Service Provider.
   * This uses a transaction to ensure idempotency and atomic updates.
   */
  async processProviderWebhook(
    providerMessageId: string, 
    eventType: ESPEventType, 
    providerPayload: any, 
    metadataJson?: any
  ) {
    // We use a robust transaction to ensure we don't process duplicate webhooks concurrently
    return await prisma.$transaction(async (tx) => {
      // 1. Find the corresponding MessageSend record
      const messageSend = await tx.messageSend.findUnique({
        where: { providerMessageId },
        include: { lead: true }
      });

      if (!messageSend) {
        console.warn(`[Webhook] No MessageSend found for providerMessageId: ${providerMessageId}`);
        return null;
      }

      // 2. Idempotency Check: Did we already process THIS exact event type for THIS message?
      // Some events like OPENED or CLICKED can happen multiple times, but we still log them all.
      // However, if the provider sends the EXACT SAME payload due to a retry, we might want to deduplicate based on a payload ID.
      // For simplicity in this demo, we'll allow multiple opens/clicks, but DELIVERED/BOUNCED should be once.
      
      const singleOccurenceEvents = ['DELIVERED', 'BOUNCED', 'SPAM', 'FAILED'];
      if (singleOccurenceEvents.includes(eventType)) {
        const existing = await tx.engagementEvent.findFirst({
          where: { messageSendId: messageSend.id, eventType }
        });
        if (existing) {
          console.log(`[Webhook] Idempotency: Event ${eventType} already recorded for message ${messageSend.id}`);
          return existing; // Already processed
        }
      }

      // 3. Create the generic EngagementEvent record
      const event = await tx.engagementEvent.create({
        data: {
          messageSendId: messageSend.id,
          eventType,
          providerPayload: providerPayload || {},
          metadataJson: metadataJson || {}
        }
      });

      // 4. Update the MessageSend state machine and timestamps
      const updateData: any = {};
      const now = new Date();

      switch (eventType) {
        case 'DELIVERED':
          if (!messageSend.deliveredAt) updateData.deliveredAt = now;
          if (messageSend.status === 'QUEUED' || messageSend.status === 'SENT') updateData.status = 'DELIVERED';
          break;
        case 'OPENED':
          if (!messageSend.openedAt) updateData.openedAt = now;
          if (['QUEUED', 'SENT', 'DELIVERED'].includes(messageSend.status)) updateData.status = 'OPENED';
          break;
        case 'CLICKED':
          if (!messageSend.clickedAt) updateData.clickedAt = now;
          if (['QUEUED', 'SENT', 'DELIVERED', 'OPENED'].includes(messageSend.status)) updateData.status = 'CLICKED';
          break;
        case 'REPLIED':
          if (!messageSend.repliedAt) updateData.repliedAt = now;
          updateData.status = 'REPLIED'; // Replied is the highest status
          break;
        case 'FAILED':
        case 'BOUNCED':
        case 'SPAM':
          if (!messageSend.bouncedAt) updateData.bouncedAt = now;
          updateData.status = eventType === 'SPAM' ? 'BOUNCED' : eventType;
          break;
      }

      if (Object.keys(updateData).length > 0) {
        await tx.messageSend.update({
          where: { id: messageSend.id },
          data: updateData
        });
      }

      // 5. Update Lead Timeline (ActivityLog)
      // This ensures the generic Lead 360 view sees this event easily.
      await tx.activityLog.create({
        data: {
          leadId: messageSend.leadId,
          action: `EMAIL_${eventType}`,
          details: `Email subject: "${messageSend.subject || 'Unknown'}" was ${eventType.toLowerCase()}.`,
        }
      });

      // 6. Update Lead engagementStatus
      let newLeadStatus = '';
      if (eventType === 'OPENED') newLeadStatus = 'Opened';
      else if (eventType === 'CLICKED') newLeadStatus = 'Clicked';
      else if (eventType === 'REPLIED') newLeadStatus = 'Replied';
      
      if (newLeadStatus) {
        const lead = await tx.lead.findUnique({ where: { id: messageSend.leadId } });
        // Only upgrade status (Replied > Clicked > Opened > Sent)
        const statusHierarchy: Record<string, number> = {
          'Not Engaged': 0, 'Sent': 1, 'Delivered': 2, 'Opened': 3, 'Clicked': 4, 'Demo Requested': 5, 'Replied': 6
        };
        const currentRank = statusHierarchy[lead?.engagementStatus || 'Not Engaged'] || 0;
        const newRank = statusHierarchy[newLeadStatus] || 0;

        if (newRank > currentRank) {
          await tx.lead.update({
            where: { id: messageSend.leadId },
            data: { engagementStatus: newLeadStatus }
          });
        }
      }

      // 7. Real-time Notification
      if (['OPENED', 'CLICKED', 'REPLIED'].includes(eventType) && messageSend.lead.userId) {
        let title = '';
        if (eventType === 'OPENED') title = 'Email Opened';
        if (eventType === 'CLICKED') title = 'Email Clicked';
        if (eventType === 'REPLIED') title = 'Email Replied';
        
        const notif = await tx.notification.create({
          data: {
            userId: messageSend.lead.userId,
            title,
            message: `${messageSend.lead.name} ${eventType.toLowerCase()} the email "${messageSend.subject}".`,
            type: `EMAIL_${eventType}`,
            relatedEntityId: messageSend.leadId,
            relatedEntity: 'Lead'
          }
        });
        
        SocketService.sendToUser(messageSend.lead.userId, 'new_notification', notif);
      }

      return event;
    });
  }

  /**
   * Tracks a link click specifically (e.g., from a rewritten tracking URL)
   */
  async trackLinkClick(trackingUrl: string, reqInfo: any) {
    const linkRecord = await prisma.emailLinkTracking.findUnique({
      where: { trackingUrl }
    });

    if (!linkRecord) return null;

    // Update the link tracking record
    await prisma.emailLinkTracking.update({
      where: { id: linkRecord.id },
      data: {
        clicked: true,
        clickedAt: new Date(),
        ipAddress: reqInfo.ip,
        device: reqInfo.device,
        browser: reqInfo.browser,
        country: reqInfo.country
      }
    });

    // Also trigger the general CLICKED event on the message
    const message = await prisma.messageSend.findUnique({ where: { id: linkRecord.messageSendId } });
    if (message && message.providerMessageId) {
      await this.processProviderWebhook(message.providerMessageId, 'CLICKED', {}, { url: linkRecord.originalUrl });
    }

    return linkRecord.originalUrl;
  }
}

export const emailTrackingService = new EmailTrackingService();
