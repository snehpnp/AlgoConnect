import { Request, Response } from 'express';
import prisma from '../models/prismaClient';
import { asyncHandler } from '../utils/asyncHandler';

export const getCampaigns = asyncHandler(async (req: Request, res: Response) => {
  const campaigns = await prisma.campaign.findMany({
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

export const getCampaignById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const campaign = await prisma.campaign.findUnique({
    where: { id: parseInt(id as string) },
    include: {
      segments: { select: { id: true, name: true } },
      automations: true,
      _count: { select: { leads: true } }
    }
  });

  if (!campaign) {
    throw new Error('Campaign not found');
  }
  res.status(200).json({ data: campaign, message: 'Campaign retrieved successfully' });
});

export const createCampaign = asyncHandler(async (req: Request, res: Response) => {
  const { name, type, status, segmentIds, description, channels, schedule, emailTemplateId, whatsappTemplateId, smsTemplateId } = req.body;

  if (!name || !type) {
    throw new Error('Name and type are required');
  }

  const data: any = { 
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
    const segments = await prisma.segment.findMany({ 
      where: { id: { in: segmentIds.map(id => parseInt(id as any)) } } 
    });
    
    if (segments.length > 0) {
      // Connect segments to campaign
      data.segments = {
        connect: segments.map(s => ({ id: s.id }))
      };

      // Combine where clauses for all selected segments using OR
      const orClauses: any[] = [];

      for (const segment of segments) {
        const rules = segment.rules as any || {};
        const whereClause: any = {};
        
        if (rules.entityType && rules.entityType !== 'All') whereClause.type = rules.entityType;
        if (rules.region && rules.region !== 'All') whereClause.state = { equals: rules.region, mode: 'insensitive' };
        if (rules.city && rules.city !== 'All') whereClause.city = { equals: rules.city, mode: 'insensitive' };
        if (rules.activityStatus && rules.activityStatus !== 'All') whereClause.verificationStatus = rules.activityStatus;

        if (Object.keys(whereClause).length > 0) {
          orClauses.push(whereClause);
        }
      }

      const matchingLeads = await prisma.lead.findMany({
        where: orClauses.length > 0 ? { OR: orClauses } : {},
        select: { id: true }
      });

      if (matchingLeads.length > 0) {
        data.leads = {
          connect: matchingLeads
        };
      }
    }
  }

  const newCampaign = await prisma.campaign.create({
    data,
    include: {
      segments: { select: { id: true, name: true } },
      _count: { select: { leads: true } }
    }
  });

  res.status(201).json({ message: 'Campaign created successfully', data: newCampaign });
});

export const updateCampaign = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, type, status, segmentIds, description, channels, schedule, emailTemplateId, whatsappTemplateId, smsTemplateId } = req.body;

  const dataToUpdate: any = { name, type, status, description, channels };
  if (schedule !== undefined) dataToUpdate.schedule = schedule ? new Date(schedule) : null;
  if (emailTemplateId !== undefined) dataToUpdate.emailTemplateId = emailTemplateId ? parseInt(emailTemplateId) : null;
  if (whatsappTemplateId !== undefined) dataToUpdate.whatsappTemplateId = whatsappTemplateId ? parseInt(whatsappTemplateId) : null;
  if (smsTemplateId !== undefined) dataToUpdate.smsTemplateId = smsTemplateId ? parseInt(smsTemplateId) : null;

  if (segmentIds !== undefined) {
    if (Array.isArray(segmentIds) && segmentIds.length > 0) {
      const segments = await prisma.segment.findMany({ 
        where: { id: { in: segmentIds.map(id => parseInt(id as any)) } } 
      });
      
      if (segments.length > 0) {
        // Sync segments
        dataToUpdate.segments = {
          set: segments.map(s => ({ id: s.id }))
        };

        const orClauses: any[] = [];
        for (const segment of segments) {
          const rules = segment.rules as any || {};
          const whereClause: any = {};
          
          if (rules.entityType && rules.entityType !== 'All') whereClause.type = rules.entityType;
          if (rules.region && rules.region !== 'All') whereClause.state = { equals: rules.region, mode: 'insensitive' };
          if (rules.city && rules.city !== 'All') whereClause.city = { equals: rules.city, mode: 'insensitive' };
          if (rules.activityStatus && rules.activityStatus !== 'All') whereClause.verificationStatus = rules.activityStatus;

          if (Object.keys(whereClause).length > 0) {
            orClauses.push(whereClause);
          }
        }

        const matchingLeads = await prisma.lead.findMany({
          where: orClauses.length > 0 ? { OR: orClauses } : {},
          select: { id: true }
        });

        dataToUpdate.leads = {
          set: matchingLeads
        };
      }
    } else {
      // Clear segments and leads
      dataToUpdate.segments = { set: [] };
      dataToUpdate.leads = { set: [] };
    }
  }

  const campaign = await prisma.campaign.update({
    where: { id: parseInt(id as string) },
    data: dataToUpdate,
    include: {
      segments: { select: { id: true, name: true } },
      _count: { select: { leads: true } }
    }
  });

  res.status(200).json({ message: 'Campaign updated successfully', data: campaign });
});

export const deleteCampaign = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  await prisma.campaign.delete({
    where: { id: parseInt(id as string) }
  });

  res.status(200).json({ message: 'Campaign deleted successfully' });
});

export const addLeadsToCampaign = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { leadIds } = req.body;

  if (!leadIds || !Array.isArray(leadIds)) {
    throw new Error('leadIds must be an array');
  }

  const campaign = await prisma.campaign.update({
    where: { id: parseInt(id as string) },
    data: {
      leads: {
        connect: leadIds.map((leadId: number) => ({ id: leadId }))
      }
    },
    include: {
      _count: { select: { leads: true } }
    }
  });

  res.status(200).json({ message: 'Leads added to campaign successfully', data: campaign });
});

export const removeLeadFromCampaign = asyncHandler(async (req: Request, res: Response) => {
  const { id, leadId } = req.params;

  const campaign = await prisma.campaign.update({
    where: { id: parseInt(id as string) },
    data: {
      leads: {
        disconnect: { id: parseInt(leadId as string) }
      }
    },
    include: {
      _count: { select: { leads: true } }
    }
  });

  res.status(200).json({ message: 'Lead removed from campaign successfully', data: campaign });
});

export const getCampaignStats = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const engagements = await prisma.engagementEvent.groupBy({
    by: ['eventType'],
    where: { campaignId: parseInt(id as string) },
    _count: {
      eventType: true
    }
  });

  res.status(200).json({ data: { sends: [], engagements } });
});

import { toggleEngine, getEngineState } from '../services/campaignRunner.service';

export const getEngineStatus = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json({ data: { isRunning: getEngineState() } });
});

export const toggleEngineStatus = asyncHandler(async (req: Request, res: Response) => {
  const { isRunning } = req.body;
  const newState = toggleEngine(isRunning);
  res.status(200).json({ data: { isRunning: newState }, message: newState ? 'Engine started' : 'Engine stopped' });
});
