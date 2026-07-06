import { Request, Response } from 'express';
import prisma from '../models/prismaClient';
import { asyncHandler } from '../utils/asyncHandler';

export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
  // 1. Total Leads
  const totalLeads = await prisma.lead.count();

  // 2. Leads by Status
  const qualifiedLeads = await prisma.lead.count({ where: { status: 'NEW' } });
  const pendingLeads = await prisma.lead.count({ where: { status: 'CONTACTED' } });
  const closedLeads = await prisma.lead.count({ where: { status: 'CONVERTED' } });

  // 3. Active Campaigns (Mocked calculation since campaigns aren't fully utilized yet)
  const activeCampaigns = await prisma.campaign.count({ where: { status: 'ACTIVE' } });

  // 4. Monthly analytics placeholder (we can just return recent months for the chart)
  const monthlyAnalytics = [
    { label: 'Jan', value: '0%' },
    { label: 'Feb', value: '0%' },
    { label: 'Mar', value: '0%' },
    { label: 'Apr', value: '0%' },
    { label: 'May', value: '50%' },
    { label: 'Jun', value: '100%' },
  ];

  // 5. Recent Activities
  const recentActivities = await prisma.activityLog.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' }
  });

  res.status(200).json({
    data: {
      stats: {
        totalLeads,
        qualifiedLeads,
        pendingLeads,
        closedLeads,
        activeCampaigns
      },
      analytics: monthlyAnalytics,
      activities: recentActivities
    },
    message: 'Dashboard stats retrieved successfully'
  });
});
