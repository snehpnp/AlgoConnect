import { Request, Response } from 'express';
import prisma from '../models/prismaClient';
import { asyncHandler } from '../utils/asyncHandler';

export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
  // 1. Total Leads
  const totalLeads = await prisma.lead.count();

  // Sales Stage Pipeline (Kanban-synced) - uses salesStage, not status
  const leadsByStageRaw = await prisma.lead.groupBy({
    by: ['salesStage'],
    _count: { salesStage: true }
  });
  const leadsByStage = leadsByStageRaw.map(item => ({
    status: item.salesStage,
    count: item._count.salesStage
  })).sort((a, b) => {
    const order = ['New', 'Contacted', 'Follow-up', 'Qualified', 'Negotiation', 'Client Won', 'Client Lost', 'Do Not Contact'];
    return order.indexOf(a.status) - order.indexOf(b.status);
  });

  // Key metric counts (salesStage based for accuracy)
  const newLeads = await prisma.lead.count({ where: { salesStage: 'New' } });
  const contactedLeads = await prisma.lead.count({ where: { salesStage: { in: ['Contacted', 'Follow-up'] } } });
  const qualifiedLeads = await prisma.lead.count({ where: { salesStage: 'Qualified' } });
  const convertedLeads = await prisma.lead.count({ where: { salesStage: 'Client Won' } });
  const unverifiedLeads = await prisma.lead.count({ where: { verificationStatus: 'Unverified' } });
  const activeLeads = await prisma.lead.count({ where: { salesStage: { notIn: ['Client Won', 'Client Lost', 'Do Not Contact'] } } });
  const engagedLeads = await prisma.lead.count({ where: { engagementStatus: { not: 'Not Engaged' } } });

  // Today's Follow-Ups
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
  const todaysFollowUps = await prisma.lead.findMany({
    where: { nextFollowUpAt: { gte: startOfDay, lte: endOfDay } },
    select: { id: true, name: true, phone: true, salesStage: true, nextFollowUpAt: true, followUpNotes: true, user: { select: { name: true } } },
    take: 10
  });

  // Overdue follow-ups count
  const overdueFollowUpsCount = await prisma.lead.count({
    where: { nextFollowUpAt: { lt: startOfDay } }
  });

  // 5. Active Campaigns
  const activeCampaigns = await prisma.campaign.count({ where: { status: 'ACTIVE' } });

  // 6. Source Attribution (Win Rate)
  const leadsByTypeRaw = await prisma.lead.groupBy({
    by: ['type'],
    _count: { type: true }
  });
  
  // To get win rate per source, we need to count 'Client Won' leads per type
  const wonLeadsByTypeRaw = await prisma.lead.groupBy({
    by: ['type'],
    where: { salesStage: 'Client Won' },
    _count: { type: true }
  });
  
  const leadTypes = leadsByTypeRaw.map(item => {
    const wonData = wonLeadsByTypeRaw.find(w => w.type === item.type);
    const wonCount = wonData ? wonData._count.type : 0;
    return {
      type: item.type,
      count: item._count.type,
      wonCount,
      winRate: item._count.type > 0 ? (wonCount / item._count.type) * 100 : 0
    };
  });

  // 6.5 Top Campaigns (ROI)
  const campaignsRaw = await prisma.campaign.findMany({
    select: {
      id: true,
      name: true,
      type: true,
      _count: {
        select: {
          messageSends: true
        }
      }
    }
  });

  // We find leads that were created/won due to campaigns. 
  // In our DB, we can check how many "Client Won" leads have a MessageSend from a campaign, 
  // or just count engagement. For simplicity, we count "Replied" messages as a proxy for Campaign Success.
  const campaignSuccessRaw = await prisma.messageSend.groupBy({
    by: ['campaignId'],
    where: { status: 'REPLIED', campaignId: { not: null } },
    _count: { id: true }
  });

  const topCampaigns = campaignsRaw
    .filter(c => c._count.messageSends > 0)
    .map(c => {
      const successData = campaignSuccessRaw.find(s => s.campaignId === c.id);
      const successCount = successData ? successData._count.id : 0;
      return {
        id: c.id,
        name: c.name,
        type: c.type,
        totalSent: c._count.messageSends,
        successCount,
        conversionRate: (successCount / c._count.messageSends) * 100
      };
    })
    .sort((a, b) => b.conversionRate - a.conversionRate)
    .slice(0, 5);

  // 6.6 Sales Velocity (Average Time to Close)
  const wonLeadsList = await prisma.lead.findMany({
    where: { salesStage: 'Client Won' },
    select: { createdAt: true, updatedAt: true }
  });
  
  let averageTimeToClose = 0;
  if (wonLeadsList.length > 0) {
    const totalDays = wonLeadsList.reduce((acc, lead) => {
      const diffTime = Math.abs(lead.updatedAt.getTime() - lead.createdAt.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return acc + diffDays;
    }, 0);
    averageTimeToClose = Math.round(totalDays / wonLeadsList.length);
  }

  // 7. Monthly analytics placeholder
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

  // 9. Leaderboard / Gamification
  const usersWithLeads = await prisma.user.findMany({
    include: {
      leads: {
        select: { salesStage: true }
      },
      activityLogs: {
        select: { id: true }
      }
    }
  });
  
  const leaderboard = usersWithLeads.map(user => {
    const wonLeads = user.leads.filter(l => l.salesStage === 'Client Won').length;
    const activities = user.activityLogs.length;
    const score = (wonLeads * 50) + (activities * 5) + (user.leads.length * 2);
    
    return {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      totalLeads: user.leads.length,
      wonLeads,
      activities,
      score
    };
  }).sort((a, b) => b.score - a.score).slice(0, 10); // Top 10

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
      topCampaigns,
      averageTimeToClose,
      leadsByStatus: leadsByStage,  // Now synced with Kanban salesStage
      analytics: monthlyAnalytics,
      activities: recentActivities,
      recentCommunications,
      leaderboard,
      todaysFollowUps,
      overdueFollowUpsCount
    },
    message: 'Dashboard stats retrieved successfully'
  });
});
