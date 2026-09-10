"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWhatsAppMessage = exports.getLeadWhatsAppHistory = void 0;
const prismaClient_1 = __importDefault(require("../models/prismaClient"));
const whatsapp_service_1 = require("../services/whatsapp.service");
const getLeadWhatsAppHistory = async (req, res) => {
    try {
        const { leadId } = req.params;
        // Fetch all WhatsApp MessageSends for this lead
        const messages = await prismaClient_1.default.messageSend.findMany({
            where: {
                leadId: Number(leadId),
                channel: 'WHATSAPP'
            },
            include: {
                events: {
                    orderBy: { eventTime: 'asc' }
                }
            },
            orderBy: { createdAt: 'asc' }
        });
        res.status(200).json({ success: true, data: messages });
    }
    catch (error) {
        console.error('Error fetching WhatsApp history:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
exports.getLeadWhatsAppHistory = getLeadWhatsAppHistory;
const sendWhatsAppMessage = async (req, res) => {
    try {
        const { leadId } = req.params;
        const { message, media } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, error: 'Message cannot be empty' });
        }
        const lead = await prismaClient_1.default.lead.findUnique({
            where: { id: Number(leadId) }
        });
        if (!lead || (!lead.phone && !lead.phone2)) {
            return res.status(404).json({ success: false, error: 'Lead not found or has no phone number' });
        }
        const phoneToSend = lead.phone || lead.phone2 || '';
        // Check connection
        const status = whatsapp_service_1.whatsappService.getStatus();
        if (!status.connected) {
            return res.status(503).json({ success: false, error: 'WhatsApp client is not connected' });
        }
        // Call service to send
        const response = await whatsapp_service_1.whatsappService.sendMessage(phoneToSend, message, media?.path);
        // Save to DB
        const messageSend = await prismaClient_1.default.messageSend.create({
            data: {
                leadId: lead.id,
                channel: 'WHATSAPP',
                subject: 'Outgoing WhatsApp Message',
                status: 'SENT',
                sentAt: new Date(),
                providerMessageId: response?.id?._serialized || `wa-out-${Date.now()}`
            }
        });
        // Create a dummy event for the text sent, so we can unified render if needed
        // Or we just rely on the MessageSend object for sent messages.
        // In our UI, if eventType is missing, it's a sent message.
        await prismaClient_1.default.engagementEvent.create({
            data: {
                messageSendId: messageSend.id,
                eventType: 'TEXT_SENT',
                metadataJson: {
                    text: message,
                    mediaUrl: media?.url || null,
                    mediaType: media?.mimetype || null
                }
            }
        });
        res.status(200).json({ success: true, data: messageSend });
    }
    catch (error) {
        console.error('Error sending WhatsApp message:', error);
        res.status(500).json({ success: false, error: error?.message || 'Internal server error' });
    }
};
exports.sendWhatsAppMessage = sendWhatsAppMessage;
