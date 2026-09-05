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
exports.processFile = exports.uploadChunk = exports.getFilterOptions = exports.getLeadLogs = exports.deleteLead = exports.updateLead = exports.getLeadById = exports.createLead = exports.getLeads = exports.importLeads = exports.sendDirectEmail = void 0;
const prismaClient_1 = __importDefault(require("../models/prismaClient"));
const asyncHandler_1 = require("../utils/asyncHandler");
const messagingGateway_service_1 = require("../services/messagingGateway.service");
const socket_service_1 = require("../services/socket.service");
const routing_service_1 = require("../services/routing.service");
exports.sendDirectEmail = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { subject, body, templateId, recipientEmail } = req.body;
    const lead = await prismaClient_1.default.lead.findUnique({
        where: { id: parseInt(id) }
    });
    if (!lead) {
        res.status(404).json({ message: 'Lead not found' });
        return;
    }
    const targetEmail = recipientEmail || lead.email;
    if (!targetEmail) {
        res.status(400).json({ message: 'No email address available to send to' });
        return;
    }
    let finalHtml = body;
    if (templateId) {
        const template = await prismaClient_1.default.messageTemplate.findUnique({
            where: { id: parseInt(templateId) }
        });
        if (template && template.content) {
            // Very basic compilation (replace {{name}})
            finalHtml = template.content.replace(/{{name}}/gi, lead.name || 'there');
            if (!subject && template.subject) {
                req.body.subject = template.subject;
            }
        }
    }
    const result = await messagingGateway_service_1.messagingGateway.sendMessage({
        leadId: lead.id,
        channel: 'EMAIL',
        recipient: targetEmail,
        content: finalHtml,
        htmlContent: finalHtml,
        subject: req.body.subject || subject || 'Message from AlgoConnect',
        templateId: templateId ? parseInt(templateId) : undefined
    });
    if (!result.success) {
        res.status(500).json({ message: 'Failed to send email', error: result.error });
        return;
    }
    res.status(200).json({ message: 'Email sent successfully', messageId: result.messageId });
});
exports.importLeads = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { leads } = req.body;
    const userId = req.user?.id;
    if (!leads || !Array.isArray(leads)) {
        throw new Error('Please provide an array of leads');
    }
    const createdLeads = await prismaClient_1.default.lead.createMany({
        data: leads.map(lead => ({
            name: lead.name,
            email: lead.email,
            email2: lead.email2,
            phone: lead.phone,
            phone2: lead.phone2,
            registrationNo: lead.registrationNo,
            contactPerson: lead.contactPerson,
            address: lead.address,
            city: lead.city,
            state: lead.state,
            pincode: lead.pincode,
            fax: lead.fax,
            validity: lead.validity,
            exchangeName: lead.exchangeName,
            tradeName: lead.tradeName,
            source: lead.source || 'IMPORT',
            type: lead.type || 'Manual',
            salesStage: lead.salesStage || 'New',
            verificationStatus: lead.verificationStatus || 'Imported',
            engagementStatus: lead.engagementStatus || 'Not Engaged',
            consentStatus: lead.consentStatus || 'Unknown'
        })),
        skipDuplicates: true
    });
    if (userId && createdLeads.count > 0) {
        await prismaClient_1.default.activityLog.create({
            data: {
                userId,
                action: 'IMPORTED_LEADS',
                details: `Imported ${createdLeads.count} leads`,
            }
        });
    }
    // Auto-route the newly imported leads
    try {
        const newLeadRecords = await prismaClient_1.default.lead.findMany({
            where: {
                createdAt: { gte: new Date(Date.now() - 10000) }, // Roughly leads just created
            },
            select: { id: true },
            take: createdLeads.count,
            orderBy: { id: 'desc' }
        });
        const newLeadIds = newLeadRecords.map(l => l.id);
        await routing_service_1.RoutingService.autoAssignLeadsBulk(newLeadIds);
    }
    catch (err) {
        console.error('Auto-routing failed during import:', err);
    }
    res.status(200).json({ message: 'Leads imported successfully', count: createdLeads.count });
});
exports.getLeads = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';
    // Status filters
    const unifiedStatus = req.query.unifiedStatus || 'All';
    const salesStage = req.query.salesStage || 'All';
    const verificationStatus = req.query.verificationStatus || 'All';
    const engagementStatus = req.query.engagementStatus || 'All';
    const consentStatus = req.query.consentStatus || 'All';
    const type = req.query.type || 'All';
    const state = req.query.state || 'All';
    const city = req.query.city || 'All';
    const websiteStatus = req.query.websiteStatus || 'All';
    const sellsAlgoTrading = req.query.sellsAlgoTrading || 'All';
    const exchangeName = req.query.exchangeName || 'All';
    const otherListings = req.query.otherListings || 'All';
    const skip = (page - 1) * limit;
    const where = {};
    if (salesStage && salesStage !== 'All')
        where.salesStage = salesStage;
    if (unifiedStatus && unifiedStatus !== 'All') {
        switch (unifiedStatus) {
            case 'NEW':
                where.salesStage = 'New';
                break;
            case 'CONTACTED':
                where.salesStage = 'Contacted';
                break;
            case 'FOLLOW_UP':
                where.salesStage = 'Follow-up';
                break;
            case 'CONTACTED_OR_FOLLOW_UP':
                where.salesStage = { in: ['Contacted', 'Follow-up'] };
                break;
            case 'QUALIFIED':
                where.salesStage = 'Qualified';
                break;
            case 'NEGOTIATION':
                where.salesStage = 'Negotiation';
                break;
            case 'WON':
                where.salesStage = 'Client Won';
                break;
            case 'LOST':
                where.salesStage = 'Client Lost';
                break;
            case 'DNC':
                where.salesStage = 'Do Not Contact';
                break;
            case 'UNVERIFIED':
                where.verificationStatus = 'Unverified';
                break;
            case 'ENGAGED':
                where.engagementStatus = { not: 'Not Engaged' };
                break;
            case 'IMPORTED':
                where.verificationStatus = 'Imported';
                break;
            case 'INVALID':
                where.verificationStatus = { in: ['Likely Inactive', 'Duplicate'] };
                break;
            case 'OVERDUE':
                const startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);
                where.nextFollowUpAt = { lt: startOfDay };
                break;
            default:
                where.status = unifiedStatus;
        }
    }
    if (verificationStatus && verificationStatus !== 'All')
        where.verificationStatus = verificationStatus;
    if (engagementStatus && engagementStatus !== 'All')
        where.engagementStatus = engagementStatus;
    if (consentStatus && consentStatus !== 'All')
        where.consentStatus = consentStatus;
    if (type && type !== 'All')
        where.type = type;
    if (state && state !== 'All')
        where.state = state;
    if (city && city !== 'All')
        where.city = city;
    if (websiteStatus === 'NoWebsite') {
        if (!where.AND)
            where.AND = [];
        where.AND.push({
            OR: [
                { website: null },
                { website: '' }
            ]
        });
    }
    else if (websiteStatus === 'HasWebsite') {
        if (!where.AND)
            where.AND = [];
        where.AND.push({
            website: { not: null },
            NOT: { website: '' }
        });
    }
    if (sellsAlgoTrading === 'Yes') {
        if (!where.AND)
            where.AND = [];
        where.AND.push({ sellsAlgoTrading: { contains: 'Yes', mode: 'insensitive' } });
    }
    else if (sellsAlgoTrading === 'No') {
        if (!where.AND)
            where.AND = [];
        where.AND.push({
            OR: [
                { sellsAlgoTrading: null },
                { sellsAlgoTrading: '' },
                { sellsAlgoTrading: { contains: 'No', mode: 'insensitive' } }
            ]
        });
    }
    if (exchangeName && exchangeName !== 'All') {
        where.exchangeName = exchangeName;
    }
    if (otherListings === 'Yes') {
        if (!where.AND)
            where.AND = [];
        where.AND.push({
            otherListings: { not: null },
            NOT: { otherListings: '' }
        });
    }
    else if (otherListings === 'No') {
        if (!where.AND)
            where.AND = [];
        where.AND.push({
            OR: [
                { otherListings: null },
                { otherListings: '' }
            ]
        });
    }
    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { email2: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { phone2: { contains: search, mode: 'insensitive' } },
            { registrationNo: { contains: search, mode: 'insensitive' } },
            { city: { contains: search, mode: 'insensitive' } },
            { state: { contains: search, mode: 'insensitive' } }
        ];
    }
    const sortBy = req.query.sortBy || 'createdAt';
    const order = req.query.order || 'desc';
    const allowedSortFields = ['createdAt', 'name', 'leadScore'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';
    const [leads, total] = await Promise.all([
        prismaClient_1.default.lead.findMany({
            where,
            orderBy: { [sortField]: sortOrder },
            skip,
            take: limit,
            include: {
                user: { select: { id: true, name: true } }
            }
        }),
        prismaClient_1.default.lead.count({ where })
    ]);
    res.status(200).json({
        data: leads,
        message: 'List of leads retrieved successfully',
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    });
});
exports.createLead = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { name, email, email2, phone, phone2, status, salesStage, verificationStatus, engagementStatus, consentStatus, registrationNo, contactPerson, address, city, state, pincode, fax, validity, exchangeName, tradeName, source, type, website, linkedin, twitter, facebook, servicesSummary, productsOffered, sellsAlgoTrading, brokerPartner, companySizeEstimate, enrichmentNotes, logoUrl } = req.body;
    const userId = req.user?.id;
    if (!name) {
        throw new Error('Lead name is required');
    }
    const newLead = await prismaClient_1.default.lead.create({
        data: {
            name, email, email2, phone, phone2, registrationNo, contactPerson, address, city, state, pincode, fax, validity, exchangeName, tradeName,
            source: source || 'MANUAL',
            type: type || 'Manual',
            status: status || 'IMPORTED',
            salesStage: salesStage || 'New',
            verificationStatus: verificationStatus || 'Unverified',
            engagementStatus: engagementStatus || 'Not Engaged',
            consentStatus: consentStatus || 'Unknown',
            website, linkedin, twitter, facebook, servicesSummary, productsOffered, sellsAlgoTrading, brokerPartner, companySizeEstimate, enrichmentNotes, logoUrl
        }
    });
    if (userId) {
        await prismaClient_1.default.activityLog.create({
            data: {
                userId,
                leadId: newLead.id,
                action: 'CREATED_LEAD',
                details: 'Manually created lead'
            }
        });
    }
    // Notify system admins about the new lead
    const admins = await prismaClient_1.default.user.findMany({
        where: { role: { name: 'System Admin' } }
    });
    for (const admin of admins) {
        if (admin.id !== userId) { // Don't notify the person who created it if they are an admin
            const notif = await prismaClient_1.default.notification.create({
                data: {
                    userId: admin.id,
                    title: 'New Lead Created',
                    message: `Lead "${newLead.name}" was just created by ${req.user?.name || 'a user'}.`,
                    type: 'LEAD_CREATED',
                    relatedEntityId: newLead.id,
                    relatedEntity: 'Lead'
                }
            });
            socket_service_1.SocketService.sendToUser(admin.id, 'new_notification', notif);
        }
    }
    // Auto-route the new lead
    try {
        await routing_service_1.RoutingService.autoAssignLead(newLead.id);
    }
    catch (err) {
        console.error('Auto-routing failed for new lead:', err);
    }
    res.status(201).json({ message: 'Lead created successfully', data: newLead });
});
exports.getLeadById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const lead = await prismaClient_1.default.lead.findUnique({
        where: { id: parseInt(id) },
        include: {
            user: { select: { id: true, name: true } }
        }
    });
    if (!lead) {
        throw new Error('Lead not found');
    }
    res.status(200).json({ message: 'Lead fetched successfully', data: lead });
});
exports.updateLead = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { name, email, email2, phone, phone2, status, salesStage, verificationStatus, engagementStatus, consentStatus, registrationNo, contactPerson, address, city, state, pincode, fax, validity, exchangeName, tradeName, source, type, website, linkedin, twitter, facebook, servicesSummary, productsOffered, sellsAlgoTrading, brokerPartner, companySizeEstimate, enrichmentNotes, logoUrl, userId: assignedUserId } = req.body;
    const currentUserId = req.user?.id;
    if (!id) {
        throw new Error('Lead ID is required');
    }
    const leadId = parseInt(id);
    const existingLead = await prismaClient_1.default.lead.findUnique({ where: { id: leadId } });
    if (!existingLead) {
        throw new Error('Lead not found');
    }
    const updatedLead = await prismaClient_1.default.lead.update({
        where: { id: leadId },
        data: {
            name, email, email2, phone, phone2, status, salesStage, verificationStatus, engagementStatus, consentStatus, registrationNo, contactPerson, address, city, state, pincode, fax, validity, exchangeName, tradeName, source, type,
            website, linkedin, twitter, facebook, servicesSummary, productsOffered, sellsAlgoTrading, brokerPartner, companySizeEstimate, enrichmentNotes, logoUrl,
            ...(assignedUserId !== undefined && { userId: assignedUserId ? parseInt(assignedUserId) : null })
        },
        include: {
            user: { select: { id: true, name: true } }
        }
    });
    // Track changes
    if (currentUserId) {
        const changes = {};
        if (salesStage && existingLead.salesStage !== salesStage)
            changes.salesStage = { from: existingLead.salesStage, to: salesStage };
        if (verificationStatus && existingLead.verificationStatus !== verificationStatus)
            changes.verificationStatus = { from: existingLead.verificationStatus, to: verificationStatus };
        if (engagementStatus && existingLead.engagementStatus !== engagementStatus)
            changes.engagementStatus = { from: existingLead.engagementStatus, to: engagementStatus };
        if (consentStatus && existingLead.consentStatus !== consentStatus)
            changes.consentStatus = { from: existingLead.consentStatus, to: consentStatus };
        if (Object.keys(changes).length > 0) {
            await prismaClient_1.default.activityLog.create({
                data: {
                    userId: currentUserId,
                    leadId,
                    action: 'UPDATED_STATUSES',
                    details: 'Updated lead statuses',
                    changes: JSON.stringify(changes)
                }
            });
        }
    }
    // Check for status change notification (notify admins when status changes)
    if (status && existingLead.status !== status) {
        const admins = await prismaClient_1.default.user.findMany({
            where: { role: { name: 'System Admin' } }
        });
        for (const admin of admins) {
            if (admin.id !== currentUserId) {
                const notif = await prismaClient_1.default.notification.create({
                    data: {
                        userId: admin.id,
                        title: 'Lead Status Changed',
                        message: `Status for "${updatedLead.name}" was changed to ${status} by ${req.user?.name || 'a user'}.`,
                        type: 'STATUS_CHANGED',
                        relatedEntityId: updatedLead.id,
                        relatedEntity: 'Lead'
                    }
                });
                socket_service_1.SocketService.sendToUser(admin.id, 'new_notification', notif);
            }
        }
    }
    // Check for assignment change notification
    if (assignedUserId !== undefined && existingLead.userId !== assignedUserId && assignedUserId !== null) {
        // Notify the newly assigned user
        if (assignedUserId !== currentUserId) {
            const notif = await prismaClient_1.default.notification.create({
                data: {
                    userId: assignedUserId,
                    title: 'New Lead Assigned',
                    message: `Lead "${updatedLead.name}" has been assigned to you by ${req.user?.name || 'a user'}.`,
                    type: 'LEAD_ASSIGNED',
                    relatedEntityId: updatedLead.id,
                    relatedEntity: 'Lead'
                }
            });
            socket_service_1.SocketService.sendToUser(assignedUserId, 'new_notification', notif);
        }
    }
    res.status(200).json({ message: 'Lead updated successfully', data: updatedLead });
});
exports.deleteLead = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!id) {
        throw new Error('Lead ID is required');
    }
    await prismaClient_1.default.lead.delete({
        where: { id: parseInt(id) }
    });
    if (userId) {
        await prismaClient_1.default.activityLog.create({
            data: {
                userId,
                action: 'DELETED_LEAD',
                details: `Deleted lead ID: ${id}`
            }
        });
    }
    res.status(200).json({ message: 'Lead deleted successfully' });
});
exports.getLeadLogs = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const logs = await prismaClient_1.default.activityLog.findMany({
        where: { leadId: parseInt(id, 10) },
        orderBy: { createdAt: 'desc' },
        include: {
            user: {
                select: {
                    name: true,
                    role: {
                        select: { name: true }
                    }
                }
            }
        }
    });
    res.status(200).json({ data: logs, message: 'Logs retrieved successfully' });
});
exports.getFilterOptions = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const stateQuery = req.query.state;
    // Fetch distinct states
    const statesObj = await prismaClient_1.default.lead.findMany({
        where: { state: { not: null } },
        select: { state: true },
        distinct: ['state'],
        orderBy: { state: 'asc' }
    });
    // Fetch distinct cities
    const citiesObj = await prismaClient_1.default.lead.findMany({
        where: {
            city: { not: null },
            ...(stateQuery && stateQuery !== 'All' ? { state: stateQuery } : {})
        },
        select: { city: true },
        distinct: ['city'],
        orderBy: { city: 'asc' }
    });
    // Fetch distinct types (Entity Types)
    const typesObj = await prismaClient_1.default.lead.findMany({
        select: { type: true },
        distinct: ['type'],
        orderBy: { type: 'asc' }
    });
    // Fetch distinct exchanges
    const exchangesObj = await prismaClient_1.default.lead.findMany({
        where: {
            exchangeName: { not: null },
            NOT: { exchangeName: '' }
        },
        select: { exchangeName: true },
        distinct: ['exchangeName'],
        orderBy: { exchangeName: 'asc' }
    });
    const states = statesObj.map(s => s.state).filter(Boolean);
    const cities = citiesObj.map(c => c.city).filter(Boolean);
    const types = typesObj.map(t => t.type).filter(Boolean);
    const exchanges = exchangesObj.map(e => e.exchangeName).filter(Boolean);
    res.status(200).json({ data: { states, cities, types, exchanges }, message: 'Filter options retrieved' });
});
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ExcelJS = __importStar(require("exceljs"));
const XLSX = __importStar(require("xlsx"));
exports.uploadChunk = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const file = req.file;
    const { filename, chunkIndex, totalChunks } = req.body;
    if (!file)
        throw new Error('Chunk file missing');
    const uploadDir = path_1.default.join(process.cwd(), 'uploads');
    const tempFilePath = path_1.default.join(uploadDir, `${filename}.tmp`);
    // Append chunk to temp file
    const chunkData = fs_1.default.readFileSync(file.path);
    fs_1.default.appendFileSync(tempFilePath, chunkData);
    fs_1.default.unlinkSync(file.path); // Delete multer's uploaded chunk
    if (Number(chunkIndex) === Number(totalChunks) - 1) {
        // Final chunk
        const finalFilePath = path_1.default.join(uploadDir, filename);
        fs_1.default.renameSync(tempFilePath, finalFilePath);
        res.status(200).json({ message: 'File upload complete', filename });
    }
    else {
        res.status(200).json({ message: 'Chunk received' });
    }
});
exports.processFile = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { filename, entityType, mappings } = req.body;
    const userId = req.user?.id;
    const filePath = path_1.default.join(process.cwd(), 'uploads', filename);
    if (!fs_1.default.existsSync(filePath)) {
        throw new Error('File not found on server');
    }
    // Determine file type (CSV, XLS, or XLSX)
    const lowerName = filename.toLowerCase();
    const isCsv = lowerName.endsWith('.csv');
    const isXls = lowerName.endsWith('.xls');
    let importedCount = 0;
    let batch = [];
    const BATCH_SIZE = 5000;
    const insertBatch = async () => {
        if (batch.length > 0) {
            const result = await prismaClient_1.default.lead.createMany({
                data: batch,
                skipDuplicates: true
            });
            importedCount += result.count;
            batch = [];
        }
    };
    try {
        if (isCsv) {
            throw new Error('CSV stream parsing not yet implemented, please use XLSX or XLS.');
        }
        else if (isXls) {
            // Old .xls files cannot be streamed (binary OLE format). We must use SheetJS in memory.
            const workbook = XLSX.readFile(filePath);
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            let isHeaderFound = false;
            let headerRowNumber = 1;
            for (let i = 0; i < rawJson.length; i++) {
                const rowValues = rawJson[i];
                if (!isHeaderFound) {
                    if (rowValues && rowValues.length > 0) {
                        const rowStrings = rowValues.map(v => String(v || '').trim().toLowerCase());
                        if (rowStrings.some(c => c.includes('name') || c.includes('email') || c.includes('registration'))) {
                            isHeaderFound = true;
                            headerRowNumber = i;
                        }
                    }
                    continue;
                }
                // Map row using indices provided by frontend
                const getVal = (idx) => idx !== undefined && rowValues[idx] ? String(rowValues[idx]).trim() : undefined;
                const name = getVal(mappings.nameCol);
                if (!name || name === 'Unknown Entity' || name === '')
                    continue; // Skip empty rows
                batch.push({
                    name,
                    registrationNo: getVal(mappings.regNoCol),
                    contactPerson: getVal(mappings.contactPersonCol),
                    email: getVal(mappings.emailCol),
                    phone: getVal(mappings.phoneCol),
                    city: getVal(mappings.cityCol),
                    state: getVal(mappings.stateCol),
                    pincode: getVal(mappings.pincodeCol),
                    address: getVal(mappings.addressCol),
                    fax: getVal(mappings.faxCol),
                    validity: getVal(mappings.validityCol),
                    exchangeName: getVal(mappings.exchangeNameCol),
                    tradeName: getVal(mappings.tradeNameCol),
                    source: 'IMPORT',
                    type: entityType || 'Manual',
                    salesStage: 'New',
                    verificationStatus: 'Imported',
                    engagementStatus: 'Not Engaged',
                    consentStatus: 'Unknown'
                });
                if (batch.length >= BATCH_SIZE) {
                    await insertBatch();
                }
            }
            // Insert remaining
            await insertBatch();
        }
        else {
            // .xlsx processing using streaming
            const options = {
                sharedStrings: 'cache',
                hyperlinks: 'ignore',
                worksheets: 'emit'
            };
            const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, options);
            let isHeaderFound = false;
            let headerRowNumber = 1;
            for await (const worksheetReader of workbookReader) {
                for await (const row of worksheetReader) {
                    if (!isHeaderFound) {
                        // Check if this row looks like the header based on mappings
                        const rowValues = row.values;
                        if (rowValues && rowValues.length > 0) {
                            const rowStrings = rowValues.map(v => String(v || '').trim().toLowerCase());
                            if (rowStrings.some(c => c.includes('name') || c.includes('email') || c.includes('registration'))) {
                                isHeaderFound = true;
                                headerRowNumber = row.number;
                            }
                        }
                        continue;
                    }
                    if (row.number > headerRowNumber) {
                        const rowValues = row.values;
                        // Map row using indices provided by frontend
                        const getVal = (idx) => idx !== undefined && rowValues[idx + 1] ? String(rowValues[idx + 1]).trim() : undefined;
                        const name = getVal(mappings.nameCol);
                        if (!name || name === 'Unknown Entity' || name === '')
                            continue; // Skip empty rows
                        batch.push({
                            name,
                            registrationNo: getVal(mappings.regNoCol),
                            contactPerson: getVal(mappings.contactPersonCol),
                            email: getVal(mappings.emailCol),
                            phone: getVal(mappings.phoneCol),
                            city: getVal(mappings.cityCol),
                            state: getVal(mappings.stateCol),
                            pincode: getVal(mappings.pincodeCol),
                            address: getVal(mappings.addressCol),
                            fax: getVal(mappings.faxCol),
                            validity: getVal(mappings.validityCol),
                            exchangeName: getVal(mappings.exchangeNameCol),
                            tradeName: getVal(mappings.tradeNameCol),
                            source: 'IMPORT',
                            type: entityType || 'Manual',
                            salesStage: 'New',
                            verificationStatus: 'Imported',
                            engagementStatus: 'Not Engaged',
                            consentStatus: 'Unknown'
                        });
                        if (batch.length >= BATCH_SIZE) {
                            await insertBatch();
                        }
                    }
                }
                break; // Only parse the first worksheet
            }
            // Insert remaining
            await insertBatch();
        }
    }
    catch (error) {
        throw new Error(`Failed to process streaming file: ${error.message}`);
    }
    finally {
        // Delete file to save space
        if (fs_1.default.existsSync(filePath)) {
            fs_1.default.unlinkSync(filePath);
        }
    }
    if (userId && importedCount > 0) {
        await prismaClient_1.default.activityLog.create({
            data: {
                userId,
                action: 'IMPORTED_LEADS',
                details: `Imported ${importedCount} leads via streaming file upload`,
            }
        });
    }
    res.status(200).json({ message: 'File processed and leads imported successfully', count: importedCount });
});
