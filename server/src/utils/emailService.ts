import * as nodemailer from 'nodemailer';
import prisma from '../models/prismaClient';
import { AppError } from '../middlewares/errorHandler';

export const getEmailTransporter = async () => {
  const setting = await (prisma as any).integrationSetting.findUnique({
    where: { type: 'EMAIL' },
  });
  if (!setting || !setting.host || !setting.apiKey || !setting.apiSecret) {
    throw new AppError('Email service is not configured. Contact your admin.', 503);
  }
  return nodemailer.createTransport({
    host: setting.host,
    port: Number(setting.port) || 587,
    secure: setting.secure === true,
    auth: { user: setting.apiKey, pass: setting.apiSecret },
  });
};

export const getEmailSenderId = async (): Promise<string> => {
  const setting = await (prisma as any).integrationSetting.findUnique({
    where: { type: 'EMAIL' },
  });
  return setting?.senderId || 'noreply@algoconnect.com';
};
