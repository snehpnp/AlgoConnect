import { Request, Response } from 'express';
import prisma from '../models/prismaClient';
import { asyncHandler } from '../utils/asyncHandler';

export const getAutomations = asyncHandler(async (req: Request, res: Response) => {
  const { campaignId } = req.query;
  const whereClause = campaignId ? { campaignId: parseInt(campaignId as string) } : {};
  
  const automations = await prisma.campaignAutomation.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    include: {
      campaign: { select: { id: true, name: true } }
    }
  });
  res.status(200).json({ data: automations, message: 'Automations retrieved successfully' });
});

export const createAutomation = asyncHandler(async (req: Request, res: Response) => {
  const { name, campaignId, trigger, waitTime, condition, action, status } = req.body;

  if (!name || !campaignId || !trigger || !action) {
    throw new Error('Name, campaignId, trigger, and action are required');
  }

  const automation = await prisma.campaignAutomation.create({
    data: { 
      name, 
      campaignId: parseInt(campaignId), 
      trigger, 
      waitTime: waitTime ? parseInt(waitTime) : null,
      condition,
      action,
      status: status || 'ACTIVE'
    }
  });

  res.status(201).json({ message: 'Automation created successfully', data: automation });
});

export const updateAutomation = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, trigger, waitTime, condition, action, status } = req.body;

  const dataToUpdate: any = { name, trigger, condition, action, status };
  if (waitTime !== undefined) dataToUpdate.waitTime = waitTime ? parseInt(waitTime) : null;

  const automation = await prisma.campaignAutomation.update({
    where: { id: parseInt(id as string) },
    data: dataToUpdate
  });

  res.status(200).json({ message: 'Automation updated successfully', data: automation });
});

export const deleteAutomation = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  await prisma.campaignAutomation.delete({
    where: { id: parseInt(id as string) }
  });

  res.status(200).json({ message: 'Automation deleted successfully' });
});
