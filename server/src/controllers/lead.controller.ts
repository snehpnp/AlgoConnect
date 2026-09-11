import { Request, Response } from 'express';
import prisma from '../models/prismaClient';
import { asyncHandler } from '../utils/asyncHandler';
import { messagingGateway } from '../services/messagingGateway.service';
import { SocketService } from '../services/socket.service';
import { RoutingService } from '../services/routing.service';

export const sendDirectMessage = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { channel = 'EMAIL', subject, body, templateId, recipientEmail } = req.body;

  const lead = await prisma.lead.findUnique({
    where: { id: parseInt(id as string) }
  });

  if (!lead) {
    res.status(404).json({ message: 'Lead not found' });
    return;
  }

  let targetRecipient = '';
  if (channel === 'EMAIL') {
    targetRecipient = recipientEmail || lead.email || (lead as any).scrapedEmail;
    if (!targetRecipient) {
      res.status(400).json({ message: 'No email address available to send to' });
      return;
    }
  } else if (channel === 'WHATSAPP' || channel === 'SMS') {
    targetRecipient = lead.phone || lead.phone2 || (lead as any).scrapedPhone;
    if (!targetRecipient) {
      res.status(400).json({ message: 'No phone number available to send to' });
      return;
    }
  }

  let finalContent = body;
  let finalSubject = subject;
  
  if (templateId) {
    const template = await prisma.messageTemplate.findUnique({
      where: { id: parseInt(templateId) }
    });
    
    if (template && template.content) {
      finalContent = template.content.replace(/{{name}}/gi, lead.name || 'there');
      if (!finalSubject && template.subject) {
        finalSubject = template.subject;
      }
    }
  }

  const result = await messagingGateway.sendMessage({
    leadId: lead.id,
    channel: channel as 'EMAIL' | 'SMS' | 'WHATSAPP',
    recipient: targetRecipient,
    content: finalContent,
    htmlContent: finalContent,
    subject: finalSubject || 'Message from AlgoConnect',
    templateId: templateId ? parseInt(templateId) : undefined
  });

  if (!result.success) {
    res.status(500).json({ message: `Failed to send ${channel}`, error: result.error });
    return;
  }

  res.status(200).json({ message: `${channel} sent successfully`, messageId: result.messageId });
});

export const getLeadMessageHistory = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const messages = await prisma.messageSend.findMany({
    where: { leadId: parseInt(id as string) },
    orderBy: { createdAt: 'desc' },
    include: {
      events: { orderBy: { createdAt: 'desc' } },
      replies: { orderBy: { receivedAt: 'desc' } }
    }
  });

  res.status(200).json({ data: messages, message: 'Message history retrieved successfully' });
});

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
      fax: lead.fax,
      validity: lead.validity,
      exchangeName: lead.exchangeName,
      tradeName: lead.tradeName,
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

  // Auto-route the newly imported leads
  try {
    const newLeadRecords = await prisma.lead.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 10000) }, // Roughly leads just created
      },
      select: { id: true },
      take: createdLeads.count,
      orderBy: { id: 'desc' }
    });
    const newLeadIds = newLeadRecords.map(l => l.id);
    await RoutingService.autoAssignLeadsBulk(newLeadIds);
  } catch (err) {
    console.error('Auto-routing failed during import:', err);
  }

  res.status(200).json({ message: 'Leads imported successfully', count: createdLeads.count });
});

