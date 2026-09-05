"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pollImapForReplies = void 0;
const imap = __importStar(require("imap-simple"));
const mailparser_1 = require("mailparser");
const prismaClient_1 = __importDefault(require("../models/prismaClient"));
const pollImapForReplies = async () => {
    try {
        const setting = await prismaClient_1.default.integrationSetting.findUnique({
            where: { type: 'EMAIL' },
        });
        if (!setting || !setting.host || !setting.apiKey || !setting.apiSecret) {
            console.log('[IMAP Listener] Email service not configured.');
            return;
        }
        // Attempt to guess IMAP host if they provided SMTP (e.g., smtp.gmail.com -> imap.gmail.com)
        let imapHost = setting.host;
        if (imapHost.startsWith('smtp.')) {
            imapHost = imapHost.replace('smtp.', 'imap.');
        }
        const config = {
            imap: {
                user: setting.apiKey,
                password: setting.apiSecret,
                host: imapHost,
                port: 993, // Standard IMAP SSL port
                tls: true,
                authTimeout: 10000,
                tlsOptions: { rejectUnauthorized: false }
            }
        };
        const connection = await imap.connect(config);
        await connection.openBox('INBOX');
        // Fetch unseen messages
        const searchCriteria = ['UNSEEN'];
        const fetchOptions = { bodies: ['HEADER', 'TEXT'], struct: true };
        const messages = await connection.search(searchCriteria, fetchOptions);
        for (const msg of messages) {
            const allParts = imap.getParts(msg.attributes.struct);
            let bodyData = '';
            const parts = msg.parts || [];
            for (const part of parts) {
                if (part.which === 'TEXT') {
                    bodyData = part.body;
                }
                else if (part.which !== 'HEADER') {
                    bodyData = part.body;
                }
            }
            const headerPart = parts.find(p => p.which === 'HEADER');
            const headerStr = headerPart ? headerPart.body : '';
            const parsed = await (0, mailparser_1.simpleParser)(headerStr + '\r\n\r\n' + bodyData);
            const fromAddress = parsed.from?.value[0]?.address?.toLowerCase() || '';
            // Check if it's a bounce report
            if (fromAddress.includes('mailer-daemon') || fromAddress.includes('postmaster') || parsed.subject?.toLowerCase().includes('delivery status') || parsed.subject?.toLowerCase().includes('undeliverable') || parsed.subject?.toLowerCase().includes('failure')) {
                const bodyText = parsed.text || '';
                // Try to find the original message ID in the bounce text
                const match = bodyText.match(/(auto_email_\d+)/);
                if (match) {
                    const providerMessageId = match[1];
                    const messageSend = await prismaClient_1.default.messageSend.findFirst({
                        where: { providerMessageId: providerMessageId }
                    });
                    if (messageSend && messageSend.status !== 'BOUNCED') {
                        await prismaClient_1.default.engagementEvent.create({
                            data: {
                                messageSendId: messageSend.id,
                                eventType: 'BOUNCED',
                                metadataJson: { error: 'Delivery Status Notification via IMAP' }
                            }
                        });
                        await prismaClient_1.default.messageSend.update({
                            where: { id: messageSend.id },
                            data: { status: 'BOUNCED', bouncedAt: new Date() }
                        });
                        console.log(`[IMAP Listener] Processed bounce for message ${providerMessageId}`);
                    }
                }
            }
            else {
                // Look for In-Reply-To or References
                let replyToId = parsed.inReplyTo || (parsed.references && parsed.references[0]);
                if (replyToId) {
                    // Strip < > if present
                    replyToId = replyToId.replace(/^<|>$/g, '');
                    // Remove the domain part to get our providerMessageId
                    const providerMessageId = replyToId.split('@')[0];
                    const messageSend = await prismaClient_1.default.messageSend.findFirst({
                        where: { providerMessageId: providerMessageId }
                    });
                    if (messageSend) {
                        // Check if reply already exists to avoid duplicates
                        const existingReply = await prismaClient_1.default.emailReply.findFirst({
                            where: { messageSendId: messageSend.id, fromEmail: parsed.from?.value[0]?.address || '' }
                        });
                        if (!existingReply) {
                            const emailReply = await prismaClient_1.default.emailReply.create({
                                data: {
                                    messageSendId: messageSend.id,
                                    leadId: messageSend.leadId,
                                    fromEmail: parsed.from?.value[0]?.address || 'unknown',
                                    subject: parsed.subject || '',
                                    body: parsed.text || parsed.html || 'No content',
                                    receivedAt: parsed.date || new Date(),
                                    providerMessageId: parsed.messageId
                                }
                            });
                            await prismaClient_1.default.engagementEvent.create({
                                data: {
                                    messageSendId: messageSend.id,
                                    eventType: 'REPLY',
                                    metadataJson: { replyId: emailReply.id }
                                }
                            });
                            await prismaClient_1.default.messageSend.update({
                                where: { id: messageSend.id },
                                data: { status: 'REPLIED', repliedAt: new Date() }
                            });
                            console.log(`[IMAP Listener] Processed reply for message ${providerMessageId}`);
                        }
                    }
                }
            }
            // Mark message as seen
            await connection.addFlags(msg.attributes.uid, ['\\Seen']);
        }
        connection.end();
    }
    catch (error) {
        console.error('[IMAP Listener] Error:', error);
    }
};
exports.pollImapForReplies = pollImapForReplies;
