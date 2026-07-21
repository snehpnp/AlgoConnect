import { Request, Response } from 'express';
import prisma from '../models/prismaClient';
import { asyncHandler } from '../utils/asyncHandler';
import { messagingGateway } from '../services/messagingGateway.service';
import { SocketService } from '../services/socket.service';
import { RoutingService } from '../services/routing.service';

export const sendDirectEmail = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { subject, body, templateId, recipientEmail } = req.body;

  const lead = await prisma.lead.findUnique({
    where: { id: parseInt(id as string) }
  });

  if (!lead) {
    res.status(404).json({ message: 'Lead not found' });
    return;
  }

  const targetEmail = recipientEmail || lead.email;

  if (!targetEmail) {
    res.status(400).json({ message: 'No email address available to send to' });
    return;
  }

  let finalHtml = body;
  
  if (templateId) {
    const template = await prisma.messageTemplate.findUnique({
      where: { id: parseInt(templateId) }
    });
    
    if (template && template.content) {
      // Very basic compilation (replace {{name}})
      finalHtml = template.content.replace(/{{name}}/gi, lead.name || 'there');
      if (!subject && template.subject) {
        req.body.subject = template.subject;
      }
    }
  }

  const result = await messagingGateway.sendMessage({
    leadId: lead.id,
    channel: 'EMAIL',
    recipient: targetEmail,
    content: finalHtml,
    htmlContent: finalHtml,
    subject: req.body.subject || subject || 'Message from AlgoConnect',
    templateId: templateId ? parseInt(templateId) : undefined
  });

  if (!result.success) {
    res.status(500).json({ message: 'Failed to send email', error: result.error });
    return;
  }

  res.status(200).json({ message: 'Email sent successfully', messageId: result.messageId });
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
  if (engagementStatus && engagementStatus !== 'All') where.engagementStatus = engagementStatus;
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
        user: { select: { id: true, name: true } }
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

  const states = statesObj.map(s => s.state).filter(Boolean);
  const cities = citiesObj.map(c => c.city).filter(Boolean);
  const types = typesObj.map(t => t.type).filter(Boolean);

  res.status(200).json({ data: { states, cities, types }, message: 'Filter options retrieved' });
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
