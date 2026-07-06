import { Request, Response } from 'express';
import prisma from '../models/prismaClient';
import { asyncHandler } from '../utils/asyncHandler';
import bcrypt from 'bcrypt';

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: { select: { name: true, id: true } },
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' }
  });
  res.status(200).json({ data: users, message: 'Users retrieved successfully' });
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, roleId } = req.body;
  
  if (!name || !email || !password || !roleId) {
    throw Object.assign(new Error('Please provide name, email, password, and roleId'), { statusCode: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw Object.assign(new Error('A user with this email already exists'), { statusCode: 409 });
  }

  const roleExists = await prisma.role.findUnique({ where: { id: Number(roleId) } });
  if (!roleExists) {
    throw Object.assign(new Error('Invalid role selected'), { statusCode: 400 });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, password: hashed, roleId: Number(roleId) },
    select: {
      id: true,
      name: true,
      email: true,
      roleId: true,
      role: { select: { id: true, name: true } },
      createdAt: true,
    },
  });

  res.status(201).json({ message: 'User created successfully', data: user });
});

// PUT /users/:id - update name, email, or roleId
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const userId = Number(req.params.id);
  const { name, email, roleId, password } = req.body;

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (name) updateData.name = name;
  if (email) updateData.email = email;
  if (roleId) updateData.roleId = Number(roleId);
  if (password && password.trim().length > 0) {
    updateData.password = await bcrypt.hash(password, 10);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      roleId: true,
      role: { select: { id: true, name: true } },
      createdAt: true,
      updatedAt: true,
    },
  });

  res.status(200).json({ message: 'User updated successfully', data: updated });
});

// DELETE /users/:id
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const userId = Number(req.params.id);

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }

  await prisma.user.delete({ where: { id: userId } });
  res.status(200).json({ message: 'User deleted successfully' });
});

// GET /users/roles - list all available roles (for dropdown)
export const getRoles = asyncHandler(async (_req: Request, res: Response) => {
  const roles = await prisma.role.findMany({ orderBy: { id: 'asc' } });
  res.status(200).json({ message: 'Roles fetched successfully', data: roles });
});
