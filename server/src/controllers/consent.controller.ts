import { Request, Response } from 'express';
import prisma from '../models/prismaClient';
import { asyncHandler } from '../utils/asyncHandler';

export const getConsents = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const search = (req.query.search as string) || '';
  const dncFilter = (req.query.dncFilter as string) || 'All';
  const typeFilter = (req.query.typeFilter as string) || 'All';
  const consentFilter = (req.query.consentFilter as string) || 'All';

  const skip = (page - 1) * limit;

  const where: any = {};
  
  if (typeFilter !== 'All') {
    where.type = typeFilter;
  }
  
  if (consentFilter === 'Selected') {
    where.consents = { some: {} };
  } else if (consentFilter === 'Not Selected') {
    where.consents = { none: {} };
  }
  
  if (dncFilter === 'DNC Active') {
    where.consents = {
      ...(where.consents || {}),
      some: {
        ...(where.consents?.some || {}),
        channel: 'DNC',
        status: 'OPT_IN'
      }
    };
  } else if (dncFilter === 'Allowed') {
    where.consents = {
      ...(where.consents || {}),
      none: {
        ...(where.consents?.none || {}),
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
        updatedAt: 'desc'
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
  
  // Touch the lead to update its updatedAt timestamp
  await prisma.lead.update({
    where: { id: leadIdNum },
    data: { updatedAt: new Date() }
  });

  res.status(200).json({ message: 'Consent updated successfully' });
});
