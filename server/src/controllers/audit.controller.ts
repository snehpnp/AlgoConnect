import { Request, Response } from 'express';
import prisma from '../models/prismaClient';
import { asyncHandler } from '../utils/asyncHandler';

export const getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const { search, action, userId, startDate, endDate } = req.query;

  let where: any = {};

  if (search) {
    where.OR = [
      { details: { contains: search as string } },
      { action: { contains: search as string } }
    ];
  }

  if (action && action !== 'All') {
    where.action = action;
  }

  if (userId && userId !== 'All') {
    where.userId = parseInt(userId as string);
  }

  if (startDate && endDate) {
    where.createdAt = {
      gte: new Date(startDate as string),
      lte: new Date(endDate as string)
    };
  }

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, name: true } }
      }
    }),
    prisma.activityLog.count({ where })
  ]);

  res.status(200).json({
    message: 'Audit logs retrieved successfully',
    data: logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  });
});

export const getAuditLogFilters = asyncHandler(async (req: Request, res: Response) => {
  const [users, actions] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true } }),
    prisma.activityLog.findMany({
      select: { action: true },
      distinct: ['action']
    })
  ]);

  res.status(200).json({
    message: 'Audit log filters retrieved',
    data: {
      users,
      actions: actions.map(a => a.action)
    }
  });
});
