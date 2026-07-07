import { Request, Response } from 'express';
import prisma from '../models/prismaClient';
import { asyncHandler } from '../utils/asyncHandler';

export const getCampaigns = asyncHandler(async (req: Request, res: Response) => {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      segment: { select: { id: true, name: true } },
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
      segment: { select: { id: true, name: true } },
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
  const { name, type, status, segmentId, description, channels, schedule, emailTemplateId, whatsappTemplateId, smsTemplateId } = req.body;

  if (!name || !type) {
    throw new Error('Name and type are required');
  }

  const newCampaign = await prisma.campaign.create({
    data: { 
      name, 
      description,
      type, 
      channels,
      status: status || 'DRAFT',
      schedule: schedule ? new Date(schedule) : null,
      segmentId: segmentId ? parseInt(segmentId) : null,
      emailTemplateId: emailTemplateId ? parseInt(emailTemplateId) : null,
      whatsappTemplateId: whatsappTemplateId ? parseInt(whatsappTemplateId) : null,
      smsTemplateId: smsTemplateId ? parseInt(smsTemplateId) : null
    },
    include: {
      segment: { select: { id: true, name: true } }
    }
  });

  res.status(201).json({ message: 'Campaign created successfully', data: newCampaign });
});

export const updateCampaign = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, type, status, segmentId, description, channels, schedule, emailTemplateId, whatsappTemplateId, smsTemplateId } = req.body;

  const dataToUpdate: any = { name, type, status, description, channels };
  if (schedule !== undefined) dataToUpdate.schedule = schedule ? new Date(schedule) : null;
  if (segmentId !== undefined) {
    dataToUpdate.segmentId = segmentId ? parseInt(segmentId) : null;
  }
  if (emailTemplateId !== undefined) dataToUpdate.emailTemplateId = emailTemplateId ? parseInt(emailTemplateId) : null;
  if (whatsappTemplateId !== undefined) dataToUpdate.whatsappTemplateId = whatsappTemplateId ? parseInt(whatsappTemplateId) : null;
  if (smsTemplateId !== undefined) dataToUpdate.smsTemplateId = smsTemplateId ? parseInt(smsTemplateId) : null;

  const campaign = await prisma.campaign.update({
    where: { id: parseInt(id as string) },
    data: dataToUpdate,
    include: {
      segment: { select: { id: true, name: true } },
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
