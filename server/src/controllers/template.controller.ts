import { Request, Response } from 'express';
import prisma from '../models/prismaClient';
import { asyncHandler } from '../utils/asyncHandler';

export const getTemplates = asyncHandler(async (req: Request, res: Response) => {
  const templates = await prisma.messageTemplate.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.status(200).json({ data: templates, message: 'Templates retrieved successfully' });
});

export const getTemplateById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const template = await prisma.messageTemplate.findUnique({
    where: { id: parseInt(id as string) }
  });
  
  if (!template) {
    throw new Error('Template not found');
  }
  
  res.status(200).json({ data: template, message: 'Template retrieved successfully' });
});

export const createTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { name, content, type, status, isShared } = req.body;
  
  if (!name || !content || !type) {
    throw new Error('Name, content, and type are required');
  }
  
  const newTemplate = await prisma.messageTemplate.create({
    data: {
      name,
      content,
      type,
      status: status || 'PENDING',
      isShared: isShared || false
    }
  });
  
  res.status(201).json({ data: newTemplate, message: 'Template created successfully' });
});

export const updateTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, content, type, status, isShared } = req.body;
  
  const template = await prisma.messageTemplate.update({
    where: { id: parseInt(id as string) },
    data: {
      name,
      content,
      type,
      status,
      isShared
    }
  });
  
  res.status(200).json({ data: template, message: 'Template updated successfully' });
});

export const deleteTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  await prisma.messageTemplate.delete({
    where: { id: parseInt(id as string) }
  });
  
  res.status(200).json({ message: 'Template deleted successfully' });
});
