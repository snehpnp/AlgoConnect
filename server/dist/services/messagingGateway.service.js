"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.messagingGateway = void 0;
const prismaClient_1 = __importDefault(require("../models/prismaClient"));
exports.messagingGateway = {
    async sendMessage(options) {
        try {
            const sentEvent = await prismaClient_1.default.engagementEvent.create({
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
                    await prismaClient_1.default.engagementEvent.create({
                        data: {
                            leadId: options.leadId,
                            campaignId: options.campaignId,
                            channel: options.channel,
                            eventType: 'DELIVERED',
                        }
                    });
                    if (Math.random() > 0.7) {
                        await prismaClient_1.default.engagementEvent.create({
                            data: {
                                leadId: options.leadId,
                                campaignId: options.campaignId,
                                channel: options.channel,
                                eventType: 'OPENED',
                            }
                        });
                    }
                }
                catch (err) {
                    console.error('[MessagingGateway Mock] Failed to simulate engagement:', err);
                }
            }, 2000);
            return { success: true, messageId: sentEvent.id };
        }
        catch (error) {
            console.error(`[MessagingGateway] Failed to send ${options.channel}:`, error);
            await prismaClient_1.default.engagementEvent.create({
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
