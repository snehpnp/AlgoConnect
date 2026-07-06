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
      email2: lead.email2,
      phone: lead.phone,
      phone2: lead.phone2,
      registrationNo: lead.registrationNo,
      contactPerson: lead.contactPerson,
      address: lead.address,
      city: lead.city,
      state: lead.state,
      pincode: lead.pincode,
      source: lead.source || 'IMPORT'
    })),
    skipDuplicates: true
  });

  res.status(200).json({ message: 'Leads imported successfully', count: createdLeads.count });
});

export const getLeads = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const search = (req.query.search as string) || '';
  const status = (req.query.status as string) || 'All';
  
  const skip = (page - 1) * limit;

  const where: any = {};
  
  if (status && status !== 'All') {
    where.status = status.toUpperCase();
  }
  
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { email2: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { phone2: { contains: search, mode: 'insensitive' } },
      { registrationNo: { contains: search, mode: 'insensitive' } }
    ];
  }

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.lead.count({ where })
  ]);

  res.status(200).json({ 
    data: leads, 
    message: 'List of leads retrieved successfully',
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  });
});

export const createLead = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, email2, phone, phone2, status, registrationNo, contactPerson, address, city, state, pincode, source } = req.body;

  if (!name) {
    throw new Error('Lead name is required');
  }

  const newLead = await prisma.lead.create({
    data: {
      name, email, email2, phone, phone2, status, registrationNo, contactPerson, address, city, state, pincode, source: source || 'MANUAL'
    }
  });

  res.status(201).json({ message: 'Lead created successfully', data: newLead });
});

export const updateLead = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email, email2, phone, phone2, status, registrationNo, contactPerson, address, city, state, pincode, source } = req.body;

  if (!id) {
    throw new Error('Lead ID is required');
  }

  const updatedLead = await prisma.lead.update({
    where: { id: parseInt(id as string) },
    data: {
      name, email, email2, phone, phone2, status, registrationNo, contactPerson, address, city, state, pincode, source
    }
  });

  res.status(200).json({ message: 'Lead updated successfully', data: updatedLead });
});
