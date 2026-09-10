import { Request, Response } from 'express';
import prisma from '../models/prismaClient';
import { asyncHandler } from '../utils/asyncHandler';

// --- NOTES ---
export const getNotes = asyncHandler(async (req: Request, res: Response) => {
  const { leadId } = req.params;
  const notes = await prisma.note.findMany({
    where: { leadId: parseInt(leadId as string) },
    orderBy: { createdAt: 'desc' },
    include: {
      // Include user info if needed later
    }
  });
  res.status(200).json({ data: notes, message: 'Notes retrieved' });
});

export const createNote = asyncHandler(async (req: Request, res: Response) => {
  const { leadId } = req.params;
  const { content } = req.body;
  const userId = req.user?.id;

  if (!content?.trim()) {
    res.status(400).json({ message: 'Note content is required' });
    return;
  }

  const note = await prisma.note.create({
    data: {
      leadId: parseInt(leadId as string),
      userId: userId || null,
      content: content.trim()
    }
  });

  // Log the activity
  if (userId) {
    await prisma.activityLog.create({
      data: {
        userId,
        leadId: parseInt(leadId as string),
        action: 'NOTE_ADDED',
        details: `Note added: "${content.slice(0, 60)}${content.length > 60 ? '...' : ''}"`
      }
    });
  }

  res.status(201).json({ data: note, message: 'Note created' });
});

export const deleteNote = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.note.delete({ where: { id: parseInt(id as string) } });
  res.status(200).json({ message: 'Note deleted' });
});

// --- FOLLOW-UP ---
export const setFollowUp = asyncHandler(async (req: Request, res: Response) => {
  const { leadId } = req.params;
  const { nextFollowUpAt, followUpNotes } = req.body;
  const userId = req.user?.id;

  const updated = await prisma.lead.update({
    where: { id: parseInt(leadId as string) },
    data: {
      nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : null,
      followUpNotes: followUpNotes || null
    }
  });

  if (userId) {
    await prisma.activityLog.create({
      data: {
        userId,
        leadId: parseInt(leadId as string),
        action: 'FOLLOW_UP_SCHEDULED',
        details: nextFollowUpAt
          ? `Follow-up scheduled for ${new Date(nextFollowUpAt).toLocaleString('en-IN')}`
          : 'Follow-up cleared'
      }
    });
  }

  res.status(200).json({ data: updated, message: 'Follow-up updated' });
});

export const getTodaysFollowUps = asyncHandler(async (req: Request, res: Response) => {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(new Date().setHours(23, 59, 59, 999));

  const leads = await prisma.lead.findMany({
    where: {
      nextFollowUpAt: {
        gte: startOfDay,
        lte: endOfDay
      }
    },
    include: {
      user: { select: { id: true, name: true } }
    },
    orderBy: { nextFollowUpAt: 'asc' }
  });

  res.status(200).json({ data: leads, message: "Today's follow-ups retrieved" });
});

export const getOverdueFollowUps = asyncHandler(async (req: Request, res: Response) => {
  const now = new Date();

  const leads = await prisma.lead.findMany({
    where: {
      nextFollowUpAt: { lt: now }
    },
    include: {
      user: { select: { id: true, name: true } }
    },
    orderBy: { nextFollowUpAt: 'asc' },
    take: 50
  });

  res.status(200).json({ data: leads, message: 'Overdue follow-ups retrieved' });
});

// --- CSV EXPORT ---
export const exportLeadsCSV = asyncHandler(async (req: Request, res: Response) => {
  const { stateFilter, cityFilter, unifiedStatusFilter, typeFilter, salesStage, search } = req.query;
  const where: any = {};

  if (stateFilter && stateFilter !== 'All') where.state = stateFilter;
  if (cityFilter && cityFilter !== 'All') where.city = cityFilter;
  if (typeFilter && typeFilter !== 'All') where.type = typeFilter;
  if (salesStage && salesStage !== 'All') where.salesStage = salesStage;
  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { email: { contains: search as string, mode: 'insensitive' } },
      { phone: { contains: search as string, mode: 'insensitive' } }
    ];
  }

  const leads = await prisma.lead.findMany({
    where,
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: 'desc' }
  });

  // Build CSV
  const headers = [
    'ID', 'Name', 'Email', 'Phone', 'City', 'State', 'Type', 'Source',
    'Sales Stage', 'Status', 'Assigned To', 'Registration No', 'Website',
    'Follow Up Date', 'Created At'
  ];

  const rows = leads.map(l => [
    l.id,
    `"${(l.name || '').replace(/"/g, '""')}"`,
    l.email || '',
    l.phone || '',
    l.city || '',
    l.state || '',
    l.type || '',
    l.source || '',
    l.salesStage || '',
    l.status || '',
    l.user?.name || 'Unassigned',
    l.registrationNo || '',
    l.website || '',
    l.nextFollowUpAt ? new Date(l.nextFollowUpAt).toLocaleDateString('en-IN') : '',
    new Date(l.createdAt).toLocaleDateString('en-IN')
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="leads_export_${Date.now()}.csv"`);
  res.status(200).send(csv);
});
