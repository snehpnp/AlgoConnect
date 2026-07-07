import { Request, Response } from 'express';
import prisma from '../models/prismaClient';
import { asyncHandler } from '../utils/asyncHandler';

export const getConsents = asyncHandler(async (req: Request, res: Response) => {
  const { search = '' } = req.query;

  const leads = await prisma.lead.findMany({
    where: {
      OR: [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } }
      ]
    },
    include: {
      consents: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 100 // Limit for simplicity, add pagination in prod
  });

  res.status(200).json({ data: leads });
});

export const updateConsent = asyncHandler(async (req: Request, res: Response) => {
  const { leadId } = req.params;
  const { channel, status } = req.body;

  if (!channel || !status) {
    throw new Error('Channel and status are required');
  }

  const leadIdNum = parseInt(leadId as string);

  // Check if consent record exists for this channel
  const existingConsent = await prisma.consent.findFirst({
    where: {
      leadId: leadIdNum,
      channel: channel
    }
  });

  if (existingConsent) {
    await prisma.consent.update({
      where: { id: existingConsent.id },
      data: { status }
    });
  } else {
    await prisma.consent.create({
      data: {
        leadId: leadIdNum,
        channel,
        status
      }
    });
  }

  res.status(200).json({ message: 'Consent updated successfully' });
});
