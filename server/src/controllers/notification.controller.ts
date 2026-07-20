import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import prisma from '../models/prismaClient';

export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  res.status(200).json(notifications);
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;

  await prisma.notification.updateMany({
    where: { id: parseInt(id as string), userId },
    data: { isRead: true }
  });

  res.status(200).json({ message: 'Marked as read' });
});

export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true }
  });

  res.status(200).json({ message: 'All marked as read' });
});

export const clearNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  
  await prisma.notification.deleteMany({
    where: { userId }
  });

  res.status(200).json({ message: 'Notifications cleared' });
});
