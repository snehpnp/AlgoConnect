import { Client, LocalAuth } from 'whatsapp-web.js';
import * as qrcode from 'qrcode';
import prisma from '../models/prismaClient';

class WhatsAppService {
  private client: Client;
  private qrCodeDataUrl: string | null = null;
  private isConnected: boolean = false;
  private accountInfo: { name: string; number: string; pushname: string } | null = null;

  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: './whatsapp-auth' }),
      puppeteer: {
        headless: true,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
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

    this.client.on('ready', async () => {
      console.log('[WhatsApp] Client is ready and connected!');
      this.isConnected = true;
      this.qrCodeDataUrl = null;
      try {
        const info = this.client.info;
        this.accountInfo = {
          name: info?.pushname || 'Unknown',
          number: info?.wid?.user || '',
          pushname: info?.pushname || ''
        };
        console.log(`[WhatsApp] Account: ${this.accountInfo.name} (+${this.accountInfo.number})`);
      } catch (e) {
        this.accountInfo = null;
      }
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
      console.log('[WhatsApp] Client disconnected:', reason);
      this.isConnected = false;
      this.qrCodeDataUrl = null;
      this.accountInfo = null;
    });

    // Only message_create, filter out sent messages
    this.client.on('message_create', async (message) => {
      if (message.fromMe) return;
      await this.handleIncomingMessage(message);
    });
  }

  // Non-blocking initialize — server won't crash if WhatsApp fails
  public initialize() {
    console.log('[WhatsApp] Starting client initialization...');
    this.client.initialize().catch((err) => {
      console.error('[WhatsApp] Initialization error (non-fatal):', err?.message || err);
    });
  }

  public getStatus() {
    return { connected: this.isConnected, qrCode: this.qrCodeDataUrl, account: this.accountInfo };
  }

  public async logout() {
    try {
      if (this.isConnected) await this.client.logout();
      this.isConnected = false;
      this.qrCodeDataUrl = null;
      this.client.initialize().catch(() => {});
    } catch (error) {
      console.error('[WhatsApp] Logout failed:', error);
      throw error;
    }
  }

  public async sendMessage(phoneNumber: string, text: string) {
    if (!this.isConnected) throw new Error('WhatsApp client is not connected');

    let num = phoneNumber.replace(/\D/g, '');
    if (num.length === 10) num = '91' + num;
    const chatId = `${num}@c.us`;

    try {
      return await this.client.sendMessage(chatId, text);
    } catch (error) {
      console.error(`[WhatsApp] Failed to send to ${phoneNumber}:`, error);
      throw error;
    }
  }

  private extractPhone(message: any): string {
    const fromId: string = message.from || '';

    // Standard format: 919876543210@c.us
    if (fromId.includes('@c.us')) {
      return fromId.split('@')[0].replace(/\D/g, '');
    }

    // @lid format — try multiple contact fields
    if (fromId.includes('@lid')) {
      try {
        // message._data.notifyName is sometimes available
        // Try getting from id.user directly
        if (message.id?.remote?.includes('@c.us')) {
          return message.id.remote.split('@')[0].replace(/\D/g, '');
        }
        // Try author field (for group-like scenarios)
        if (message.author?.includes('@c.us')) {
          return message.author.split('@')[0].replace(/\D/g, '');
        }
      } catch (_) {}
    }

    // Fallback: strip non-digits from whatever we have
    return fromId.split('@')[0].replace(/\D/g, '');
  }

  private async handleIncomingMessage(message: any) {
    try {
      const fromId: string = message.from || '';

      // Skip groups, status, broadcasts
      if (fromId.includes('@g.us')) return;
      if (fromId === 'status@broadcast') return;
      if (!message.body) return;

      const text: string = message.body;

      // Try to get real phone number
      let digitsOnly = this.extractPhone(message);

      // If still @lid format, try getContact() as last resort
      if (fromId.includes('@lid') && (digitsOnly.length > 13 || digitsOnly.length < 10)) {
        try {
          const contact = await message.getContact();
          // Try contact.id.user (more reliable than contact.number)
          const contactUser = contact?.id?.user || contact?.number || '';
          const resolved = contactUser.replace(/\D/g, '');
          if (resolved && resolved.length >= 10 && resolved.length <= 13) {
            digitsOnly = resolved;
          }
          console.log(`[WhatsApp] getContact resolved: ${resolved}, pushname: ${contact?.pushname}`);
        } catch (e) {
          console.error('[WhatsApp] getContact failed:', e);
        }
      }

      if (!digitsOnly || digitsOnly.length < 10) {
        console.log(`[WhatsApp] Could not get valid phone from message. from=${fromId}`);
        return;
      }

      // Last 10 digits for matching
      const last10 = digitsOnly.slice(-10);
      console.log(`[WhatsApp] Incoming reply: "${text}" | phone digits: ${digitsOnly} | last10: ${last10}`);

      // Dedup check using message ID
      const providerMsgId = message.id?.id || `wa-in-${Date.now()}-${Math.random()}`;
      const existing = await prisma.messageSend.findUnique({ where: { providerMessageId: providerMsgId } });
      if (existing) {
        console.log(`[WhatsApp] Already saved message ${providerMsgId}, skipping.`);
        return;
      }

      // Fetch all leads with phone and match using JS includes
      const allLeads = await prisma.lead.findMany({
        select: { id: true, phone: true, phone2: true, name: true },
        where: { NOT: { phone: null } },
      });

      const matchedLead = allLeads.find((l) => {
        const p1 = (l.phone || '').replace(/\D/g, '');
        const p2 = (l.phone2 || '').replace(/\D/g, '');
        const p1last10 = p1.slice(-10);
        const p2last10 = p2.slice(-10);
        // Exact last-10 match only (safer than two-way includes to avoid false positives)
        return p1last10 === last10 || (p2 && p2last10 === last10);
      });

      if (!matchedLead) {
        console.log(`[WhatsApp] No lead matched last10=${last10}. Leads checked: ${allLeads.length}`);
        return;
      }

      console.log(`[WhatsApp] ✅ Matched lead: "${matchedLead.name}" (id=${matchedLead.id})`);

      // Find the most recent message sent to this lead via WHATSAPP
      let lastMessage = await prisma.messageSend.findFirst({
        where: {
          leadId: matchedLead.id,
          channel: 'WHATSAPP',
        },
        orderBy: { createdAt: 'desc' }
      });

      // If no previous message exists to attach the reply to, create a dummy one
      if (!lastMessage) {
        lastMessage = await prisma.messageSend.create({
          data: {
            leadId: matchedLead.id,
            channel: 'WHATSAPP',
            subject: 'Incoming WhatsApp Reply',
            status: 'RECEIVED',
            providerMessageId: providerMsgId,
            sentAt: new Date(),
          },
        });
      }

      await prisma.engagementEvent.create({
        data: {
          messageSendId: lastMessage.id,
          eventType: 'REPLY',
          metadataJson: { text },
        },
      });

      await prisma.lead.update({
        where: { id: matchedLead.id },
        data: { engagementStatus: 'Replied' },
      });

      console.log(`[WhatsApp] ✅ Reply saved for lead "${matchedLead.name}" (id=${matchedLead.id})`);
    } catch (error) {
      console.error('[WhatsApp] Error handling incoming message:', error);
    }
  }
}

export const whatsappService = new WhatsAppService();