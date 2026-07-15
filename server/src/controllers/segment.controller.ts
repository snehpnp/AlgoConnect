import { Request, Response } from 'express';
import prisma from '../models/prismaClient';
import { asyncHandler } from '../utils/asyncHandler';

export const createSegment = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, rules } = req.body;

  if (!name || !rules) {
    throw new Error('Name and rules are required');
  }

  const segment = await prisma.segment.create({
    data: { name, description, rules }
  });

  res.status(201).json({ message: 'Segment created successfully', data: segment });
});

export const getSegments = asyncHandler(async (req: Request, res: Response) => {
  const segments = await prisma.segment.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.status(200).json({ data: segments, message: 'Segments retrieved successfully' });
});

export const previewSegment = asyncHandler(async (req: Request, res: Response) => {
  const { rules } = req.body;

  if (!rules) {
    throw new Error('Rules are required to preview a segment size');
  }

  // Convert the JSON rules to a Prisma "where" object dynamically
  // This is a basic implementation to be expanded upon based on rules structure.
  const whereClause: any = {};
  
  if (rules.entityType && rules.entityType !== 'All') whereClause.type = rules.entityType;
  if (rules.region && rules.region !== 'All') whereClause.state = { equals: rules.region, mode: 'insensitive' };
  if (rules.city && rules.city !== 'All') whereClause.city = { equals: rules.city, mode: 'insensitive' };
  if (rules.activityStatus && rules.activityStatus !== 'All') whereClause.verificationStatus = rules.activityStatus;
  
  if (rules.websiteStatus === 'NoWebsite') {
    if (!whereClause.AND) whereClause.AND = [];
    whereClause.AND.push({ OR: [{ website: null }, { website: '' }] });
  } else if (rules.websiteStatus === 'HasWebsite') {
    if (!whereClause.AND) whereClause.AND = [];
    whereClause.AND.push({ website: { not: null }, NOT: { website: '' } });
  }

  if (rules.algoStatus === 'HasAlgo') {
    if (!whereClause.AND) whereClause.AND = [];
    whereClause.AND.push({ sellsAlgoTrading: { contains: 'Yes', mode: 'insensitive' } });
  } else if (rules.algoStatus === 'NoAlgo') {
    if (!whereClause.AND) whereClause.AND = [];
    whereClause.AND.push({ OR: [{ sellsAlgoTrading: null }, { sellsAlgoTrading: '' }, { sellsAlgoTrading: { contains: 'No', mode: 'insensitive' } }] });
  }

  const [count, leads] = await Promise.all([
    prisma.lead.count({ where: whereClause }),
    prisma.lead.findMany({ where: whereClause, take: 50, orderBy: { createdAt: 'desc' } })
  ]);

  res.status(200).json({ data: { count, leads }, message: 'Segment size calculated successfully' });
});

export const deleteSegment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  await prisma.segment.delete({
    where: { id: parseInt(id as string) }
  });
  
  res.status(200).json({ message: 'Segment deleted successfully' });
});

export const getSegmentLeads = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const segment = await prisma.segment.findUnique({
    where: { id: parseInt(id as string) }
  });
  
  if (!segment) {
    throw new Error('Segment not found');
  }

  const rules = segment.rules as any || {};
  const whereClause: any = {};
  
  if (rules.entityType && rules.entityType !== 'All') whereClause.type = rules.entityType;
  if (rules.region && rules.region !== 'All') whereClause.state = { equals: rules.region, mode: 'insensitive' };
  if (rules.city && rules.city !== 'All') whereClause.city = { equals: rules.city, mode: 'insensitive' };
  if (rules.activityStatus && rules.activityStatus !== 'All') whereClause.verificationStatus = rules.activityStatus;
  
  if (rules.websiteStatus === 'NoWebsite') {
    if (!whereClause.AND) whereClause.AND = [];
    whereClause.AND.push({ OR: [{ website: null }, { website: '' }] });
  } else if (rules.websiteStatus === 'HasWebsite') {
    if (!whereClause.AND) whereClause.AND = [];
    whereClause.AND.push({ website: { not: null }, NOT: { website: '' } });
  }

  if (rules.algoStatus === 'HasAlgo') {
    if (!whereClause.AND) whereClause.AND = [];
    whereClause.AND.push({ sellsAlgoTrading: { contains: 'Yes', mode: 'insensitive' } });
  } else if (rules.algoStatus === 'NoAlgo') {
    if (!whereClause.AND) whereClause.AND = [];
    whereClause.AND.push({ OR: [{ sellsAlgoTrading: null }, { sellsAlgoTrading: '' }, { sellsAlgoTrading: { contains: 'No', mode: 'insensitive' } }] });
  }
  
  const leads = await prisma.lead.findMany({
    where: whereClause,
    take: 50, // preview limit
    orderBy: { createdAt: 'desc' }
  });

  res.status(200).json({ data: leads, message: 'Segment leads retrieved' });
});
