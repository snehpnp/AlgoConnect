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
  
  if (rules.region) whereClause.state = rules.region; // Assuming region maps to state
  if (rules.activityStatus) whereClause.verificationStatus = rules.activityStatus;
  if (rules.status) whereClause.engagementStatus = rules.status;
  
  const count = await prisma.lead.count({
    where: whereClause
  });

  res.status(200).json({ data: { count }, message: 'Segment size calculated successfully' });
});

export const deleteSegment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  await prisma.segment.delete({
    where: { id: parseInt(id as string) }
  });
  
  res.status(200).json({ message: 'Segment deleted successfully' });
});
