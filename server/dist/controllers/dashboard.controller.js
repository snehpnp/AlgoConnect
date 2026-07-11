"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardStats = void 0;
const prismaClient_1 = __importDefault(require("../models/prismaClient"));
const asyncHandler_1 = require("../utils/asyncHandler");
exports.getDashboardStats = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    // 1. Total Leads
    const totalLeads = await prismaClient_1.default.lead.count();
    // 2. Leads by Sales Stage
    const newLeads = await prismaClient_1.default.lead.count({ where: { salesStage: 'New' } });
    const contactedLeads = await prismaClient_1.default.lead.count({ where: { salesStage: 'Contacted' } });
    const qualifiedLeads = await prismaClient_1.default.lead.count({ where: { salesStage: 'Qualified' } });
    const convertedLeads = await prismaClient_1.default.lead.count({ where: { salesStage: 'Client Won' } });
    // 3. Leads by Verification
    const unverifiedLeads = await prismaClient_1.default.lead.count({ where: { verificationStatus: 'Unverified' } });
    const activeLeads = await prismaClient_1.default.lead.count({ where: { verificationStatus: 'Active' } });
    // 4. Leads by Engagement
    const engagedLeads = await prismaClient_1.default.lead.count({
        where: {
            engagementStatus: { in: ['Opened', 'Clicked', 'Replied', 'Demo Requested'] }
        }
    });
    // 5. Active Campaigns
    const activeCampaigns = await prismaClient_1.default.campaign.count({ where: { status: 'ACTIVE' } });
    // 6. Leads by Type
    const leadsByTypeRaw = await prismaClient_1.default.lead.groupBy({
        by: ['type'],
        _count: {
            type: true
        }
    });
    const leadTypes = leadsByTypeRaw.map(item => ({
        type: item.type,
        count: item._count.type
    }));
    // 6. Monthly analytics placeholder
    const monthlyAnalytics = [
        { label: 'Jan', value: '0%' },
        { label: 'Feb', value: '0%' },
        { label: 'Mar', value: '0%' },
        { label: 'Apr', value: '0%' },
        { label: 'May', value: '50%' },
        { label: 'Jun', value: '100%' },
    ];
    // 7. Recent Activities
    const recentActivities = await prismaClient_1.default.activityLog.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({
        data: {
            stats: {
                totalLeads,
                newLeads,
                contactedLeads,
                qualifiedLeads,
                convertedLeads,
                unverifiedLeads,
                activeLeads,
                engagedLeads,
                activeCampaigns
            },
            leadTypes,
            analytics: monthlyAnalytics,
            activities: recentActivities
        },
        message: 'Dashboard stats retrieved successfully'
    });
});