export const getLeads = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const search = (req.query.search as string) || '';
  
  // Status filters
  const unifiedStatus = (req.query.unifiedStatus as string) || 'All';
  const salesStage = (req.query.salesStage as string) || 'All';
  const verificationStatus = (req.query.verificationStatus as string) || 'All';
  const engagementStatus = (req.query.engagementStatus as string) || 'All';
  const consentStatus = (req.query.consentStatus as string) || 'All';
  const type = (req.query.type as string) || 'All';
  const state = (req.query.state as string) || 'All';
  const city = (req.query.city as string) || 'All';
  const websiteStatus = (req.query.websiteStatus as string) || 'All';
  const sellsAlgoTrading = (req.query.sellsAlgoTrading as string) || 'All';
  const exchangeName = (req.query.exchangeName as string) || 'All';
  const otherListings = (req.query.otherListings as string) || 'All';
  const campaignStatus = (req.query.campaignStatus as string) || 'All';
  
  const bounced = (req.query.bounced as string) || (req.query.bouncedFilter as string) || 'All';

  const skip = (page - 1) * limit;
  const where: any = {};
  
  if (salesStage && salesStage !== 'All') where.salesStage = salesStage;
  
  if (unifiedStatus && unifiedStatus !== 'All') {
    switch(unifiedStatus) {
      case 'NEW':
        where.salesStage = 'New';
        break;
      case 'CONTACTED':
        where.salesStage = 'Contacted';
        break;
      case 'FOLLOW_UP':
        where.salesStage = 'Follow-up';
        break;
      case 'CONTACTED_OR_FOLLOW_UP':
        where.salesStage = { in: ['Contacted', 'Follow-up'] };
        break;
      case 'QUALIFIED':
        where.salesStage = 'Qualified';
        break;
      case 'NEGOTIATION':
        where.salesStage = 'Negotiation';
        break;
      case 'WON':
        where.salesStage = 'Client Won';
        break;
      case 'LOST':
        where.salesStage = 'Client Lost';
        break;
      case 'DNC':
        where.salesStage = 'Do Not Contact';
        break;
      case 'UNVERIFIED':
        where.verificationStatus = 'Unverified';
        break;
      case 'ENGAGED':
        where.engagementStatus = { not: 'Not Engaged' };
        break;
      case 'BOUNCED':
        where.OR = [
          { engagementStatus: 'Bounced' },
          { messageSends: { some: { status: 'BOUNCED' } } }
        ];
        break;
      case 'NOT_BOUNCED':
        where.AND = [
          { engagementStatus: { not: 'Bounced' } },
          { messageSends: { none: { status: 'BOUNCED' } } }
        ];
        break;
      case 'IMPORTED':
        where.verificationStatus = 'Imported';
        break;
      case 'INVALID':
        where.verificationStatus = { in: ['Likely Inactive', 'Duplicate'] };
        break;
      case 'OVERDUE':
        const startOfDay = new Date(); 
        startOfDay.setHours(0, 0, 0, 0);
        where.nextFollowUpAt = { lt: startOfDay };
        break;
      default:
        where.status = unifiedStatus;
    }
  }
  
  if (verificationStatus && verificationStatus !== 'All') where.verificationStatus = verificationStatus;
  
  if (bounced && bounced !== 'All') {
    if (bounced === 'BOUNCED' || bounced === 'Bounced') {
      where.OR = [
        { engagementStatus: 'Bounced' },
        { messageSends: { some: { status: 'BOUNCED' } } }
      ];
    } else if (bounced === 'NOT_BOUNCED' || bounced === 'Not Bounced' || bounced === 'NotBounced') {
      where.AND = [
        { engagementStatus: { not: 'Bounced' } },
        { messageSends: { none: { status: 'BOUNCED' } } }
      ];
    }
  }

  if (engagementStatus && engagementStatus !== 'All') {
    if (engagementStatus === 'BOUNCED' || engagementStatus === 'Bounced') {
      where.OR = [
        { engagementStatus: 'Bounced' },
        { messageSends: { some: { status: 'BOUNCED' } } }
      ];
    } else if (engagementStatus === 'NOT_BOUNCED' || engagementStatus === 'Not Bounced' || engagementStatus === 'NotBounced') {
      where.AND = [
        { engagementStatus: { not: 'Bounced' } },
        { messageSends: { none: { status: 'BOUNCED' } } }
      ];
    } else {
      where.engagementStatus = engagementStatus;
    }
  }
  if (consentStatus && consentStatus !== 'All') where.consentStatus = consentStatus;
  if (type && type !== 'All') where.type = type;
  if (state && state !== 'All') where.state = state;
  if (city && city !== 'All') where.city = city;
  
  if (websiteStatus === 'NoWebsite') {
    if (!where.AND) where.AND = [];
    where.AND.push({
      OR: [
        { website: null },
        { website: '' }
      ]
    });
  } else if (websiteStatus === 'HasWebsite') {
    if (!where.AND) where.AND = [];
    where.AND.push({
      website: { not: null },
      NOT: { website: '' }
    });
  }
  
  if (sellsAlgoTrading === 'Yes') {
    if (!where.AND) where.AND = [];
    where.AND.push({ sellsAlgoTrading: { contains: 'Yes', mode: 'insensitive' } });
  } else if (sellsAlgoTrading === 'No') {
    if (!where.AND) where.AND = [];
    where.AND.push({
      OR: [
        { sellsAlgoTrading: null },
        { sellsAlgoTrading: '' },
        { sellsAlgoTrading: { contains: 'No', mode: 'insensitive' } }
      ]
    });
  }

  if (exchangeName && exchangeName !== 'All') {
    where.exchangeName = exchangeName;
  }
  
  if (otherListings === 'Yes') {
    if (!where.AND) where.AND = [];
    where.AND.push({
      otherListings: { not: null },
      NOT: { otherListings: '' }
    });
  } else if (otherListings === 'No') {
    if (!where.AND) where.AND = [];
    where.AND.push({
      OR: [
        { otherListings: null },
        { otherListings: '' }
      ]
    });
  }
  
  if (campaignStatus && campaignStatus !== 'All') {
    if (campaignStatus === 'PENDING' || campaignStatus === 'QUEUED') {
      where.messageSends = { some: { status: 'QUEUED' } };
    } else {
      where.messageSends = { some: { status: campaignStatus } };
    }
  }
  
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { email2: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { phone2: { contains: search, mode: 'insensitive' } },
      { registrationNo: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
      { state: { contains: search, mode: 'insensitive' } }
    ];
  }

  const sortBy = (req.query.sortBy as string) || 'createdAt';
  const order = (req.query.order as string) || 'desc';

  const allowedSortFields = ['createdAt', 'name', 'leadScore'];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const sortOrder = order === 'asc' ? 'asc' : 'desc';

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { [sortField]: sortOrder },
      skip,
      take: limit,
      include: {
        user: { select: { id: true, name: true } },
        messageSends: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true, channel: true, createdAt: true }
        }
      }
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
  const { 
    name, email, email2, phone, phone2, status, salesStage, verificationStatus, engagementStatus, consentStatus, 
    registrationNo, contactPerson, address, city, state, pincode, fax, validity, exchangeName, tradeName, source, type,
    website, linkedin, twitter, facebook, servicesSummary, productsOffered, sellsAlgoTrading, brokerPartner, companySizeEstimate, enrichmentNotes, logoUrl
  } = req.body;
  const userId = req.user?.id;

  if (!name) {
    throw new Error('Lead name is required');
  }

  const newLead = await prisma.lead.create({
    data: {
      name, email, email2, phone, phone2, registrationNo, contactPerson, address, city, state, pincode, fax, validity, exchangeName, tradeName, 
      source: source || 'MANUAL', 
      type: type || 'Manual',
      status: status || 'IMPORTED',
      salesStage: salesStage || 'New',
      verificationStatus: verificationStatus || 'Unverified',
      engagementStatus: engagementStatus || 'Not Engaged',
      consentStatus: consentStatus || 'Unknown',
      website, linkedin, twitter, facebook, servicesSummary, productsOffered, sellsAlgoTrading, brokerPartner, companySizeEstimate, enrichmentNotes, logoUrl
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

  // Notify system admins about the new lead
  const admins = await prisma.user.findMany({
    where: { role: { name: 'System Admin' } }
  });
  
  for (const admin of admins) {
    if (admin.id !== userId) { // Don't notify the person who created it if they are an admin
      const notif = await prisma.notification.create({
        data: {
          userId: admin.id,
          title: 'New Lead Created',
          message: `Lead "${newLead.name}" was just created by ${(req.user as any)?.name || 'a user'}.`,
          type: 'LEAD_CREATED',
          relatedEntityId: newLead.id,
          relatedEntity: 'Lead'
        }
      });
      SocketService.sendToUser(admin.id, 'new_notification', notif);
    }
  }

  // Auto-route the new lead
  try {
    await RoutingService.autoAssignLead(newLead.id);
  } catch (err) {
    console.error('Auto-routing failed for new lead:', err);
  }

  res.status(201).json({ message: 'Lead created successfully', data: newLead });
});

export const getLeadById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const lead = await prisma.lead.findUnique({
    where: { id: parseInt(id as string) },
    include: {
      user: { select: { id: true, name: true } }
    }
  });

  if (!lead) {
    throw new Error('Lead not found');
  }

  res.status(200).json({ message: 'Lead fetched successfully', data: lead });
});

