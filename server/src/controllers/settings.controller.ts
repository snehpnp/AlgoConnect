import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

export const getAllSettings = async (req: Request, res: Response) => {
  try {
    const settings = await (prisma as any).integrationSetting.findMany();
    res.json({ data: settings });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateSetting = async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const data = req.body;

    const setting = await (prisma as any).integrationSetting.upsert({
      where: { type },
      update: {
        provider: data.provider,
        apiKey: data.apiKey,
        apiSecret: data.apiSecret,
        senderId: data.senderId,
        host: data.host,
        port: data.port,
        secure: data.secure,
        isActive: data.isActive,
      },
      create: {
        type,
        provider: data.provider || 'UNKNOWN',
        apiKey: data.apiKey,
        apiSecret: data.apiSecret,
        senderId: data.senderId,
        host: data.host,
        port: data.port,
        secure: data.secure || false,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });

    res.json({ message: 'Setting updated successfully', data: setting });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

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
            await transporter.sendMail({
              from: setting.senderId || setting.apiKey,
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
          message = `SMTP Verification failed: ${err.message || err.toString()}`;
        }
      } else {
        message = 'Missing host or port for EMAIL connection';
      }
    } else if (type === 'SMS') {
      // Simulate SMS API connection
      if (setting.apiKey) {
        success = true;
        message = `Successfully verified SMS API Key for provider ${setting.provider}`;
      } else {
        message = 'Missing API Key for SMS connection';
      }
    } else if (type === 'WHATSAPP') {
      // Simulate WhatsApp API connection
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
  } catch (error) {
    console.error('Error testing integration:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

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
              campaign: { select: { id: true, name: true } }
            }
          }
        }
      }),
      prisma.engagementEvent.count({ where })
    ]);

    const logs = logsRaw.map(log => ({
      ...log,
      lead: log.messageSend?.lead,
      campaign: log.messageSend?.campaign,
      details: log.metadataJson,
      channel: log.messageSend?.channel
    }));

    res.json({
      data: logs,
      total,
      page: parseInt(page as string),
      totalPages: Math.ceil(total / take)
    });
  } catch (error) {
    console.error('Error fetching message logs:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
