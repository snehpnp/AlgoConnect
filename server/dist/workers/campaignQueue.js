"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.campaignWorker = exports.campaignQueue = exports.CAMPAIGN_QUEUE_NAME = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../utils/redis");
const prismaClient_1 = __importDefault(require("../models/prismaClient"));
const messagingGateway_service_1 = require("../services/messagingGateway.service");
exports.CAMPAIGN_QUEUE_NAME = 'campaign_message_queue';
// Define the Queue
exports.campaignQueue = new bullmq_1.Queue(exports.CAMPAIGN_QUEUE_NAME, {
    connection: redis_1.redisConnection,
});
// Define the Worker
exports.campaignWorker = new bullmq_1.Worker(exports.CAMPAIGN_QUEUE_NAME, async (job) => {
    const { messageSendId, leadId, channel, content, subject, templateId, recipient } = job.data;
    try {
        console.log(`[BullMQ Worker] Processing messageSendId: ${messageSendId} for lead: ${leadId}`);
        // Actual sending logic
        const result = await messagingGateway_service_1.messagingGateway.sendMessage({
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
        await prismaClient_1.default.messageSend.update({
            where: { id: messageSendId },
            data: {
                status: 'SENT',
                providerMessageId: result.messageId ? String(result.messageId) : undefined,
                sentAt: new Date(),
            },
        });
        console.log(`[BullMQ Worker] Success: messageSendId: ${messageSendId}`);
        return result;
    }
    catch (error) {
        console.error(`[BullMQ Worker] Failed to send messageSendId: ${messageSendId}`, error);
        // Mark as FAILED in DB
        await prismaClient_1.default.messageSend.update({
            where: { id: messageSendId },
            data: {
                status: 'FAILED',
                failedAt: new Date(),
            },
        });
        throw error;
    }
}, {
    connection: redis_1.redisConnection,
    concurrency: 5, // Process 5 emails concurrently
    limiter: {
        max: 10, // Max 10 jobs per second (Rate Limit)
        duration: 1000,
    }
});
exports.campaignWorker.on('completed', (job) => {
    // console.log(`Job with id ${job.id} has been completed`);
});
exports.campaignWorker.on('failed', (job, err) => {
    console.error(`Job with id ${job?.id} has failed with ${err.message}`);
});
