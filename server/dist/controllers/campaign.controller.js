"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCampaignLogDetail = exports.sendManualMessage = exports.toggleEngineStatus = exports.getEngineStatus = exports.getCampaignLogs = exports.getCampaignStats = exports.removeLeadFromCampaign = exports.addLeadsToCampaign = exports.deleteCampaign = exports.updateCampaign = exports.createCampaign = exports.getCampaignById = exports.getCampaigns = void 0;
const prismaClient_1 = __importDefault(require("../models/prismaClient"));
const asyncHandler_1 = require("../utils/asyncHandler");
const emailService_1 = require("../utils/emailService");
exports.getCampaigns = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const campaigns = await prismaClient_1.default.campaign.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            segments: { select: { id: true, name: true } },
            _count: {
                select: { leads: true }
            }
        }
    });
    res.status(200).json({ data: campaigns, message: 'Campaigns retrieved successfully' });
});
exports.getCampaignById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const campaign = await prismaClient_1.default.campaign.findUnique({
        where: { id: parseInt(id) },
        include: {
            segments: { select: { id: true, name: true } },
            automations: true,
            leads: { select: { id: true, name: true, email: true, phone: true } },
            _count: { select: { leads: true } }
        }
    });
    if (!campaign) {
        throw new Error('Campaign not found');
    }
    res.status(200).json({ data: campaign, message: 'Campaign retrieved successfully' });
});
exports.createCampaign = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { name, type, status, segmentIds, leadIds, description, channels, schedule, emailTemplateId, whatsappTemplateId, smsTemplateId } = req.body;
    if (!name || !type) {
        throw new Error('Name and type are required');
    }
    const data = {
        name,
        description,
        type,
        channels,
        status: status || 'DRAFT',
        schedule: schedule ? new Date(schedule) : null,
        emailTemplateId: emailTemplateId ? parseInt(emailTemplateId) : null,
        whatsappTemplateId: whatsappTemplateId ? parseInt(whatsappTemplateId) : null,
        smsTemplateId: smsTemplateId ? parseInt(smsTemplateId) : null
    };
    // If segments are assigned, automatically fetch and connect all matching leads
    if (segmentIds && Array.isArray(segmentIds) && segmentIds.length > 0) {
        const segments = await prismaClient_1.default.segment.findMany({
            where: { id: { in: segmentIds.map(id => parseInt(id)) } }
        });
        if (segments.length > 0) {
            // Connect segments to campaign
            data.segments = {
                connect: segments.map(s => ({ id: s.id }))
            };
            // Combine where clauses for all selected segments using OR
            const orClauses = [];
            for (const segment of segments) {
                const rules = segment.rules || {};
                const whereClause = {};
                if (rules.entityType && rules.entityType !== 'All')
                    whereClause.type = rules.entityType;
                if (rules.region && rules.region !== 'All')
                    whereClause.state = { equals: rules.region, mode: 'insensitive' };
                if (rules.city && rules.city !== 'All')
                    whereClause.city = { equals: rules.city, mode: 'insensitive' };
                if (rules.activityStatus && rules.activityStatus !== 'All')
                    whereClause.verificationStatus = rules.activityStatus;
                if (Object.keys(whereClause).length > 0) {
                    orClauses.push(whereClause);
                }
            }
            const matchingLeads = await prismaClient_1.default.lead.findMany({
                where: orClauses.length > 0 ? { OR: orClauses } : {},
                select: { id: true }
            });
            const allLeadIds = new Set();
            matchingLeads.forEach(l => allLeadIds.add(l.id));
            if (leadIds && Array.isArray(leadIds)) {
                leadIds.forEach(id => allLeadIds.add(parseInt(id)));
            }
            if (allLeadIds.size > 0) {
                data.leads = {
                    connect: Array.from(allLeadIds).map(id => ({ id }))
                };
            }
        }
    }
    else if (leadIds && Array.isArray(leadIds) && leadIds.length > 0) {
        // If only leadIds are provided (no segments)
        data.leads = {
            connect: leadIds.map(id => ({ id: parseInt(id) }))
        };
    }
    const newCampaign = await prismaClient_1.default.campaign.create({
        data,
        include: {
            segments: { select: { id: true, name: true } },
            _count: { select: { leads: true } }
        }
    });
    res.status(201).json({ message: 'Campaign created successfully', data: newCampaign });
});
exports.updateCampaign = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { name, type, status, segmentIds, leadIds, description, channels, schedule, emailTemplateId, whatsappTemplateId, smsTemplateId } = req.body;
    const dataToUpdate = { name, type, status, description, channels };
    if (schedule !== undefined)
        dataToUpdate.schedule = schedule ? new Date(schedule) : null;
    if (emailTemplateId !== undefined)
        dataToUpdate.emailTemplateId = emailTemplateId ? parseInt(emailTemplateId) : null;
    if (whatsappTemplateId !== undefined)
        dataToUpdate.whatsappTemplateId = whatsappTemplateId ? parseInt(whatsappTemplateId) : null;
    if (smsTemplateId !== undefined)
        dataToUpdate.smsTemplateId = smsTemplateId ? parseInt(smsTemplateId) : null;
    if (segmentIds !== undefined) {
        if (Array.isArray(segmentIds) && segmentIds.length > 0) {
            const segments = await prismaClient_1.default.segment.findMany({
                where: { id: { in: segmentIds.map(id => parseInt(id)) } }
            });
            if (segments.length > 0) {
                // Sync segments
                dataToUpdate.segments = {
                    set: segments.map(s => ({ id: s.id }))
                };
                const orClauses = [];
                for (const segment of segments) {
                    const rules = segment.rules || {};
                    const whereClause = {};
                    if (rules.entityType && rules.entityType !== 'All')
                        whereClause.type = rules.entityType;
                    if (rules.region && rules.region !== 'All')
                        whereClause.state = { equals: rules.region, mode: 'insensitive' };
                    if (rules.city && rules.city !== 'All')
                        whereClause.city = { equals: rules.city, mode: 'insensitive' };
                    if (rules.activityStatus && rules.activityStatus !== 'All')
                        whereClause.verificationStatus = rules.activityStatus;
                    if (Object.keys(whereClause).length > 0) {
                        orClauses.push(whereClause);
                    }
                }
                const matchingLeads = await prismaClient_1.default.lead.findMany({
                    where: orClauses.length > 0 ? { OR: orClauses } : {},
                    select: { id: true }
                });
                const allLeadIds = new Set();
                matchingLeads.forEach(l => allLeadIds.add(l.id));
                if (leadIds && Array.isArray(leadIds)) {
                    leadIds.forEach(id => allLeadIds.add(parseInt(id)));
                }
                dataToUpdate.leads = {
                    set: Array.from(allLeadIds).map(id => ({ id }))
                };
            }
        }
        else {
            // Clear segments and handle leadIds if provided alone
            dataToUpdate.segments = { set: [] };
            if (leadIds && Array.isArray(leadIds) && leadIds.length > 0) {
                dataToUpdate.leads = { set: leadIds.map(id => ({ id: parseInt(id) })) };
            }
            else {
                dataToUpdate.leads = { set: [] };
            }
        }
    }
    else if (leadIds !== undefined) {
        // If only leadIds are updated
        if (Array.isArray(leadIds) && leadIds.length > 0) {
            dataToUpdate.leads = { set: leadIds.map(id => ({ id: parseInt(id) })) };
        }
        else {
            dataToUpdate.leads = { set: [] };
        }
    }
    const campaign = await prismaClient_1.default.campaign.update({
        where: { id: parseInt(id) },
        data: dataToUpdate,
        include: {
            segments: { select: { id: true, name: true } },
            _count: { select: { leads: true } }
        }
    });
    res.status(200).json({ message: 'Campaign updated successfully', data: campaign });
});
exports.deleteCampaign = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    await prismaClient_1.default.campaign.delete({
        where: { id: parseInt(id) }
    });
    res.status(200).json({ message: 'Campaign deleted successfully' });
});
exports.addLeadsToCampaign = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { leadIds } = req.body;
    if (!leadIds || !Array.isArray(leadIds)) {
        throw new Error('leadIds must be an array');
    }
    const campaign = await prismaClient_1.default.campaign.update({
        where: { id: parseInt(id) },
        data: {
            leads: {
                connect: leadIds.map((leadId) => ({ id: leadId }))
            }
        },
        include: {
            _count: { select: { leads: true } }
        }
    });
    res.status(200).json({ message: 'Leads added to campaign successfully', data: campaign });
});
exports.removeLeadFromCampaign = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id, leadId } = req.params;
    const campaign = await prismaClient_1.default.campaign.update({
        where: { id: parseInt(id) },
        data: {
            leads: {
                disconnect: { id: parseInt(leadId) }
            }
        },
        include: {
            _count: { select: { leads: true } }
        }
    });
    res.status(200).json({ message: 'Lead removed from campaign successfully', data: campaign });
});
exports.getCampaignStats = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const campaignId = parseInt(id);
    const messageSends = await prismaClient_1.default.messageSend.findMany({
        where: { campaignId },
        select: { id: true }
    });
    const messageSendIds = messageSends.map(ms => ms.id);
    const engagements = await prismaClient_1.default.engagementEvent.groupBy({
        by: ['eventType'],
        where: { messageSendId: { in: messageSendIds } },
        _count: {
            eventType: true
        }
    });
    res.status(200).json({ data: { sends: [], engagements } });
});
exports.getCampaignLogs = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const [logsRaw, total] = await Promise.all([
        prismaClient_1.default.engagementEvent.findMany({
            where: { messageSend: { campaignId: parseInt(id) } },
            include: {
                messageSend: {
                    include: {
                        lead: {
                            select: { id: true, name: true, email: true, phone: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        prismaClient_1.default.engagementEvent.count({
            where: { messageSend: { campaignId: parseInt(id) } }
        })
    ]);
    const logs = logsRaw.map(log => ({
        ...log,
        lead: log.messageSend?.lead,
        campaignId: log.messageSend?.campaignId
    }));
    res.status(200).json({
        data: logs,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    });
});
const campaignRunner_service_1 = require("../services/campaignRunner.service");
exports.getEngineStatus = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    res.status(200).json({ data: { isRunning: (0, campaignRunner_service_1.getEngineState)() } });
});
exports.toggleEngineStatus = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { isRunning } = req.body;
    const newState = (0, campaignRunner_service_1.toggleEngine)(isRunning);
    res.status(200).json({ data: { isRunning: newState }, message: newState ? 'Engine started' : 'Engine stopped' });
});
exports.sendManualMessage = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { leadId, channel, templateId, message } = req.body;
    if (!leadId || !channel) {
        throw new Error('leadId and channel are required');
    }
    const lead = await prismaClient_1.default.lead.findUnique({ where: { id: parseInt(leadId) } });
    if (!lead)
        throw new Error('Lead not found');
    let content = message || '';
    let subject = 'Message from AlgoConnect';
    if (templateId) {
        const template = await prismaClient_1.default.messageTemplate.findUnique({ where: { id: parseInt(templateId) } });
        if (template) {
            content = template.content;
            subject = template.subject || subject;
        }
    }
    if (!content) {
        throw new Error('Message content is required');
    }
    content = content
        .replace(/{{name}}/g, lead.name || '')
        .replace(/{{contact_name}}/g, lead.contactPerson || lead.name || '')
        .replace(/{{company}}/g, lead.name || '');
    let recipient = '';
    const providerMessageId = `manual-${Date.now()}`;
    let htmlSent = '';
    if (channel === 'EMAIL') {
        recipient = lead.email || lead.scrapedEmail || lead.email2 || '';
        if (!recipient)
            throw new Error('Lead has no email address');
        // Generate tracking URL (fallback to localhost for local testing)
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:7700';
        const trackingPixel = `<img src="${backendUrl}/api/track/open/${providerMessageId}" width="1" height="1" style="display:none;" alt="" />`;
        htmlSent = `<div style="font-family: sans-serif; white-space: pre-wrap;">${content}</div>${trackingPixel}`;
        try {
            const transporter = await (0, emailService_1.getEmailTransporter)();
            const sender = await (0, emailService_1.getEmailSenderId)();
            await transporter.sendMail({
                from: sender,
                to: recipient,
                subject,
                html: htmlSent
            });
        }
        catch (err) {
            const msg = await prismaClient_1.default.messageSend.create({
                data: {
                    leadId: lead.id,
                    campaignId: parseInt(id),
                    channel,
                    subject,
                    status: 'FAILED',
                    providerMessageId: `manual-failed-${Date.now()}`
                }
            });
            await prismaClient_1.default.engagementEvent.create({
                data: {
                    messageSendId: msg.id,
                    eventType: 'FAILED',
                    metadataJson: { isManual: true, error: err.message }
                }
            });
            throw new Error(`Failed to send email: ${err.message}`);
        }
    }
    else {
        // For SMS/Whatsapp, ensure phone exists
        recipient = lead.phone || lead.scrapedPhone || lead.phone2 || '';
        if (!recipient)
            throw new Error(`Lead has no phone number for ${channel}`);
        htmlSent = content;
        console.log(`[Mock] Sending ${channel} to ${recipient}: ${content}`);
    }
    const msg = await prismaClient_1.default.messageSend.create({
        data: {
            leadId: parseInt(leadId),
            campaignId: parseInt(id),
            channel,
            subject,
            status: 'SENT',
            providerMessageId,
            sentAt: new Date()
        }
    });
    const event = await prismaClient_1.default.engagementEvent.create({
        data: {
            messageSendId: msg.id,
            eventType: 'SENT',
            metadataJson: {
                isManual: true,
                templateId: templateId || null,
                recipient,
                htmlContent: htmlSent,
            }
        }
    });
    res.status(200).json({ message: 'Manual message sent successfully', data: event });
});
exports.getCampaignLogDetail = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const logId = req.params.logId;
    const log = await prismaClient_1.default.engagementEvent.findFirst({
        where: {
            id: parseInt(logId),
            messageSend: { campaignId: parseInt(id) }
        },
        include: {
            messageSend: {
                include: {
                    lead: { select: { id: true, name: true, email: true, phone: true, scrapedEmail: true } },
                    campaign: { select: { id: true, name: true } }
                }
            }
        }
    });
    if (!log)
        throw new Error('Log entry not found');
    const mappedLog = {
        ...log,
        lead: log.messageSend?.lead,
        campaign: log.messageSend?.campaign,
        details: log.metadataJson ? JSON.stringify(log.metadataJson) : '{}'
    };
    let parsedDetails = {};
    try {
        parsedDetails = mappedLog.details ? JSON.parse(mappedLog.details) : {};
    }
    catch (e) {
        parsedDetails = { raw: mappedLog.details };
    }
    res.status(200).json({ data: { log: mappedLog, details: parsedDetails } });
});
