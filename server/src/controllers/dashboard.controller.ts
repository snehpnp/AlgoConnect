import { Request, Response } from 'express';
import prisma from '../models/prismaClient';
import { asyncHandler } from '../utils/asyncHandler';

export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
  // 1. Total Leads
  const totalLeads = await prisma.lead.count();

  // 2. Leads by Sales Stage
  const newLeads = await prisma.lead.count({ where: { salesStage: 'New' } });
  const contactedLeads = await prisma.lead.count({ where: { salesStage: 'Contacted' } });
  const qualifiedLeads = await prisma.lead.count({ where: { salesStage: 'Qualified' } });
  const convertedLeads = await prisma.lead.count({ where: { salesStage: 'Client Won' } });

  // 3. Leads by Verification
  const unverifiedLeads = await prisma.lead.count({ where: { verificationStatus: 'Unverified' } });
  const activeLeads = await prisma.lead.count({ where: { verificationStatus: 'Active' } });

  // 4. Leads by Engagement
  const engagedLeads = await prisma.lead.count({ 
    where: { 
      engagementStatus: { in: ['Opened', 'Clicked', 'Replied', 'Demo Requested'] } 
    } 
  });

  // 5. Active Campaigns
  const activeCampaigns = await prisma.campaign.count({ where: { status: 'ACTIVE' } });

  // 6. Leads by Type
  const leadsByTypeRaw = await prisma.lead.groupBy({
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
  const recentActivities = await prisma.activityLog.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' }
  });

  // 8. Recent Communications (Trace)
  const recentCommunicationsRaw = await prisma.engagementEvent.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      messageSend: {
        include: {
          lead: { select: { id: true, name: true, email: true, phone: true } },
          campaign: { select: { id: true, name: true, type: true } }
        }
      }
    }
  });

  const recentCommunications = recentCommunicationsRaw.map(event => ({
    ...event,
    lead: event.messageSend?.lead,
    campaign: event.messageSend?.campaign,
    channel: event.messageSend?.channel,
  }));

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
      activities: recentActivities,
      recentCommunications
    },
    message: 'Dashboard stats retrieved successfully'
  });
});