export const updateLead = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { 
    name, email, email2, phone, phone2, status, salesStage, verificationStatus, engagementStatus, consentStatus, 
    registrationNo, contactPerson, address, city, state, pincode, fax, validity, exchangeName, tradeName, source, type,
    website, linkedin, twitter, facebook, servicesSummary, productsOffered, sellsAlgoTrading, brokerPartner, companySizeEstimate, enrichmentNotes, logoUrl,
    userId: assignedUserId
  } = req.body;
  const currentUserId = req.user?.id;

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
      name, email, email2, phone, phone2, status, salesStage, verificationStatus, engagementStatus, consentStatus, registrationNo, contactPerson, address, city, state, pincode, fax, validity, exchangeName, tradeName, source, type,
      website, linkedin, twitter, facebook, servicesSummary, productsOffered, sellsAlgoTrading, brokerPartner, companySizeEstimate, enrichmentNotes, logoUrl,
      ...(assignedUserId !== undefined && { userId: assignedUserId ? parseInt(assignedUserId as string) : null })
    },
    include: {
      user: { select: { id: true, name: true } }
    }
  });

  // Track changes
  if (currentUserId) {
    const changes: any = {};
    if (salesStage && existingLead.salesStage !== salesStage) changes.salesStage = { from: existingLead.salesStage, to: salesStage };
    if (verificationStatus && existingLead.verificationStatus !== verificationStatus) changes.verificationStatus = { from: existingLead.verificationStatus, to: verificationStatus };
    if (engagementStatus && existingLead.engagementStatus !== engagementStatus) changes.engagementStatus = { from: existingLead.engagementStatus, to: engagementStatus };
    if (consentStatus && existingLead.consentStatus !== consentStatus) changes.consentStatus = { from: existingLead.consentStatus, to: consentStatus };
    
    if (Object.keys(changes).length > 0) {
      await prisma.activityLog.create({
        data: {
          userId: currentUserId,
          leadId,
          action: 'UPDATED_STATUSES',
          details: 'Updated lead statuses',
          changes: JSON.stringify(changes)
        }
      });
    }
  }

  // Check for status change notification (notify admins when status changes)
  if (status && existingLead.status !== status) {
    const admins = await prisma.user.findMany({
      where: { role: { name: 'System Admin' } }
    });
    
    for (const admin of admins) {
      if (admin.id !== currentUserId) {
        const notif = await prisma.notification.create({
          data: {
            userId: admin.id,
            title: 'Lead Status Changed',
            message: `Status for "${updatedLead.name}" was changed to ${status} by ${(req.user as any)?.name || 'a user'}.`,
            type: 'STATUS_CHANGED',
            relatedEntityId: updatedLead.id,
            relatedEntity: 'Lead'
          }
        });
        SocketService.sendToUser(admin.id, 'new_notification', notif);
      }
    }
  }

  // Check for assignment change notification
  if (assignedUserId !== undefined && existingLead.userId !== assignedUserId && assignedUserId !== null) {
    // Notify the newly assigned user
    if (assignedUserId !== currentUserId) {
      const notif = await prisma.notification.create({
        data: {
          userId: assignedUserId,
          title: 'New Lead Assigned',
          message: `Lead "${updatedLead.name}" has been assigned to you by ${(req.user as any)?.name || 'a user'}.`,
          type: 'LEAD_ASSIGNED',
          relatedEntityId: updatedLead.id,
          relatedEntity: 'Lead'
        }
      });
      SocketService.sendToUser(assignedUserId, 'new_notification', notif);
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

export const getFilterOptions = asyncHandler(async (req: Request, res: Response) => {
  const stateQuery = req.query.state as string;

  // Fetch distinct states
  const statesObj = await prisma.lead.findMany({
    where: { state: { not: null } },
    select: { state: true },
    distinct: ['state'],
    orderBy: { state: 'asc' }
  });
  
  // Fetch distinct cities
  const citiesObj = await prisma.lead.findMany({
    where: { 
      city: { not: null },
      ...(stateQuery && stateQuery !== 'All' ? { state: stateQuery } : {})
    },
    select: { city: true },
    distinct: ['city'],
    orderBy: { city: 'asc' }
  });
  
  // Fetch distinct types (Entity Types)
  const typesObj = await prisma.lead.findMany({
    select: { type: true },
    distinct: ['type'],
    orderBy: { type: 'asc' }
  });

  // Fetch distinct exchanges
  const exchangesObj = await prisma.lead.findMany({
    where: { 
      exchangeName: { not: null },
      NOT: { exchangeName: '' }
    },
    select: { exchangeName: true },
    distinct: ['exchangeName'],
    orderBy: { exchangeName: 'asc' }
  });

  const states = statesObj.map(s => s.state).filter(Boolean);
  const cities = citiesObj.map(c => c.city).filter(Boolean);
  const types = typesObj.map(t => t.type).filter(Boolean);
  const exchanges = exchangesObj.map(e => e.exchangeName).filter(Boolean);

  res.status(200).json({ data: { states, cities, types, exchanges }, message: 'Filter options retrieved' });
});

import fs from 'fs';
import path from 'path';
import * as ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';

export const uploadChunk = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  const { filename, chunkIndex, totalChunks } = req.body;

  if (!file) throw new Error('Chunk file missing');
  
  const uploadDir = path.join(process.cwd(), 'uploads');
  const tempFilePath = path.join(uploadDir, `${filename}.tmp`);
  
  // Append chunk to temp file
  const chunkData = fs.readFileSync(file.path);
  fs.appendFileSync(tempFilePath, chunkData);
  fs.unlinkSync(file.path); // Delete multer's uploaded chunk

  if (Number(chunkIndex) === Number(totalChunks) - 1) {
    // Final chunk
    const finalFilePath = path.join(uploadDir, filename);
    fs.renameSync(tempFilePath, finalFilePath);
    res.status(200).json({ message: 'File upload complete', filename });
  } else {
    res.status(200).json({ message: 'Chunk received' });
  }
});

