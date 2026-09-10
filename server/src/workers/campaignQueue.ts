import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../utils/redis';
import prisma from '../models/prismaClient';
import { messagingGateway } from '../services/messagingGateway.service';

export const CAMPAIGN_QUEUE_NAME = 'campaign_message_queue';

// Define the Queue
export const campaignQueue = new Queue(CAMPAIGN_QUEUE_NAME, {
  connection: redisConnection,
});

// Define the Worker
export const campaignWorker = new Worker(
  CAMPAIGN_QUEUE_NAME,
  async (job: Job) => {
    const { messageSendId, leadId, channel, content, subject, templateId, recipient } = job.data;

    try {
      console.log(`[BullMQ Worker] Processing messageSendId: ${messageSendId} for lead: ${leadId}`);

      // Actual sending logic
      const result = await messagingGateway.sendMessage({
        leadId,
        channel,
        recipient,
        content,
        htmlContent: content,
        subject: subject || 'Message from AlgoConnect',
        templateId
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      // Update the message status to SENT
      await prisma.messageSend.update({
        where: { id: messageSendId },
        data: {
          status: 'SENT',
          providerMessageId: result.messageId,
          sentAt: new Date(),
        },
      });

      console.log(`[BullMQ Worker] Success: messageSendId: ${messageSendId}`);
      return result;
    } catch (error: any) {
      console.error(`[BullMQ Worker] Failed to send messageSendId: ${messageSendId}`, error);

      // Mark as FAILED in DB
      await prisma.messageSend.update({
        where: { id: messageSendId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
        },
      });

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5, // Process 5 emails concurrently
    limiter: {
      max: 10, // Max 10 jobs per second (Rate Limit)
      duration: 1000,
    }
  }
);

campaignWorker.on('completed', (job) => {
  // console.log(`Job with id ${job.id} has been completed`);
});

campaignWorker.on('failed', (job, err) => {
  console.error(`Job with id ${job?.id} has failed with ${err.message}`);
});
