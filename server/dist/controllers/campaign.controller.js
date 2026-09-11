"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendManualMessage = exports.getEngineLogs = exports.toggleEngineStatus = exports.getEngineStatus = exports.getCampaignLogs = exports.getCampaignStats = exports.removeLeadFromCampaign = exports.addLeadsToCampaign = exports.deleteCampaign = exports.updateCampaign = exports.createCampaign = exports.getCampaignConnectedLeads = exports.isLeadInSegment = exports.getLeadsForSegments = exports.buildWhereClauseFromSegmentRules = exports.getEmailPriorityRank = exports.isValidEmail = exports.getCampaignById = exports.getCampaigns = void 0;
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
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (email) => {
    if (!email || typeof email !== 'string' || email.trim() === '')
        return false;
    return EMAIL_REGEX.test(email.trim());
};
exports.isValidEmail = isValidEmail;
const getEmailPriorityRank = (email) => {
    if (!(0, exports.isValidEmail)(email))
        return 3; // Rank 3: Invalid or Empty Email (Last)
    const trimmed = email.trim().toLowerCase();
    if (trimmed.endsWith('@gmail.com'))
        return 1; // Rank 1: Valid @gmail.com (First)
    return 2; // Rank 2: Other valid email domains (@yahoo.com, custom domain, etc.)
};
exports.getEmailPriorityRank = getEmailPriorityRank;
// ─── Segment Helpers ─────────────────────────────────────────────────────────
const buildWhereClauseFromSegmentRules = (rules) => {
    if (!rules || typeof rules !== 'object')
        return {};
    const whereClause = {};
    if (rules.entityType && rules.entityType !== 'All')
        whereClause.type = rules.entityType;
    if (rules.region && rules.region !== 'All')
        whereClause.state = { equals: rules.region, mode: 'insensitive' };
    if (rules.city && rules.city !== 'All')
        whereClause.city = { equals: rules.city, mode: 'insensitive' };
    if (rules.activityStatus && rules.activityStatus !== 'All')
        whereClause.verificationStatus = rules.activityStatus;
    if (rules.websiteStatus === 'NoWebsite') {
        if (!whereClause.AND)
            whereClause.AND = [];
        whereClause.AND.push({ OR: [{ website: null }, { website: '' }] });
    }
    else if (rules.websiteStatus === 'HasWebsite') {
        if (!whereClause.AND)
            whereClause.AND = [];
        whereClause.AND.push({ website: { not: null }, NOT: { website: '' } });
    }
    if (rules.algoStatus === 'HasAlgo') {
        if (!whereClause.AND)
            whereClause.AND = [];
        whereClause.AND.push({ sellsAlgoTrading: { contains: 'Yes', mode: 'insensitive' } });
    }
    else if (rules.algoStatus === 'NoAlgo') {
        if (!whereClause.AND)
            whereClause.AND = [];
        whereClause.AND.push({ OR: [{ sellsAlgoTrading: null }, { sellsAlgoTrading: '' }, { sellsAlgoTrading: { contains: 'No', mode: 'insensitive' } }] });
    }
    if (rules.exchangeName && rules.exchangeName !== 'All') {
        whereClause.exchangeName = rules.exchangeName;
    }
    if (rules.otherListings === 'Yes') {
        if (!whereClause.AND)
            whereClause.AND = [];
        whereClause.AND.push({ otherListings: { not: null }, NOT: { otherListings: '' } });
    }
    else if (rules.otherListings === 'No') {
        if (!whereClause.AND)
            whereClause.AND = [];
        whereClause.AND.push({ OR: [{ otherListings: null }, { otherListings: '' }] });
    }
    return whereClause;
};
exports.buildWhereClauseFromSegmentRules = buildWhereClauseFromSegmentRules;
const getLeadsForSegments = async (segments) => {
    if (!segments || segments.length === 0)
        return [];
    const orClauses = [];
    let matchAllLeads = false;
    for (const segment of segments) {
        const rules = segment.rules || {};
        const whereClause = (0, exports.buildWhereClauseFromSegmentRules)(rules);
        if (Object.keys(whereClause).length === 0) {
            matchAllLeads = true;
            break;
        }
        else {
            orClauses.push(whereClause);
        }
    }
    let leads = [];
    if (matchAllLeads) {
        leads = await prismaClient_1.default.lead.findMany({ select: { id: true, email: true, scrapedEmail: true } });
    }
    else if (orClauses.length > 0) {
        leads = await prismaClient_1.default.lead.findMany({
            where: { OR: orClauses },
            select: { id: true, email: true, scrapedEmail: true }
        });
    }
    // Priority Sort: 1) Valid @gmail.com, 2) Other valid emails, 3) Invalid/empty emails (at the end)
    leads.sort((a, b) => {
        const rankA = (0, exports.getEmailPriorityRank)(a.email || a.scrapedEmail);
        const rankB = (0, exports.getEmailPriorityRank)(b.email || b.scrapedEmail);
        if (rankA !== rankB)
            return rankA - rankB;
        const emailA = (a.email || a.scrapedEmail || '').toLowerCase();
        const emailB = (b.email || b.scrapedEmail || '').toLowerCase();
        return emailA.localeCompare(emailB);
    });
    return leads;
};
exports.getLeadsForSegments = getLeadsForSegments;
const isLeadInSegment = (lead, rules) => {
    if (!rules || typeof rules !== 'object' || Object.keys(rules).length === 0)
        return true;
    if (rules.entityType && rules.entityType !== 'All') {
        if (lead.type !== rules.entityType)
            return false;
    }
    if (rules.region && rules.region !== 'All') {
        if (!lead.state || lead.state.toLowerCase() !== rules.region.toLowerCase())
            return false;
    }
    if (rules.city && rules.city !== 'All') {
        if (!lead.city || lead.city.toLowerCase() !== rules.city.toLowerCase())
            return false;
    }
    if (rules.activityStatus && rules.activityStatus !== 'All') {
        if (lead.verificationStatus !== rules.activityStatus)
            return false;
    }
    if (rules.websiteStatus === 'NoWebsite') {
        if (lead.website && lead.website.trim() !== '')
            return false;
    }
    else if (rules.websiteStatus === 'HasWebsite') {
        if (!lead.website || lead.website.trim() === '')
            return false;
    }
    if (rules.algoStatus === 'HasAlgo') {
        if (!lead.sellsAlgoTrading || !lead.sellsAlgoTrading.toLowerCase().includes('yes'))
            return false;
    }
    else if (rules.algoStatus === 'NoAlgo') {
        if (lead.sellsAlgoTrading && lead.sellsAlgoTrading.toLowerCase().includes('yes'))
            return false;
    }
    if (rules.exchangeName && rules.exchangeName !== 'All') {
        if (lead.exchangeName !== rules.exchangeName)
            return false;
    }
    if (rules.otherListings === 'Yes') {
        if (!lead.otherListings || lead.otherListings.trim() === '')
            return false;
    }
    else if (rules.otherListings === 'No') {
        if (lead.otherListings && lead.otherListings.trim() !== '')
            return false;
    }
    return true;
};
exports.isLeadInSegment = isLeadInSegment;
// ─── Connected Leads ──────────────────────────────────────────────────────────
exports.getCampaignConnectedLeads = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const campaignId = parseInt(id);
    const campaign = await prismaClient_1.default.campaign.findUnique({
        where: { id: campaignId },
        include: {
            segments: true,
            leads: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    scrapedEmail: true,
                    scrapedPhone: true,
                    type: true,
                    state: true,
                    city: true,
                    verificationStatus: true,
                    website: true,
                    sellsAlgoTrading: true,
                    exchangeName: true,
                    otherListings: true,
                    messageSends: {
                        where: { campaignId },
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        include: {
                            events: {
                                orderBy: { createdAt: 'desc' },
                                take: 1,
                            },
                            replies: {
                                orderBy: { receivedAt: 'desc' },
                                take: 1
                            }
                        }
                    }
                }
            }
        }
    });
    if (!campaign) {
        throw new Error('Campaign not found');
    }
    const formattedLeads = campaign.leads.map(lead => {
        const lastMessageSend = lead.messageSends[0];
        const lastEvent = lastMessageSend?.events[0];
        let latestReply = lastMessageSend?.replies?.[0] || null;
        if (lastEvent?.eventType === 'REPLY' && lastEvent?.metadataJson) {
            const meta = lastEvent.metadataJson;
            if (meta.text) {
                latestReply = {
                    subject: 'WhatsApp Reply',
                    body: meta.text,
                    receivedAt: lastEvent.createdAt
                };
            }
        }
        let status = 'PENDING';
        if (latestReply) {
            status = 'REPLIED';
        }
        else if (lastEvent) {
            if (lastEvent.eventType === 'LIMIT_REACHED') {
                status = 'PENDING (Limit Exceeded)';
            }
            else {
                status = lastEvent.eventType;
            }
        }
        else if (lastMessageSend) {
            status = lastMessageSend.status;
        }
        const matchingSegmentNames = (campaign.segments || [])
            .filter((seg) => (0, exports.isLeadInSegment)(lead, seg.rules))
            .map((seg) => seg.name);
        return {
            id: lead.id,
            name: lead.name,
            email: lead.email || lead.scrapedEmail,
            phone: lead.phone || lead.scrapedPhone,
            status: status,
            segments: matchingSegmentNames.length > 0 ? matchingSegmentNames : (campaign.segments?.map(s => s.name) || []),
            segmentDisplay: matchingSegmentNames.length > 0 ? matchingSegmentNames.join(', ') : (campaign.segments && campaign.segments.length > 0 ? campaign.segments.map(s => s.name).join(', ') : 'Manual Selection'),
            latestReply: latestReply || null,
            lastInteractionAt: latestReply?.receivedAt || lastEvent?.createdAt || lastMessageSend?.createdAt || null
        };
    });
    // Priority Sort: 1) Valid @gmail.com, 2) Other valid email, 3) Invalid/empty email (at the end)
    formattedLeads.sort((a, b) => {
        const rankA = (0, exports.getEmailPriorityRank)(a.email);
        const rankB = (0, exports.getEmailPriorityRank)(b.email);
        if (rankA !== rankB)
            return rankA - rankB;
        return (a.email || '').toLowerCase().localeCompare((b.email || '').toLowerCase());
    });
    res.status(200).json({ data: formattedLeads, message: 'Connected leads retrieved successfully' });
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
            data.segments = {
                connect: segments.map(s => ({ id: s.id }))
            };
            const matchingLeads = await (0, exports.getLeadsForSegments)(segments);
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
                dataToUpdate.segments = {
                    set: segments.map(s => ({ id: s.id }))
                };
                const matchingLeads = await (0, exports.getLeadsForSegments)(segments);
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
    await prismaClient_1.default.activityLog.create({
        data: {
            userId: req.user?.id,
            action: newState ? 'ENGINE_STARTED' : 'ENGINE_STOPPED',
            details: `Campaign Automation Engine was ${newState ? 'started' : 'stopped'} by ${req.user?.name || 'User'}`,
        }
    });
    res.status(200).json({ data: { isRunning: newState }, message: newState ? 'Engine started' : 'Engine stopped' });
});
exports.getEngineLogs = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const logs = await prismaClient_1.default.activityLog.findMany({
        where: {
            action: {
                in: ['ENGINE_STARTED', 'ENGINE_STOPPED']
            }
        },
        include: {
            user: { select: { id: true, name: true, email: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
    });
    res.status(200).json({ data: logs, message: 'Engine logs retrieved successfully' });
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
            const sender = await (0, emailService_1.getEmailSenderId)();
            await (0, emailService_1.sendEmail)({
                from: `"Deepmind Infotech" <` + (sender) + `>`,
                to: recipient,
                subject,
                html: htmlSent,
                messageId: `${providerMessageId}@algoconnect.local`
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
            providerMessageId
        }
    });
    await prismaClient_1.default.engagementEvent.create({
        data: {
            messageSendId: msg.id,
            eventType: 'SENT',
            metadataJson: { isManual: true }
        }
    });
    res.status(200).json({ message: 'Message sent successfully', data: msg });
});
