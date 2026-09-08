import { Request, Response } from 'express';
import prisma from '../models/prismaClient';
import { whatsappService } from '../services/whatsapp.service';

export const getLeadWhatsAppHistory = async (req: Request, res: Response) => {
  try {
    const { leadId } = req.params;
    
    // Fetch all WhatsApp MessageSends for this lead
    const messages = await prisma.messageSend.findMany({
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
  } catch (error) {
    console.error('Error fetching WhatsApp history:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const sendWhatsAppMessage = async (req: Request, res: Response) => {
  try {
    const { leadId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message cannot be empty' });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: Number(leadId) }
    });

    if (!lead || (!lead.phone && !lead.phone2)) {
      return res.status(404).json({ success: false, error: 'Lead not found or has no phone number' });
    }

    const phoneToSend = lead.phone || lead.phone2 || '';
    
    // Check connection
    const status = whatsappService.getStatus();
    if (!status.connected) {
      return res.status(503).json({ success: false, error: 'WhatsApp client is not connected' });
    }

    // Call service to send
    const response = await whatsappService.sendMessage(phoneToSend, message);

    // Save to DB
    const messageSend = await prisma.messageSend.create({
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
    await prisma.engagementEvent.create({
      data: {
        messageSendId: messageSend.id,
        eventType: 'TEXT_SENT',
        metadataJson: { text: message }
      }
    });

    res.status(200).json({ success: true, data: messageSend });
  } catch (error: any) {
    console.error('Error sending WhatsApp message:', error);
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' });
  }
};
