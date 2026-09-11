import * as nodemailer from 'nodemailer';
import prisma from '../models/prismaClient';
import { AppError } from '../middlewares/errorHandler';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Core: check limit + increment counter (concurrency-safe) ─────────────────

export const checkAndIncrementEmailLimit = async () => {
  const MAX_RETRIES = 5;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    attempt++;
    try {
      const result = await prisma.$transaction(async (tx: any) => {
        // 1. Read current setting (snapshot inside transaction)
        const setting = await tx.integrationSetting.findUnique({
          where: { type: 'EMAIL' },
        });

        if (!setting) {
          throw new AppError('Email service is not configured.', 503);
        }

        const now = new Date();

        // ── Compute start-of-hour, start-of-day, and start-of-month in local time ──
        const hourStart = new Date(now);
        hourStart.setMinutes(0, 0, 0);

        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

        // ── Active limit config ──
        const limitType: string = setting.limitType || 'DAILY';
        const activeLimit: number | null =
          setting.emailLimit ?? setting.dailyLimit ?? null;

        // ── Query real-time actual sent counts directly from MessageSend database table ──
        const [sentThisHour, sentToday, sentThisMonth] = await Promise.all([
          tx.messageSend.count({
            where: { channel: 'EMAIL', sentAt: { gte: hourStart } }
          }),
          tx.messageSend.count({
            where: { channel: 'EMAIL', sentAt: { gte: todayStart } }
          }),
          tx.messageSend.count({
            where: { channel: 'EMAIL', sentAt: { gte: monthStart } }
          }),
        ]);

        // ── Enforce active limit against actual DB count ──
        if (activeLimit !== null && activeLimit > 0) {
          if (limitType === 'HOURLY' && sentThisHour >= activeLimit) {
            throw new AppError(
              `Hourly email limit of ${activeLimit} reached. Try again next hour.`,
              429
            );
          }
          if (limitType === 'DAILY' && sentToday >= activeLimit) {
            throw new AppError(
              `Daily email limit of ${activeLimit} reached. Try again tomorrow.`,
              429
            );
          }
          if (limitType === 'MONTHLY' && sentThisMonth >= activeLimit) {
            throw new AppError(
              `Monthly email limit of ${activeLimit} reached. Try again next month.`,
              429
            );
          }
        }

        // ── Update DB setting counters with real-time increment ──
        const nextHourCount = sentThisHour + 1;
        const nextTodayCount = sentToday + 1;
        const nextMonthCount = sentThisMonth + 1;

        await tx.integrationSetting.update({
          where: { type: 'EMAIL' },
          data: {
            emailsSentThisHour: nextHourCount,
            emailsSentToday: nextTodayCount,
            emailsSentThisMonth: nextMonthCount,
            lastEmailSentDate: now,
            currentPeriodStart: monthStart,
          },
        });

        return {
          ...setting,
          emailsSentThisHour: nextHourCount,
          emailsSentToday: nextTodayCount,
          emailsSentThisMonth: nextMonthCount,
        };
      });

      return result;
    } catch (err: any) {
      if (err.message === '__CONCURRENT_UPDATE__') {
        // Exponential back-off: 20ms, 40ms, 80ms …
        await new Promise(r => setTimeout(r, 20 * attempt));
        continue;
      }
      // Real error (AppError or DB error) — rethrow immediately
      throw err;
    }
  }

  throw new AppError('Too many concurrent email requests. Please try again shortly.', 429);
};

// ─── Public entry point used by ALL email-sending code ──────────────────────

export const sendEmail = async (mailOptions: nodemailer.SendMailOptions) => {
  // 1. Check + atomically increment the limit counter first
  const setting = await checkAndIncrementEmailLimit();

  if (!setting.host || !setting.apiKey || !setting.apiSecret) {
    throw new AppError('Email SMTP credentials are not configured.', 503);
  }

  // 2. Create transporter and send
  const transporter = nodemailer.createTransport({
    host: setting.host,
    port: Number(setting.port) || 587,
    secure: setting.secure === true,
    auth: { user: setting.apiKey, pass: setting.apiSecret },
  });

  return await transporter.sendMail(mailOptions);
};
