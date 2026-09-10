"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuditLogFilters = exports.getAuditLogs = void 0;
const prismaClient_1 = __importDefault(require("../models/prismaClient"));
const asyncHandler_1 = require("../utils/asyncHandler");
exports.getAuditLogs = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { search, action, userId, startDate, endDate } = req.query;
    let where = {};
    if (search) {
        where.OR = [
            { details: { contains: search } },
            { action: { contains: search } }
        ];
    }
    if (action && action !== 'All') {
        where.action = action;
    }
    if (userId && userId !== 'All') {
        where.userId = parseInt(userId);
    }
    if (startDate && endDate) {
        where.createdAt = {
            gte: new Date(startDate),
            lte: new Date(endDate)
        };
    }
    const [logs, total] = await Promise.all([
        prismaClient_1.default.activityLog.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { id: true, name: true, email: true } },
                lead: { select: { id: true, name: true } }
            }
        }),
        prismaClient_1.default.activityLog.count({ where })
    ]);
    res.status(200).json({
        message: 'Audit logs retrieved successfully',
        data: logs,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    });
});
exports.getAuditLogFilters = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const [users, actions] = await Promise.all([
        prismaClient_1.default.user.findMany({ select: { id: true, name: true } }),
        prismaClient_1.default.activityLog.findMany({
            select: { action: true },
            distinct: ['action']
        })
    ]);
    res.status(200).json({
        message: 'Audit log filters retrieved',
        data: {
            users,
            actions: actions.map(a => a.action)
        }
    });
});