export const processFile = asyncHandler(async (req: Request, res: Response) => {
  const { filename, entityType, mappings } = req.body;
  const userId = req.user?.id;
  const filePath = path.join(process.cwd(), 'uploads', filename);

  if (!fs.existsSync(filePath)) {
    throw new Error('File not found on server');
  }

  // Determine file type (CSV, XLS, or XLSX)
  const lowerName = filename.toLowerCase();
  const isCsv = lowerName.endsWith('.csv');
  const isXls = lowerName.endsWith('.xls');

  let importedCount = 0;
  let batch: any[] = [];
  const BATCH_SIZE = 5000;

  const insertBatch = async () => {
    if (batch.length > 0) {
      const result = await prisma.lead.createMany({
        data: batch,
        skipDuplicates: true
      });
      importedCount += result.count;
      batch = [];
    }
  };

  try {
    if (isCsv) {
      throw new Error('CSV stream parsing not yet implemented, please use XLSX or XLS.');
    } else if (isXls) {
      // Old .xls files cannot be streamed (binary OLE format). We must use SheetJS in memory.
      const workbook = XLSX.readFile(filePath);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      let isHeaderFound = false;
      let headerRowNumber = 1;
      
      for (let i = 0; i < rawJson.length; i++) {
        const rowValues = rawJson[i];
        
        if (!isHeaderFound) {
          if (rowValues && rowValues.length > 0) {
            const rowStrings = rowValues.map(v => String(v || '').trim().toLowerCase());
            if (rowStrings.some(c => c.includes('name') || c.includes('email') || c.includes('registration'))) {
              isHeaderFound = true;
              headerRowNumber = i;
            }
          }
          continue;
        }
        
        // Map row using indices provided by frontend
        const getVal = (idx?: number) => idx !== undefined && rowValues[idx] ? String(rowValues[idx]).trim() : undefined;
        
        const name = getVal(mappings.nameCol);
        if (!name || name === 'Unknown Entity' || name === '') continue; // Skip empty rows
        
        batch.push({
          name,
          registrationNo: getVal(mappings.regNoCol),
          contactPerson: getVal(mappings.contactPersonCol),
          email: getVal(mappings.emailCol),
          phone: getVal(mappings.phoneCol),
          city: getVal(mappings.cityCol),
          state: getVal(mappings.stateCol),
          pincode: getVal(mappings.pincodeCol),
          address: getVal(mappings.addressCol),
          fax: getVal(mappings.faxCol),
          validity: getVal(mappings.validityCol),
          exchangeName: getVal(mappings.exchangeNameCol),
          tradeName: getVal(mappings.tradeNameCol),
          source: 'IMPORT',
          type: entityType || 'Manual',
          salesStage: 'New',
          verificationStatus: 'Imported',
          engagementStatus: 'Not Engaged',
          consentStatus: 'Unknown'
        });

        if (batch.length >= BATCH_SIZE) {
          await insertBatch();
        }
      }
      
      // Insert remaining
      await insertBatch();

    } else {
      // .xlsx processing using streaming
      const options = {
        sharedStrings: 'cache',
        hyperlinks: 'ignore',
        worksheets: 'emit'
      };
      
      const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, options as any);
      
      let isHeaderFound = false;
      let headerRowNumber = 1;
      
      for await (const worksheetReader of workbookReader) {
        for await (const row of worksheetReader) {
          if (!isHeaderFound) {
            // Check if this row looks like the header based on mappings
            const rowValues = row.values as any[];
            if (rowValues && rowValues.length > 0) {
              const rowStrings = rowValues.map(v => String(v || '').trim().toLowerCase());
              if (rowStrings.some(c => c.includes('name') || c.includes('email') || c.includes('registration'))) {
                isHeaderFound = true;
                headerRowNumber = row.number;
              }
            }
            continue;
          }
          
          if (row.number > headerRowNumber) {
            const rowValues = row.values as any[];
            
            // Map row using indices provided by frontend
            const getVal = (idx?: number) => idx !== undefined && rowValues[idx + 1] ? String(rowValues[idx + 1]).trim() : undefined;
            
            const name = getVal(mappings.nameCol);
            if (!name || name === 'Unknown Entity' || name === '') continue; // Skip empty rows
            
            batch.push({
              name,
              registrationNo: getVal(mappings.regNoCol),
              contactPerson: getVal(mappings.contactPersonCol),
              email: getVal(mappings.emailCol),
              phone: getVal(mappings.phoneCol),
              city: getVal(mappings.cityCol),
              state: getVal(mappings.stateCol),
              pincode: getVal(mappings.pincodeCol),
              address: getVal(mappings.addressCol),
              fax: getVal(mappings.faxCol),
              validity: getVal(mappings.validityCol),
              exchangeName: getVal(mappings.exchangeNameCol),
              tradeName: getVal(mappings.tradeNameCol),
              source: 'IMPORT',
              type: entityType || 'Manual',
              salesStage: 'New',
              verificationStatus: 'Imported',
              engagementStatus: 'Not Engaged',
              consentStatus: 'Unknown'
            });

            if (batch.length >= BATCH_SIZE) {
              await insertBatch();
            }
          }
        }
        break; // Only parse the first worksheet
      }
      
      // Insert remaining
      await insertBatch();
    }
  } catch (error: any) {
    throw new Error(`Failed to process streaming file: ${error.message}`);
  } finally {
    // Delete file to save space
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  if (userId && importedCount > 0) {
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'IMPORTED_LEADS',
        details: `Imported ${importedCount} leads via streaming file upload`,
      }
    });
  }

  res.status(200).json({ message: 'File processed and leads imported successfully', count: importedCount });
});

