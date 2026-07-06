import { Request, Response } from 'express';
import prisma from '../models/prismaClient';
import { asyncHandler } from '../utils/asyncHandler';

export const getCampaigns = asyncHandler(async (req: Request, res: Response) => {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.status(200).json({ data: campaigns, message: 'Campaigns retrieved successfully' });
});

export const createCampaign = asyncHandler(async (req: Request, res: Response) => {
  const { name, type, status } = req.body;

  if (!name || !type) {
    throw new Error('Name and type are required');
  }

  const newCampaign = await prisma.campaign.create({
    data: { name, type, status: status || 'DRAFT' }
  });

  res.status(201).json({ message: 'Campaign created successfully', data: newCampaign });
});
