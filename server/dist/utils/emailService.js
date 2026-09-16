"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = exports.checkAndIncrementEmailLimit = exports.getEmailSenderId = exports.getEmailTransporter = void 0;
const nodemailer = __importStar(require("nodemailer"));
const prismaClient_1 = __importDefault(require("../models/prismaClient"));
const errorHandler_1 = require("../middlewares/errorHandler");
// ─── Helpers ─────────────────────────────────────────────────────────────────
const getEmailTransporter = async () => {
    const setting = await prismaClient_1.default.integrationSetting.findUnique({
        where: { type: 'EMAIL' },
    });
    if (!setting || !setting.host || !setting.apiKey || !setting.apiSecret) {
        throw new errorHandler_1.AppError('Email service is not configured. Contact your admin.', 503);
    }
    return nodemailer.createTransport({
        host: setting.host,
        port: Number(setting.port) || 587,
        secure: setting.secure === true,
        auth: { user: setting.apiKey, pass: setting.apiSecret },
    });
};
exports.getEmailTransporter = getEmailTransporter;
const getEmailSenderId = async () => {
    const setting = await prismaClient_1.default.integrationSetting.findUnique({
        where: { type: 'EMAIL' },
    });
    return setting?.senderId || 'noreply@algoconnect.com';
};
exports.getEmailSenderId = getEmailSenderId;
// ─── Core: check limit + increment counter (concurrency-safe) ─────────────────
const checkAndIncrementEmailLimit = async () => {
    const MAX_RETRIES = 5;
    let attempt = 0;
    while (attempt < MAX_RETRIES) {
        attempt++;
        try {
            const result = await prismaClient_1.default.$transaction(async (tx) => {
                // 1. Read current setting (snapshot inside transaction)
                const setting = await tx.integrationSetting.findUnique({
                    where: { type: 'EMAIL' },
                });
                if (!setting) {
                    throw new errorHandler_1.AppError('Email service is not configured.', 503);
                }
                const now = new Date();
                // ── Compute start-of-hour, start-of-day, and start-of-month in local time ──
                const hourStart = new Date(now);
                hourStart.setMinutes(0, 0, 0);
                const todayStart = new Date(now);
                todayStart.setHours(0, 0, 0, 0);
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
                // ── Active limit config ──
                const limitType = setting.limitType || 'DAILY';
                const activeLimit = setting.emailLimit ?? setting.dailyLimit ?? null;
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
                        throw new errorHandler_1.AppError(`Hourly email limit of ${activeLimit} reached. Try again next hour.`, 429);
                    }
                    if (limitType === 'DAILY' && sentToday >= activeLimit) {
                        throw new errorHandler_1.AppError(`Daily email limit of ${activeLimit} reached. Try again tomorrow.`, 429);
                    }
                    if (limitType === 'MONTHLY' && sentThisMonth >= activeLimit) {
                        throw new errorHandler_1.AppError(`Monthly email limit of ${activeLimit} reached. Try again next month.`, 429);
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
        }
        catch (err) {
            if (err.message === '__CONCURRENT_UPDATE__') {
                // Exponential back-off: 20ms, 40ms, 80ms …
                await new Promise(r => setTimeout(r, 20 * attempt));
                continue;
            }
            // Real error (AppError or DB error) — rethrow immediately
            throw err;
        }
    }
    throw new errorHandler_1.AppError('Too many concurrent email requests. Please try again shortly.', 429);
};
exports.checkAndIncrementEmailLimit = checkAndIncrementEmailLimit;
// ─── Public entry point used by ALL email-sending code ──────────────────────
const sendEmail = async (mailOptions) => {
    // 1. Check + atomically increment the limit counter first
    const setting = await (0, exports.checkAndIncrementEmailLimit)();
    if (!setting.host || !setting.apiKey || !setting.apiSecret) {
        throw new errorHandler_1.AppError('Email SMTP credentials are not configured.', 503);
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
exports.sendEmail = sendEmail;