// --- RE-SCRAPE BOUNCED LEADS CONTROLLER ---
export const rescrapeBouncedLeads = asyncHandler(async (req: Request, res: Response) => {
  const { leadIds } = req.body;

  const whereClause: any = {};

  if (Array.isArray(leadIds) && leadIds.length > 0) {
    whereClause.id = { in: leadIds.map(Number) };
  } else {
    whereClause.OR = [
      { engagementStatus: 'Bounced' },
      { messageSends: { some: { status: 'BOUNCED' } } }
    ];
  }

  const bouncedLeads = await prisma.lead.findMany({
    where: whereClause,
    orderBy: { updatedAt: 'desc' }
  });

  if (bouncedLeads.length === 0) {
    return res.status(200).json({
      message: 'No bounced leads found to re-scrape.',
      data: {
        totalBounced: 0,
        rescrapedCount: 0,
        newEmailsFoundCount: 0,
        updatedLeads: []
      },
      processedCount: 0,
      updatedCount: 0,
      updatedLeads: []
    });
  }

  let updatedCount = 0;
  const updatedLeads: any[] = [];

  const isValidEmailFormat = (emailStr?: string | null): boolean => {
    if (!emailStr) return false;
    const clean = emailStr.trim().toLowerCase();
    if (clean.length < 6 || !clean.includes('@') || !clean.includes('.')) return false;
    if (clean.includes('mailer-daemon') || clean.includes('postmaster') || clean.includes('wixpress') || clean.includes('sentry') || clean.includes('example.com')) return false;
    if (/\.(png|jpg|jpeg|gif|svg|css|js|webp)$/i.test(clean)) return false;
    return true;
  };

  const fetchPageContent = async (urlStr: string, timeoutMs = 3000): Promise<string> => {
    try {
      const httpModule = urlStr.startsWith('https') ? require('https') : require('http');
      return await new Promise((resolve) => {
        const timer = setTimeout(() => resolve(''), timeoutMs);
        const req = httpModule.get(urlStr, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res: any) => {
          let data = '';
          res.on('data', (chunk: any) => { data += chunk; if (data.length > 200000) res.destroy(); });
          res.on('end', () => { clearTimeout(timer); resolve(data); });
        });
        req.on('error', () => { clearTimeout(timer); resolve(''); });
      });
    } catch {
      return '';
    }
  };

  for (const lead of bouncedLeads) {
    try {
      const bouncedEmail = (lead.email || '').toLowerCase().trim();
      let newEmailFound: string | null = null;
      let discoverySource = '';

      // 1. Check secondary email2 or existing scrapedEmail if different from bounced email
      if (lead.email2 && isValidEmailFormat(lead.email2) && lead.email2.toLowerCase().trim() !== bouncedEmail) {
        newEmailFound = lead.email2.trim();
        discoverySource = 'Secondary Email Record (email2)';
      } else if (lead.scrapedEmail && isValidEmailFormat(lead.scrapedEmail) && lead.scrapedEmail.toLowerCase().trim() !== bouncedEmail) {
        newEmailFound = lead.scrapedEmail.trim();
        discoverySource = 'Existing Scraped Record';
      }

      // 2. If website exists, scrape domain contact page for candidate emails
      if (!newEmailFound && lead.website) {
        let domain = lead.website.trim().toLowerCase();
        if (!domain.startsWith('http')) domain = `https://${domain}`;

        const html = await fetchPageContent(domain, 3000);
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const matched = html.match(emailRegex) || [];

        const validCandidates = matched.map(e => e.trim().toLowerCase()).filter(e => {
          return isValidEmailFormat(e) && e !== bouncedEmail;
        });

        if (validCandidates.length > 0) {
          const domainName = domain.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
          const domainMatch = validCandidates.find(e => e.includes(domainName));
          newEmailFound = domainMatch || validCandidates[0];
          discoverySource = `Web Scraped from (${domainName})`;
        }
      }

      // 3. Fallback: Domain pattern generation if website is valid corporate domain
      if (!newEmailFound && lead.website) {
        const cleanDomain = lead.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0].trim();
        if (cleanDomain && !cleanDomain.includes('gmail') && !cleanDomain.includes('yahoo') && !cleanDomain.includes('hotmail')) {
          const standardCandidates = [`info@${cleanDomain}`, `contact@${cleanDomain}`, `support@${cleanDomain}`, `compliance@${cleanDomain}`];
          const availableCandidate = standardCandidates.find(c => c.toLowerCase() !== bouncedEmail);
          if (availableCandidate) {
            newEmailFound = availableCandidate;
            discoverySource = `Generated Domain Contact (${cleanDomain})`;
          }
        }
      }

      // If new email was found:
      // 1. Move old bounced email to email2
      // 2. Set new discovered email as primary email 1 so campaign sending uses the new email
      // 3. Reset engagementStatus to 'Not Engaged' so lead becomes active again
      if (newEmailFound) {
        updatedCount++;

        const oldBouncedEmail = lead.email || '';

        const updateData: any = {
          email: newEmailFound,
          email2: oldBouncedEmail || lead.email2,
          scrapedEmail: newEmailFound,
          engagementStatus: 'Not Engaged'
        };

        await prisma.lead.update({
          where: { id: lead.id },
          data: updateData
        });

        // Reset MessageSend campaign statuses from BOUNCED to PENDING so campaign runner can re-attempt sending with the new email
        await prisma.messageSend.updateMany({
          where: {
            leadId: lead.id,
            status: { in: ['BOUNCED', 'FAILED'] }
          },
          data: {
            status: 'PENDING',
            bouncedAt: null,
            failedAt: null
          }
        });

        await prisma.activityLog.create({
          data: {
            userId: (req as any).user?.id || 1,
            action: 'RESCRAPED_BOUNCED_LEAD',
            details: `Re-scraped new email for Bounced Lead #${lead.id} (${lead.name}). Primary email updated to: ${newEmailFound}, old bounced email moved to email2: (${oldBouncedEmail}). Engagement status & campaign message status reset to PENDING.`
          }
        });

        updatedLeads.push({
          id: lead.id,
          name: lead.name,
          oldEmail: oldBouncedEmail || 'N/A',
          bouncedEmail: oldBouncedEmail || 'N/A',
          newEmail: newEmailFound,
          source: discoverySource,
          status: 'Not Engaged (Active)'
        });
      }
    } catch (err: any) {
      console.error(`Error rescraping lead #${lead.id}:`, err);
    }
  }

  // Sync any remaining MessageSend records for non-bounced leads
  await prisma.messageSend.updateMany({
    where: {
      status: 'BOUNCED',
      lead: {
        engagementStatus: { not: 'Bounced' }
      }
    },
    data: {
      status: 'PENDING',
      bouncedAt: null
    }
  });

  res.status(200).json({
    message: `Re-scraping complete! Processed ${bouncedLeads.length} bounced leads. Found ${updatedCount} new alternative email addresses.`,
    data: {
      totalBounced: bouncedLeads.length,
      rescrapedCount: bouncedLeads.length,
      newEmailsFoundCount: updatedCount,
      updatedLeads
    },
    processedCount: bouncedLeads.length,
    updatedCount,
    updatedLeads
  });
});

