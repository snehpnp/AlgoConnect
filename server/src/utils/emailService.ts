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

        // ── Compute start-of-day and start-of-month in local time ──
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

        // ── Active limit config ──
        // Support both old `dailyLimit` field and new `emailLimit` field.
        // If `emailLimit` is explicitly set, prefer it; otherwise fall back to `dailyLimit`.
        const limitType: string = setting.limitType || 'DAILY';
        const activeLimit: number | null =
          setting.emailLimit ?? setting.dailyLimit ?? null;

        // ── Determine current counters, resetting stale periods ──
        let sentToday: number = setting.emailsSentToday || 0;
        let sentThisMonth: number = setting.emailsSentThisMonth || 0;

        const lastSent: Date | null = setting.lastEmailSentDate
          ? new Date(setting.lastEmailSentDate)
          : null;
        const periodStart: Date | null = setting.currentPeriodStart
          ? new Date(setting.currentPeriodStart)
          : null;

        // Reset daily counter if we're in a new day
        const needsDayReset = !lastSent || lastSent < todayStart;
        if (needsDayReset) sentToday = 0;

        // Reset monthly counter if we're in a new calendar month
        const needsMonthReset = !periodStart || periodStart < monthStart;
        if (needsMonthReset) sentThisMonth = 0;

        // ── Enforce the active limit ──
        if (activeLimit !== null && activeLimit > 0) {
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

        // ── Atomic optimistic update using updateMany with condition ──
        // We match on both counters so a concurrent transaction that already
        // incremented will cause count === 0, triggering a retry.
        const updated = await tx.integrationSetting.updateMany({
          where: {
            type: 'EMAIL',
            emailsSentToday: setting.emailsSentToday,
            emailsSentThisMonth: setting.emailsSentThisMonth,
          },
          data: {
            emailsSentToday: needsDayReset ? 1 : sentToday + 1,
            emailsSentThisMonth: needsMonthReset ? 1 : sentThisMonth + 1,
            lastEmailSentDate: now,
            currentPeriodStart: needsMonthReset ? monthStart : (periodStart ?? monthStart),
          },
        });

        if (updated.count === 0) {
          // Another concurrent transaction modified the counters — retry
          throw new Error('__CONCURRENT_UPDATE__');
        }

        return setting;
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
