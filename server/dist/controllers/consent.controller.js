"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateConsent = exports.getConsents = void 0;
const prismaClient_1 = __importDefault(require("../models/prismaClient"));
const asyncHandler_1 = require("../utils/asyncHandler");
exports.getConsents = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';
    const dncFilter = req.query.dncFilter || 'All';
    const typeFilter = req.query.typeFilter || 'All';
    const consentFilter = req.query.consentFilter || 'All';
    const skip = (page - 1) * limit;
    const where = {};
    if (typeFilter !== 'All') {
        where.type = typeFilter;
    }
    if (consentFilter === 'Selected') {
        where.consents = { some: {} };
    }
    else if (consentFilter === 'Not Selected') {
        where.consents = { none: {} };
    }
    if (dncFilter === 'DNC Active') {
        where.consents = {
            ...(where.consents || {}),
            some: {
                ...(where.consents?.some || {}),
                channel: 'DNC',
                status: 'OPT_IN'
            }
        };
    }
    else if (dncFilter === 'Allowed') {
        where.consents = {
            ...(where.consents || {}),
            none: {
                ...(where.consents?.none || {}),
                channel: 'DNC',
                status: 'OPT_IN'
            }
        };
    }
    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { phone2: { contains: search, mode: 'insensitive' } },
            { address: { contains: search, mode: 'insensitive' } },
            { city: { contains: search, mode: 'insensitive' } },
            { state: { contains: search, mode: 'insensitive' } }
        ];
    }
    const [leads, total] = await Promise.all([
        prismaClient_1.default.lead.findMany({
            where,
            include: {
                consents: true
            },
            orderBy: {
                updatedAt: 'desc'
            },
            skip,
            take: limit
        }),
        prismaClient_1.default.lead.count({ where })
    ]);
    res.status(200).json({
        data: leads,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    });
});
exports.updateConsent = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { leadId } = req.params;
    const { channel, status } = req.body;
    if (!channel || !status) {
        throw new Error('Channel and status are required');
    }
    const leadIdNum = parseInt(leadId);
    // Check if consent record exists for this channel
    const existingConsent = await prismaClient_1.default.consent.findFirst({
        where: {
            leadId: leadIdNum,
            channel: channel
        }
    });
    if (existingConsent) {
        await prismaClient_1.default.consent.update({
            where: { id: existingConsent.id },
            data: { status }
        });
    }
    else {
        await prismaClient_1.default.consent.create({
            data: {
                leadId: leadIdNum,
                channel,
                status
            }
        });
    }
    // Touch the lead to update its updatedAt timestamp
    await prismaClient_1.default.lead.update({
        where: { id: leadIdNum },
        data: { updatedAt: new Date() }
    });
    res.status(200).json({ message: 'Consent updated successfully' });
});
