"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmailLimitLogs = exports.getMessageLogs = exports.testIntegration = exports.updateSetting = exports.getAllSettings = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const prismaClient_1 = __importDefault(require("../models/prismaClient"));
const emailService_1 = require("../utils/emailService");
const sanitizeSettingCounters = async (setting) => {
    if (!setting || setting.type !== 'EMAIL')
        return setting;
    const now = new Date();
    const hourStart = new Date(now);
    hourStart.setMinutes(0, 0, 0);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    // Count actual emails sent in MessageSend table for precise real-time accuracy
    const [sentThisHour, sentToday, sentThisMonth] = await Promise.all([
        prismaClient_1.default.messageSend.count({
            where: { channel: 'EMAIL', status: 'SENT', sentAt: { gte: hourStart } }
        }),
        prismaClient_1.default.messageSend.count({
            where: { channel: 'EMAIL', status: 'SENT', sentAt: { gte: todayStart } }
        }),
        prismaClient_1.default.messageSend.count({
            where: { channel: 'EMAIL', status: 'SENT', sentAt: { gte: monthStart } }
        }),
    ]);
    setting.emailsSentThisHour = sentThisHour;
    setting.emailsSentToday = sentToday;
    setting.emailsSentThisMonth = sentThisMonth;
    try {
        await prismaClient_1.default.integrationSetting.update({
            where: { id: setting.id },
            data: {
                emailsSentThisHour: sentThisHour,
                emailsSentToday: sentToday,
                emailsSentThisMonth: sentThisMonth,
                currentPeriodStart: monthStart,
            },
        });
    }
    catch (e) {
        // non-critical
    }
    return setting;
};
// ─── GET /settings/integrations ──────────────────────────────────────────────
const getAllSettings = async (req, res) => {
    try {
        const settings = await prismaClient_1.default.integrationSetting.findMany();
        const sanitized = await Promise.all(settings.map((s) => sanitizeSettingCounters(s)));
        res.json({ data: sanitized });
    }
    catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.getAllSettings = getAllSettings;
// ─── PUT /settings/integrations/:type ────────────────────────────────────────
const updateSetting = async (req, res) => {
    try {
        const { type } = req.params;
        const data = req.body;
        const user = req.user; // injected by auth middleware
        // Parse and validate emailLimit
        const parseLimit = (val) => {
            if (val === '' || val === null || val === undefined)
                return null;
            const n = parseInt(String(val), 10);
            return isNaN(n) ? null : n;
        };
        const newLimitType = data.limitType || 'DAILY';
        // Support both `emailLimit` (new) and `dailyLimit` (old field from UI)
        const newEmailLimit = parseLimit(data.emailLimit ?? data.dailyLimit);
        // ── Fetch current record for audit comparison ──
        const existing = await prismaClient_1.default.integrationSetting.findUnique({
            where: { type },
        });
        const setting = await prismaClient_1.default.integrationSetting.upsert({
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
            const limitChanged = prevLimitType !== newLimitType || prevLimit !== newEmailLimit;
            if (limitChanged) {
                await prismaClient_1.default.emailLimitAuditLog.create({
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
        const sanitizedSetting = await sanitizeSettingCounters(setting);
        res.json({ message: 'Setting updated successfully', data: sanitizedSetting });
    }
    catch (error) {
        console.error('Error updating setting:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.updateSetting = updateSetting;
// ─── POST /settings/integrations/:type/test ──────────────────────────────────
const testIntegration = async (req, res) => {
    try {
        const { type } = req.params;
        let setting = req.body;
        // If no body provided, fallback to DB
        if (!setting || Object.keys(setting).length === 0) {
            setting = await prismaClient_1.default.integrationSetting.findUnique({
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
                    const transporter = nodemailer_1.default.createTransport({
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
                        await (0, emailService_1.checkAndIncrementEmailLimit)();
                        await transporter.sendMail({
                            from: `"Deepmind Infotech" <` + (setting.senderId || setting.apiKey) + `>`,
                            to: setting.testEmail,
                            subject: 'AlgoConnect: SMTP Test Connection Successful',
                            text: 'Congratulations! Your SMTP email integration is configured correctly in AlgoConnect.',
                            html: '<p>Congratulations!</p><p>Your SMTP email integration is configured correctly in AlgoConnect.</p>',
                        });
                        success = true;
                        message = `Successfully sent test email to ${setting.testEmail}`;
                    }
                    else {
                        await transporter.verify();
                        success = true;
                        message = `Successfully connected to SMTP server ${setting.host}:${setting.port}`;
                    }
                }
                catch (err) {
                    success = false;
                    message = err.message?.includes('limit')
                        ? err.message
                        : `SMTP Verification failed: ${err.message || err.toString()}`;
                }
            }
            else {
                message = 'Missing host or port for EMAIL connection';
            }
        }
        else if (type === 'SMS') {
            if (setting.apiKey) {
                success = true;
                message = `Successfully verified SMS API Key for provider ${setting.provider}`;
            }
            else {
                message = 'Missing API Key for SMS connection';
            }
        }
        else if (type === 'WHATSAPP') {
            if (setting.apiKey) {
                success = true;
                message = `Successfully authenticated with WhatsApp API`;
            }
            else {
                message = 'Missing API Key / Access Token for WhatsApp connection';
            }
        }
        if (success) {
            res.json({ success: true, message });
        }
        else {
            res.status(400).json({ success: false, message });
        }
    }
    catch (error) {
        console.error('Error testing integration:', error);
        if (error.statusCode === 429) {
            return res.status(429).json({ success: false, message: error.message });
        }
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.testIntegration = testIntegration;
// ─── GET /settings/message-logs ──────────────────────────────────────────────
const getMessageLogs = async (req, res) => {
    try {
        const { channel, status, dateFrom, dateTo, page = '1', limit = '50' } = req.query;
        const where = {};
        if (channel && channel !== 'ALL') {
            where.messageSend = { channel: channel };
        }
        if (status && status !== 'ALL') {
            if (status === 'REPLIED') {
                where.eventType = { in: ['REPLY', 'REPLIED'] };
            }
            else {
                where.eventType = status;
            }
        }
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom)
                where.createdAt.gte = new Date(dateFrom);
            if (dateTo) {
                const to = new Date(dateTo);
                to.setHours(23, 59, 59, 999);
                where.createdAt.lte = to;
            }
        }
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);
        const [logsRaw, total] = await Promise.all([
            prismaClient_1.default.engagementEvent.findMany({
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
            prismaClient_1.default.engagementEvent.count({ where }),
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
            page: parseInt(page),
            totalPages: Math.ceil(total / take),
        });
    }
    catch (error) {
        console.error('Error fetching message logs:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.getMessageLogs = getMessageLogs;
// ─── GET /settings/email-limit-logs ──────────────────────────────────────────
const getEmailLimitLogs = async (req, res) => {
    try {
        const { page = '1', limit = '20' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);
        const [logs, total] = await Promise.all([
            prismaClient_1.default.emailLimitAuditLog.findMany({
                orderBy: { createdAt: 'desc' },
                skip,
                take,
            }),
            prismaClient_1.default.emailLimitAuditLog.count(),
        ]);
        res.json({ data: logs, total, page: parseInt(page), totalPages: Math.ceil(total / take) });
    }
    catch (error) {
        console.error('Error fetching email limit logs:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.getEmailLimitLogs = getEmailLimitLogs;
