"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.messagingGateway = void 0;
const prismaClient_1 = __importDefault(require("../models/prismaClient"));
const emailService_1 = require("../utils/emailService");
const socket_service_1 = require("./socket.service");
exports.messagingGateway = {
    async sendMessage(options) {
        const providerMessageId = `auto_${options.channel.toLowerCase()}_${Date.now()}`;
        try {
            // 1. Create the MessageSend record first so we have the ID for tracking
            const msg = await prismaClient_1.default.messageSend.create({
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
            const lead = await prismaClient_1.default.lead.findUnique({ where: { id: options.leadId } });
            if (lead && lead.engagementStatus === 'Not Engaged') {
                await prismaClient_1.default.lead.update({
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
                    if (originalUrl.startsWith('mailto:') || originalUrl.startsWith('tel:') || originalUrl.startsWith('#'))
                        continue;
                    // Create tracking string
                    const trackingUrlId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                    await prismaClient_1.default.emailLinkTracking.create({
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
                const transporter = await (0, emailService_1.getEmailTransporter)();
                const sender = await (0, emailService_1.getEmailSenderId)();
                await transporter.sendMail({
                    from: sender,
                    to: options.recipient,
                    subject: options.subject,
                    html: finalHtmlContent,
                    messageId: `${providerMessageId}@algoconnect.local`,
                    attachments: options.attachments || []
                });
                // Notify user about automated send if triggered by campaign
                if (options.campaignId && lead && lead.userId) {
                    const notif = await prismaClient_1.default.notification.create({
                        data: {
                            userId: lead.userId,
                            title: 'Automated Email Sent',
                            message: `Email "${options.subject}" was sent to ${lead.name}.`,
                            type: 'EMAIL_SENT',
                            relatedEntityId: msg.id,
                            relatedEntity: 'MessageSend'
                        }
                    });
                    socket_service_1.SocketService.sendToUser(lead.userId, 'new_notification', notif);
                }
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
                    ...(options.campaignId ? { campaignId: options.campaignId } : {}),
                    leadId: options.leadId,
                    channel: options.channel,
                    subject: options.subject || 'N/A',
                    templateId: options.templateId,
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
