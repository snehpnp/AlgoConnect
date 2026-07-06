import { Request, Response } from 'express';
import prisma from '../models/prismaClient';
import { asyncHandler } from '../utils/asyncHandler';

export const importLeads = asyncHandler(async (req: Request, res: Response) => {
  const { leads } = req.body;
  
  if (!leads || !Array.isArray(leads)) {
    throw new Error('Please provide an array of leads');
  }

  const createdLeads = await prisma.lead.createMany({
    data: leads.map(lead => ({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      source: lead.source || 'IMPORT'
    })),
    skipDuplicates: true
  });

  res.status(200).json({ message: 'Leads imported successfully', count: createdLeads.count });
});

export const getLeads = asyncHandler(async (req: Request, res: Response) => {
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.status(200).json({ data: leads, message: 'List of leads retrieved successfully' });
});
