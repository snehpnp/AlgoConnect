"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.messagingGateway = void 0;
const prismaClient_1 = __importDefault(require("../models/prismaClient"));
const emailService_1 = require("../utils/emailService");
exports.messagingGateway = {
    async sendMessage(options) {
        const providerMessageId = `auto_${options.channel.toLowerCase()}_${Date.now()}`;
        try {
            // 1. Create the MessageSend record first so we have the ID for tracking
            const msg = await prismaClient_1.default.messageSend.create({
                data: {
                    campaignId: options.campaignId,
                    leadId: options.leadId,
                    channel: options.channel,
                    subject: options.subject || 'N/A',
                    status: 'SENT',
                    sentAt: new Date(),
                    providerMessageId
                }
            });
            let finalHtmlContent = options.htmlContent || options.content;
            // 2. Dispatch real message if channel is EMAIL
            if (options.channel === 'EMAIL') {
                const backendUrl = process.env.BACKEND_URL || 'http://localhost:7700';
                const trackingPixel = `<img src="${backendUrl}/api/track/open/${providerMessageId}" width="1" height="1" style="display:none;" alt="" />`;
                finalHtmlContent = `<div style="font-family: sans-serif; white-space: pre-wrap;">${finalHtmlContent}</div>${trackingPixel}`;
                const transporter = await (0, emailService_1.getEmailTransporter)();
                const sender = await (0, emailService_1.getEmailSenderId)();
                await transporter.sendMail({
                    from: sender,
                    to: options.recipient,
                    subject: options.subject,
                    html: finalHtmlContent
                });
            }
            else {
                // Mock SMS/Whatsapp for now
                console.log(`[Mock] Sending ${options.channel} to ${options.recipient}`);
            }
            const sentDetails = {
                recipient: options.recipient,
                subject: options.subject || null,
                htmlContent: finalHtmlContent,
                templateId: options.templateId,
            };
            // 3. Log SENT event
            const sentEvent = await prismaClient_1.default.engagementEvent.create({
                data: {
                    messageSendId: msg.id,
                    eventType: 'SENT',
                    metadataJson: sentDetails
                }
            });
            return { success: true, messageId: sentEvent.id };
        }
        catch (error) {
            console.error(`[MessagingGateway] Failed to send ${options.channel}:`, error);
            const msg = await prismaClient_1.default.messageSend.create({
                data: {
                    campaignId: options.campaignId,
                    leadId: options.leadId,
                    channel: options.channel,
                    subject: options.subject || 'N/A',
                    status: 'FAILED',
                    providerMessageId: `fail-${Date.now()}`
                }
            });
            await prismaClient_1.default.engagementEvent.create({
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
