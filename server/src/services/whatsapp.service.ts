import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import * as qrcode from 'qrcode';
import prisma from '../models/prismaClient';
import { SocketService } from './socket.service';
import os from 'os';

// Extracts just the message from any thrown value, no stack trace, no puppeteer noise
function getErrorMessage(err: any): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err.message) return String(err.message).split('\n')[0]; // first line only
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

class WhatsAppService {
  private client: Client;
  private qrCodeDataUrl: string | null = null;
  private isConnected: boolean = false;
  private accountInfo: { name: string; number: string; pushname: string } | null = null;

  constructor() {
    const isWindows = os.platform() === 'win32';

    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: './whatsapp-auth' }),
      puppeteer: {
        headless: true,
        executablePath: isWindows
          ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
          : '/usr/bin/google-chrome-stable',
        protocolTimeout: 300000,
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

      } catch (err) {
        console.error('[WhatsApp] Failed to generate QR code:', getErrorMessage(err));
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
          pushname: info?.pushname || '',
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
      console.error('[WhatsApp] Authentication failure:', msg);
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
      console.error('[WhatsApp] Initialization error (non-fatal):', getErrorMessage(err));
    });
  }

  public getStatus() {
    return {
      connected: this.isConnected,
      qrCode: this.qrCodeDataUrl,
      account: this.accountInfo,
    };
  }

  public async logout() {
    try {
      if (this.isConnected) await this.client.logout();
      this.isConnected = false;
      this.qrCodeDataUrl = null;
      this.client.initialize().catch(() => { });
    } catch (error) {
      console.error('[WhatsApp] Logout failed:', getErrorMessage(error));
      throw error;
    }
  }

  public async sendMessage(phoneNumber: string, text: string, mediaPath?: string) {
    if (!this.isConnected) throw new Error('WhatsApp client is not connected');

    let num = phoneNumber.replace(/\D/g, '');
    if (num.length === 10) num = '91' + num;
    const chatId = `${num}@c.us`;
    let contentToSend: any = text;
    let options: any = {};

    try {

      if (mediaPath) {
        contentToSend = MessageMedia.fromFilePath(mediaPath);
        if (text) {
          options.caption = text;
        }
      }

      return await this.client.sendMessage(chatId, contentToSend, options);
    } catch (error: any) {
      const errMsg = error?.message || '';

      // LID / chat table related error → retry with getChat
      if (
        errMsg.includes('Lid is missing') ||
        errMsg.includes('Failed to find row in chat table') ||
        errMsg.includes('No LID for user')
      ) {
        console.log(`[WhatsApp] LID issue for ${chatId}, trying getChat + retry...`);

        try {
          await this.client.getChatById(chatId);
          await new Promise((r) => setTimeout(r, 2000)); // 2 sec wait
          return await this.client.sendMessage(chatId, contentToSend, options);
        } catch (retryError) {
          console.error(`[WhatsApp] Retry also failed for ${phoneNumber}:`, getErrorMessage(retryError));
          throw new Error(getErrorMessage(retryError));
        }
      }

      console.error(`[WhatsApp] Failed to send to ${phoneNumber}:`, getErrorMessage(error));
      throw new Error(getErrorMessage(error));
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
        if (message.id?.remote?.includes('@c.us')) {
          return message.id.remote.split('@')[0].replace(/\D/g, '');
        }
        if (message.author?.includes('@c.us')) {
          return message.author.split('@')[0].replace(/\D/g, '');
        }
      } catch (_) { }
    }

    // Fallback: strip non-digits from whatever we have
    return fromId.split('@')[0].replace(/\D/g, '');
  }

  private async downloadMediaWithRetry(message: any, retries = 3, delayMs = 1500) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const media = await message.downloadMedia();
        if (media) return media;
        // media undefined but no throw — treat as retryable
      } catch (err: any) {
        console.error(`[WhatsApp] downloadMedia attempt ${attempt} failed:`, getErrorMessage(err));
        if (attempt === retries) return null; // don't throw, just give up quietly
      }
      await new Promise((r) => setTimeout(r, delayMs * attempt)); // backoff
    }
    return null;
  }

  private async handleIncomingMessage(message: any) {
    try {
      const fromId: string = message.from || '';

      // Skip groups, status, broadcasts
      if (fromId.includes('@g.us')) return;
      if (fromId === 'status@broadcast') return;
      let mediaUrl = null;
      let mediaType = null;

      if (message.hasMedia) {
        if (message.isViewOnce) {
          console.log('[WhatsApp] View-once media — cannot be downloaded, skipping');
        } else {
          try {
            const media = await this.downloadMediaWithRetry(message);
            if (media) {
              let ext = 'bin';
              if (media.mimetype) {
                const mimeParts = media.mimetype.split(';')[0].split('/');
                if (mimeParts.length === 2) ext = mimeParts[1];
              }
              const filename = `wa-in-${Date.now()}.${ext}`;
              const uploadDir = require('path').join(process.cwd(), 'uploads', 'whatsapp');
              if (!require('fs').existsSync(uploadDir)) {
                require('fs').mkdirSync(uploadDir, { recursive: true });
              }
              const filePath = require('path').join(uploadDir, filename);
              require('fs').writeFileSync(filePath, media.data, 'base64');
              mediaUrl = `/uploads/whatsapp/${filename}`;
              mediaType = media.mimetype;
            } else {
              console.log('[WhatsApp] Media download unavailable, continuing as text-only');
            }
          } catch (mediaErr) {
            console.log('[WhatsApp] Failed to download media:', getErrorMessage(mediaErr));
            // Fall through — still save the reply as text-only so the lead isn't lost
          }
        }
      }

      const text: string = message.body || (message.hasMedia ? '[Media Message]' : '');
      if (!text && !mediaUrl) return;

      // Try to get real phone number
      let digitsOnly = this.extractPhone(message);

      // If still @lid format, try getContact() as last resort
      if (fromId.includes('@lid') && (digitsOnly.length > 13 || digitsOnly.length < 10)) {
        try {
          const contact = await message.getContact();
          const contactUser = contact?.id?.user || contact?.number || '';
          const resolved = contactUser.replace(/\D/g, '');
          if (resolved && resolved.length >= 10 && resolved.length <= 13) {
            digitsOnly = resolved;
          }
          console.log(`[WhatsApp] getContact resolved: ${resolved}, pushname: ${contact?.pushname}`);
        } catch (e) {
          console.error('[WhatsApp] getContact failed:', getErrorMessage(e));
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
      const existing = await prisma.messageSend.findUnique({
        where: { providerMessageId: providerMsgId },
      });
      if (existing) {
        console.log(`[WhatsApp] Already saved message ${providerMsgId}, skipping.`);
        return;
      }

      // Fetch all leads with phone and match using last 10 digits
      const allLeads = await prisma.lead.findMany({
        select: { id: true, phone: true, phone2: true, name: true },
        where: { NOT: { phone: null } },
      });

      const matchedLead = allLeads.find((l) => {
        const p1 = (l.phone || '').replace(/\D/g, '');
        const p2 = (l.phone2 || '').replace(/\D/g, '');
        const p1last10 = p1.slice(-10);
        const p2last10 = p2.slice(-10);
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
        orderBy: { createdAt: 'desc' },
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
          metadataJson: { text, mediaUrl, mediaType },
        },
      });

      await prisma.lead.update({
        where: { id: matchedLead.id },
        data: { engagementStatus: 'Replied' },
      });

      // Broadcast new reply to frontend for real-time updates (Chat UI + Toast)
      SocketService.broadcast('new_reply', {
        leadId: matchedLead.id,
        channel: 'WHATSAPP',
        text: text,
        timestamp: new Date().toISOString()
      });

      // Save as system Notification so it appears in the Bell icon
      const usersToNotify = await prisma.user.findMany({ where: { role: { name: 'SUPERADMIN' } } });
      for (const u of usersToNotify) {
        const notif = await prisma.notification.create({
          data: {
            userId: u.id,
            title: `WhatsApp Reply: ${matchedLead.name}`,
            message: text && text.length > 60 ? text.substring(0, 60) + '...' : text,
            type: 'WHATSAPP_REPLY',
            relatedEntityId: matchedLead.id,
            relatedEntity: 'Lead'
          }
        });
        // Emit to update the Bell icon
        SocketService.sendToUser(u.id, 'new_notification', notif);
      }

      console.log(`[WhatsApp] ✅ Reply saved for lead "${matchedLead.name}" (id=${matchedLead.id})`);
    } catch (error) {
      console.error('[WhatsApp] Error handling incoming message:', getErrorMessage(error));
    }
  }
}

export const whatsappService = new WhatsAppService();