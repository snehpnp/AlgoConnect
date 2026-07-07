import { Request, Response } from 'express';
import prisma from '../models/prismaClient';
import { asyncHandler } from '../utils/asyncHandler';

export const getConsents = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const search = (req.query.search as string) || '';
  const dncFilter = (req.query.dncFilter as string) || 'All';

  const skip = (page - 1) * limit;

  const where: any = {};
  
  if (dncFilter === 'DNC Active') {
    where.consents = {
      some: {
        channel: 'DNC',
        status: 'OPT_IN'
      }
    };
  } else if (dncFilter === 'Allowed') {
    where.consents = {
      none: {
        channel: 'DNC',
        status: 'OPT_IN'
      }
    };
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { phone2: { contains: search, mode: 'insensitive' } },
      { address: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
      { state: { contains: search, mode: 'insensitive' } }
    ];
  }

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        consents: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    }),
    prisma.lead.count({ where })
  ]);

  res.status(200).json({ 
    data: leads,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  });
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
