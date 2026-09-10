import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import { checkAndIncrementEmailLimit } from '../utils/emailService';

const prisma = new PrismaClient();

// ─── GET /settings/integrations ──────────────────────────────────────────────
export const getAllSettings = async (req: Request, res: Response) => {
  try {
    const settings = await (prisma as any).integrationSetting.findMany();
    res.json({ data: settings });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── PUT /settings/integrations/:type ────────────────────────────────────────
export const updateSetting = async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const data = req.body;
    const user = (req as any).user; // injected by auth middleware

    // Parse and validate emailLimit
    const parseLimit = (val: any): number | null => {
      if (val === '' || val === null || val === undefined) return null;
      const n = parseInt(String(val), 10);
      return isNaN(n) ? null : n;
    };

    const newLimitType: string = data.limitType || 'DAILY';
    // Support both `emailLimit` (new) and `dailyLimit` (old field from UI)
    const newEmailLimit: number | null = parseLimit(data.emailLimit ?? data.dailyLimit);

    // ── Fetch current record for audit comparison ──
    const existing = await (prisma as any).integrationSetting.findUnique({
      where: { type },
    });

    const setting = await (prisma as any).integrationSetting.upsert({
      where: { type },
      update: {
        provider: data.provider,
        apiKey: data.apiKey,
        apiSecret: data.apiSecret,
        senderId: data.senderId,
        host: data.host,
        port: data.port !== undefined ? Number(data.port) : undefined,
        secure: data.secure,
        isActive: data.isActive,
        limitType: newLimitType,
        emailLimit: newEmailLimit,
        // keep dailyLimit in sync for backward-compat
        dailyLimit: newLimitType === 'DAILY' ? newEmailLimit : null,
      },
      create: {
        type,
        provider: data.provider || 'UNKNOWN',
        apiKey: data.apiKey,
        apiSecret: data.apiSecret,
        senderId: data.senderId,
        host: data.host,
        port: data.port ? Number(data.port) : null,
        secure: data.secure || false,
        isActive: data.isActive !== undefined ? data.isActive : true,
        limitType: newLimitType,
        emailLimit: newEmailLimit,
        dailyLimit: newLimitType === 'DAILY' ? newEmailLimit : null,
      },
    });

    // ── Create audit log if EMAIL limit config changed ──
    if (type === 'EMAIL') {
      const prevLimitType = existing?.limitType ?? 'DAILY';
      const prevLimit = existing?.emailLimit ?? existing?.dailyLimit ?? null;
      const limitChanged =
        prevLimitType !== newLimitType || prevLimit !== newEmailLimit;

      if (limitChanged) {
        await (prisma as any).emailLimitAuditLog.create({
          data: {
            changedByUserId: user?.id ?? null,
            changedByName: user?.name ?? 'System',
            prevLimitType,
            newLimitType,
            prevLimit,
            newLimit: newEmailLimit,
            reason: data.reason ?? null,
          },
        });
      }
    }

    res.json({ message: 'Setting updated successfully', data: setting });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── POST /settings/integrations/:type/test ──────────────────────────────────
export const testIntegration = async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    let setting = req.body;

    // If no body provided, fallback to DB
    if (!setting || Object.keys(setting).length === 0) {
      setting = await (prisma as any).integrationSetting.findUnique({
        where: { type },
      });
    }

    if (!setting) {
      return res.status(404).json({ message: `Configuration for ${type} not found` });
    }

    let success = false;
    let message = '';

    if (type === 'EMAIL') {
      if (setting.host && setting.port) {
        try {
          const transporter = nodemailer.createTransport({
            host: setting.host,
            port: Number(setting.port),
            secure: setting.secure === true || setting.secure === 'true',
            auth: {
              user: setting.apiKey,
              pass: setting.apiSecret,
            },
          });

          if (setting.testEmail) {
            // Test email IS counted toward the limit — it is a real send
            await checkAndIncrementEmailLimit();
            await transporter.sendMail({
              from: `"Deepmind Infotech" <` + (setting.senderId || setting.apiKey) + `>`,
              to: setting.testEmail,
              subject: 'AlgoConnect: SMTP Test Connection Successful',
              text: 'Congratulations! Your SMTP email integration is configured correctly in AlgoConnect.',
              html: '<p>Congratulations!</p><p>Your SMTP email integration is configured correctly in AlgoConnect.</p>',
            });
            success = true;
            message = `Successfully sent test email to ${setting.testEmail}`;
          } else {
            await transporter.verify();
            success = true;
            message = `Successfully connected to SMTP server ${setting.host}:${setting.port}`;
          }
        } catch (err: any) {
          success = false;
          message = err.message?.includes('limit')
            ? err.message
            : `SMTP Verification failed: ${err.message || err.toString()}`;
        }
      } else {
        message = 'Missing host or port for EMAIL connection';
      }
    } else if (type === 'SMS') {
      if (setting.apiKey) {
        success = true;
        message = `Successfully verified SMS API Key for provider ${setting.provider}`;
      } else {
        message = 'Missing API Key for SMS connection';
      }
    } else if (type === 'WHATSAPP') {
      if (setting.apiKey) {
        success = true;
        message = `Successfully authenticated with WhatsApp API`;
      } else {
        message = 'Missing API Key / Access Token for WhatsApp connection';
      }
    }

    if (success) {
      res.json({ success: true, message });
    } else {
      res.status(400).json({ success: false, message });
    }
  } catch (error: any) {
    console.error('Error testing integration:', error);
    if (error.statusCode === 429) {
      return res.status(429).json({ success: false, message: error.message });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── GET /settings/message-logs ──────────────────────────────────────────────
export const getMessageLogs = async (req: Request, res: Response) => {
  try {
    const { channel, status, dateFrom, dateTo, page = '1', limit = '50' } = req.query;

    const where: any = {};

    if (channel && channel !== 'ALL') {
      where.messageSend = { channel: channel as string };
    }

    if (status && status !== 'ALL') {
      if (status === 'REPLIED') {
        where.eventType = { in: ['REPLY', 'REPLIED'] };
      } else {
        where.eventType = status as string;
      }
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom as string);
      if (dateTo) {
        const to = new Date(dateTo as string);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [logsRaw, total] = await Promise.all([
      prisma.engagementEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          messageSend: {
            include: {
              lead: { select: { id: true, name: true, email: true, phone: true } },
              campaign: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.engagementEvent.count({ where }),
    ]);

    const logs = logsRaw.map(log => ({
      ...log,
      lead: log.messageSend?.lead,
      campaign: log.messageSend?.campaign,
      details: log.metadataJson,
      channel: log.messageSend?.channel,
    }));

    res.json({
      data: logs,
      total,
      page: parseInt(page as string),
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    console.error('Error fetching message logs:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── GET /settings/email-limit-logs ──────────────────────────────────────────
export const getEmailLimitLogs = async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [logs, total] = await Promise.all([
      (prisma as any).emailLimitAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      (prisma as any).emailLimitAuditLog.count(),
    ]);

    res.json({ data: logs, total, page: parseInt(page as string), totalPages: Math.ceil(total / take) });
  } catch (error) {
    console.error('Error fetching email limit logs:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
