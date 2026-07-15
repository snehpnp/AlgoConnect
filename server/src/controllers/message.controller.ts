import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getCampaignMessages = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const messages = await prisma.messageSend.findMany({
      where: { campaignId: Number(id) },
      include: {
        lead: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ data: messages });
  } catch (error) {
    console.error('Error fetching campaign messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMessageDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const message = await prisma.messageSend.findUnique({
      where: { id: Number(id) },
      include: {
        lead: true,
        events: { orderBy: { eventTime: 'desc' } },
        replies: { orderBy: { receivedAt: 'desc' } },
        linkTrackings: true
      }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    res.status(200).json({ data: message });
  } catch (error) {
    console.error('Error fetching message details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getEmailAnalytics = async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.query;
    const whereClause = campaignId ? { campaignId: Number(campaignId) } : {};

    const [total, delivered, opened, clicked, replied, bounced, failed] = await Promise.all([
      prisma.messageSend.count({ where: whereClause }),
      prisma.messageSend.count({ where: { ...whereClause, deliveredAt: { not: null } } }),
      prisma.messageSend.count({ where: { ...whereClause, openedAt: { not: null } } }),
      prisma.messageSend.count({ where: { ...whereClause, clickedAt: { not: null } } }),
      prisma.messageSend.count({ where: { ...whereClause, repliedAt: { not: null } } }),
      prisma.messageSend.count({ where: { ...whereClause, bouncedAt: { not: null } } }),
      prisma.messageSend.count({ where: { ...whereClause, status: 'FAILED' } })
    ]);

    res.status(200).json({
      data: {
        total,
        delivered,
        opened,
        clicked,
        replied,
        bounced,
        failed,
        openRate: total > 0 ? (opened / total) * 100 : 0,
        clickRate: total > 0 ? (clicked / total) * 100 : 0,
        replyRate: total > 0 ? (replied / total) * 100 : 0,
        bounceRate: total > 0 ? (bounced / total) * 100 : 0,
      }
    });
  } catch (error) {
    console.error('Error fetching email analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const simulateSend = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // campaignId
    
    // In a real app, this queues a job. Here we just mock sending.
    const campaign = await prisma.campaign.findUnique({
      where: { id: Number(id) },
      include: { leads: true }
    });

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    for (const lead of campaign.leads) {
      await prisma.messageSend.create({
        data: {
          campaignId: campaign.id,
          leadId: lead.id,
          channel: 'EMAIL',
          subject: campaign.name, // using campaign name as mock subject
          status: 'QUEUED',
          providerMessageId: `mock-id-${campaign.id}-${lead.id}-${Date.now()}`
        }
      });
    }

    res.status(200).json({ message: `Queued ${campaign.leads.length} messages for sending.` });
  } catch (error) {
    console.error('Error simulating send:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getLeadMessages = async (req: Request, res: Response) => {
  try {
    const { leadId } = req.params;
    const messages = await prisma.messageSend.findMany({
      where: { leadId: Number(leadId) },
      include: {
        campaign: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ data: messages });
  } catch (error) {
    console.error('Error fetching lead messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
