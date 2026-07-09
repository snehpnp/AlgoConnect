"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSegmentLeads = exports.deleteSegment = exports.previewSegment = exports.getSegments = exports.createSegment = void 0;
const prismaClient_1 = __importDefault(require("../models/prismaClient"));
const asyncHandler_1 = require("../utils/asyncHandler");
exports.createSegment = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { name, description, rules } = req.body;
    if (!name || !rules) {
        throw new Error('Name and rules are required');
    }
    const segment = await prismaClient_1.default.segment.create({
        data: { name, description, rules }
    });
    res.status(201).json({ message: 'Segment created successfully', data: segment });
});
exports.getSegments = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const segments = await prismaClient_1.default.segment.findMany({
        orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ data: segments, message: 'Segments retrieved successfully' });
});
exports.previewSegment = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { rules } = req.body;
    if (!rules) {
        throw new Error('Rules are required to preview a segment size');
    }
    // Convert the JSON rules to a Prisma "where" object dynamically
    // This is a basic implementation to be expanded upon based on rules structure.
    const whereClause = {};
    if (rules.entityType && rules.entityType !== 'All')
        whereClause.type = rules.entityType;
    if (rules.region && rules.region !== 'All')
        whereClause.state = { equals: rules.region, mode: 'insensitive' };
    if (rules.city && rules.city !== 'All')
        whereClause.city = { equals: rules.city, mode: 'insensitive' };
    if (rules.activityStatus && rules.activityStatus !== 'All')
        whereClause.verificationStatus = rules.activityStatus;
    const [count, leads] = await Promise.all([
        prismaClient_1.default.lead.count({ where: whereClause }),
        prismaClient_1.default.lead.findMany({ where: whereClause, take: 50, orderBy: { createdAt: 'desc' } })
    ]);
    res.status(200).json({ data: { count, leads }, message: 'Segment size calculated successfully' });
});
exports.deleteSegment = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    await prismaClient_1.default.segment.delete({
        where: { id: parseInt(id) }
    });
    res.status(200).json({ message: 'Segment deleted successfully' });
});
exports.getSegmentLeads = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const segment = await prismaClient_1.default.segment.findUnique({
        where: { id: parseInt(id) }
    });
    if (!segment) {
        throw new Error('Segment not found');
    }
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
    const leads = await prismaClient_1.default.lead.findMany({
        where: whereClause,
        take: 50, // preview limit
        orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ data: leads, message: 'Segment leads retrieved' });
});
