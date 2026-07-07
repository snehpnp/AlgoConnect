import { Request, Response } from 'express';
import prisma from '../models/prismaClient';
import { asyncHandler } from '../utils/asyncHandler';

export const importLeads = asyncHandler(async (req: Request, res: Response) => {
  const { leads } = req.body;
  const userId = req.user?.id;
  
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
      source: lead.source || 'IMPORT',
      type: lead.type || 'Manual',
      salesStage: lead.salesStage || 'New',
      verificationStatus: lead.verificationStatus || 'Imported',
      engagementStatus: lead.engagementStatus || 'Not Engaged',
      consentStatus: lead.consentStatus || 'Unknown'
    })),
    skipDuplicates: true
  });

  if (userId && createdLeads.count > 0) {
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'IMPORTED_LEADS',
        details: `Imported ${createdLeads.count} leads`,
      }
    });
  }

  res.status(200).json({ message: 'Leads imported successfully', count: createdLeads.count });
});

export const getLeads = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const search = (req.query.search as string) || '';
  
  // Status filters
  const salesStage = (req.query.salesStage as string) || 'All';
  const verificationStatus = (req.query.verificationStatus as string) || 'All';
  const engagementStatus = (req.query.engagementStatus as string) || 'All';
  const consentStatus = (req.query.consentStatus as string) || 'All';
  const type = (req.query.type as string) || 'All';
  
  const skip = (page - 1) * limit;
  const where: any = {};
  
  if (salesStage && salesStage !== 'All') where.salesStage = salesStage;
  if (verificationStatus && verificationStatus !== 'All') where.verificationStatus = verificationStatus;
  if (engagementStatus && engagementStatus !== 'All') where.engagementStatus = engagementStatus;
  if (consentStatus && consentStatus !== 'All') where.consentStatus = consentStatus;
  if (type && type !== 'All') where.type = type;
  
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
  const { name, email, email2, phone, phone2, salesStage, verificationStatus, engagementStatus, consentStatus, registrationNo, contactPerson, address, city, state, pincode, source, type } = req.body;
  const userId = req.user?.id;

  if (!name) {
    throw new Error('Lead name is required');
  }

  const newLead = await prisma.lead.create({
    data: {
      name, email, email2, phone, phone2, registrationNo, contactPerson, address, city, state, pincode, 
      source: source || 'MANUAL', 
      type: type || 'Manual',
      salesStage: salesStage || 'New',
      verificationStatus: verificationStatus || 'Unverified',
      engagementStatus: engagementStatus || 'Not Engaged',
      consentStatus: consentStatus || 'Unknown'
    }
  });

  if (userId) {
    await prisma.activityLog.create({
      data: {
        userId,
        leadId: newLead.id,
        action: 'CREATED_LEAD',
        details: 'Manually created lead'
      }
    });
  }

  res.status(201).json({ message: 'Lead created successfully', data: newLead });
});

export const updateLead = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email, email2, phone, phone2, salesStage, verificationStatus, engagementStatus, consentStatus, registrationNo, contactPerson, address, city, state, pincode, source, type } = req.body;
  const userId = req.user?.id;

  if (!id) {
    throw new Error('Lead ID is required');
  }

  const leadId = parseInt(id as string);
  const existingLead = await prisma.lead.findUnique({ where: { id: leadId } });
  
  if (!existingLead) {
    throw new Error('Lead not found');
  }

  const updatedLead = await prisma.lead.update({
    where: { id: leadId },
    data: {
      name, email, email2, phone, phone2, salesStage, verificationStatus, engagementStatus, consentStatus, registrationNo, contactPerson, address, city, state, pincode, source, type
    }
  });

  // Track changes
  if (userId) {
    const changes: any = {};
    if (salesStage && existingLead.salesStage !== salesStage) changes.salesStage = { from: existingLead.salesStage, to: salesStage };
    if (verificationStatus && existingLead.verificationStatus !== verificationStatus) changes.verificationStatus = { from: existingLead.verificationStatus, to: verificationStatus };
    if (engagementStatus && existingLead.engagementStatus !== engagementStatus) changes.engagementStatus = { from: existingLead.engagementStatus, to: engagementStatus };
    if (consentStatus && existingLead.consentStatus !== consentStatus) changes.consentStatus = { from: existingLead.consentStatus, to: consentStatus };
    
    if (Object.keys(changes).length > 0) {
      await prisma.activityLog.create({
        data: {
          userId,
          leadId,
          action: 'UPDATED_STATUSES',
          details: 'Updated lead statuses',
          changes: JSON.stringify(changes)
        }
      });
    }
  }

  res.status(200).json({ message: 'Lead updated successfully', data: updatedLead });
});

export const deleteLead = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!id) {
    throw new Error('Lead ID is required');
  }

  await prisma.lead.delete({
    where: { id: parseInt(id as string) }
  });

  if (userId) {
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'DELETED_LEAD',
        details: `Deleted lead ID: ${id}`
      }
    });
  }

  res.status(200).json({ message: 'Lead deleted successfully' });
});

export const getLeadLogs = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const logs = await prisma.activityLog.findMany({
    where: { leadId: parseInt(id as string, 10) },
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          name: true,
          role: {
            select: { name: true }
          }
        }
      }
    }
  });

  res.status(200).json({ data: logs, message: 'Logs retrieved successfully' });
});