// --- SCRAPE INDIVIDUAL LEAD CONTACT INFO ---
export const scrapeLeadContactInfo = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const leadId = parseInt(id as string);

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    return res.status(404).json({ message: 'Lead not found' });
  }

  if (!lead.website) {
    return res.status(400).json({ message: 'Lead does not have a website to scrape.' });
  }

  let domain = lead.website.trim().toLowerCase();
  if (!domain.startsWith('http')) domain = `https://${domain}`;

  const fetchPageContent = async (urlStr: string, timeoutMs = 3000): Promise<string> => {
    try {
      const httpModule = urlStr.startsWith('https') ? require('https') : require('http');
      return await new Promise((resolve) => {
        const timer = setTimeout(() => resolve(''), timeoutMs);
        const req = httpModule.get(urlStr, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res: any) => {
          let data = '';
          res.on('data', (chunk: any) => { data += chunk; if (data.length > 200000) res.destroy(); });
          res.on('end', () => { clearTimeout(timer); resolve(data); });
        });
        req.on('error', () => { clearTimeout(timer); resolve(''); });
      });
    } catch {
      return '';
    }
  };

  const html = await fetchPageContent(domain, 4000);
  if (!html) {
    return res.status(500).json({ message: 'Failed to fetch website content or website is unreachable.' });
  }

  let emailFound = null;
  let phoneFound = null;
  const updateData: any = {};

  // Try to find email if missing
  if (!lead.email) {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matchedEmails = html.match(emailRegex) || [];
    
    const isValidEmailFormat = (emailStr: string): boolean => {
      const clean = emailStr.trim().toLowerCase();
      if (clean.length < 6 || !clean.includes('@') || !clean.includes('.')) return false;
      if (clean.includes('example.com') || /\.(png|jpg|jpeg|gif|svg|css|js|webp)$/i.test(clean)) return false;
      return true;
    };

    const validEmails = matchedEmails.map(e => e.trim().toLowerCase()).filter(isValidEmailFormat);
    if (validEmails.length > 0) {
      const domainName = domain.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
      const domainMatch = validEmails.find(e => e.includes(domainName));
      emailFound = domainMatch || validEmails[0];
      updateData.email = emailFound;
      updateData.scrapedEmail = emailFound;
    }
  }

  // Try to find phone if missing
  if (!lead.phone) {
    // Regex for basic phone matching (Indian format / general)
    const phoneRegex = /(?:\+91[\s-]?)?[6789]\d{9}/g;
    const matchedPhones = html.match(phoneRegex) || [];
    if (matchedPhones.length > 0 && matchedPhones[0]) {
      phoneFound = matchedPhones[0].trim();
      updateData.phone = phoneFound;
      updateData.scrapedPhone = phoneFound;
    }
  }

  if (Object.keys(updateData).length > 0) {
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: updateData
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user?.id || 1,
        action: 'SCRAPED_CONTACT_INFO',
        details: `Scraped website for Lead #${lead.id}. ${emailFound ? 'Found email: ' + emailFound + '. ' : ''}${phoneFound ? 'Found phone: ' + phoneFound + '.' : ''}`
      }
    });

    return res.status(200).json({ 
      message: 'Scraping successful.',
      data: updatedLead,
      emailFound,
      phoneFound
    });
  } else {
    return res.status(200).json({ 
      message: 'Scraped website but no new contact info was found.',
      data: lead
    });
  }
});
