import { Client, LocalAuth } from 'whatsapp-web.js';
import * as qrcode from 'qrcode';
import prisma from '../models/prismaClient';

class WhatsAppService {
  private client: Client;
  private qrCodeDataUrl: string | null = null;
  private isConnected: boolean = false;

  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: './whatsapp-auth'
      }),

      puppeteer: {
        headless: true,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      },
    });

    this.setupListeners();
  }

  private setupListeners() {
    this.client.on('qr', async (qr) => {
      try {
        this.qrCodeDataUrl = await qrcode.toDataURL(qr);
        console.log('[WhatsApp] New QR code generated');
      } catch (err) {
        console.error('[WhatsApp] Failed to generate QR code', err);
      }
    });

    this.client.on('ready', () => {
      console.log('[WhatsApp] Client is ready!');
      this.isConnected = true;
      this.qrCodeDataUrl = null;
    });

    this.client.on('authenticated', () => {
      console.log('[WhatsApp] Authenticated successfully');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('[WhatsApp] Authentication failure', msg);
      this.isConnected = false;
      this.qrCodeDataUrl = null;
    });

    this.client.on('disconnected', (reason) => {
      console.log('[WhatsApp] Client was disconnected', reason);
      this.isConnected = false;
      this.qrCodeDataUrl = null;
    });

    this.client.on('message', async (message) => {
      await this.handleIncomingMessage(message);
    });
  }

  public async initialize() {
    console.log('[WhatsApp] Initializing client...');

    try {
      await this.client.initialize();
    } catch (error) {
      console.error('[WhatsApp] Failed to initialize client:', error);
      this.isConnected = false;
      throw error;
    }
  }

  public getStatus() {
    return {
      connected: this.isConnected,
      qrCode: this.qrCodeDataUrl,
    };
  }

  public async logout() {
    try {
      if (this.isConnected) {
        await this.client.logout();
      }

      this.isConnected = false;
      this.qrCodeDataUrl = null;

      await this.client.initialize();
    } catch (error) {
      console.error('[WhatsApp] Logout failed:', error);
      throw error;
    }
  }

  public async sendMessage(phoneNumber: string, text: string) {
    if (!this.isConnected) {
      throw new Error('WhatsApp client is not connected');
    }

    const formattedNumber = phoneNumber.replace(/[^0-9]/g, '');

    let finalNumber = formattedNumber;

    if (finalNumber.length === 10) {
      finalNumber = '91' + finalNumber;
    }

    const chatId = `${finalNumber}@c.us`;

    try {
      const response = await this.client.sendMessage(chatId, text);

      return response;
    } catch (error) {
      console.error(
        `[WhatsApp] Failed to send message to ${phoneNumber}`,
        error
      );

      throw error;
    }
  }

  private async handleIncomingMessage(message: any) {
    try {
      if (message.isGroupMsg) {
        return;
      }

      const from = message.from;
      const text = message.body;
      const phoneNumber = from.split('@')[0];

      console.log(
        `[WhatsApp] Received message from ${phoneNumber}: ${text}`
      );

      const leads = await prisma.lead.findMany({
        where: {
          OR: [
            {
              phone: {
                contains: phoneNumber,
              },
            },
            {
              phone: {
                contains: phoneNumber.substring(2),
              },
            },
          ],
        },
      });

      if (leads.length === 0) {
        console.log(
          `[WhatsApp] No lead found matching phone ${phoneNumber}`
        );

        return;
      }

      const lead = leads[0];

      const msgRecord = await prisma.messageSend.create({
        data: {
          leadId: lead.id,
          channel: 'WHATSAPP',
          subject: 'Incoming WhatsApp Reply',
          status: 'DELIVERED',
          providerMessageId:
            message.id.id || `wa-in-${Date.now()}`,
          sentAt: new Date(),
        },
      });

      await prisma.engagementEvent.create({
        data: {
          messageSendId: msgRecord.id,
          eventType: 'REPLY',
          metadataJson: {
            text,
            rawMessage: message,
          },
        },
      });

      await prisma.lead.update({
        where: {
          id: lead.id,
        },
        data: {
          engagementStatus: 'Replied',
        },
      });

      console.log(
        `[WhatsApp] Logged reply for lead ${lead.id}`
      );
    } catch (error) {
      console.error(
        '[WhatsApp] Error handling incoming message:',
        error
      );
    }
  }
}

export const whatsappService = new WhatsAppService();