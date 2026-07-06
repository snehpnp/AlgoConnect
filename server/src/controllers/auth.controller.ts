import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../models/prismaClient';
import { asyncHandler } from '../utils/asyncHandler';

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) throw new Error('Email and password are required');

  // Include role in query
  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true },
  });
  if (!user) throw new Error('Invalid credentials');

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) throw new Error('Invalid credentials');

  const token = jwt.sign(
    { id: user.id, roleId: user.roleId, role: user.role.name },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '1d' }
  );

  res.status(200).json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name, // 'admin' | 'manager' | 'agent'
    },
  });
});

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, name, roleId } = req.body;

  if (!email || !password || !name || !roleId) {
    throw new Error('Please provide email, password, name, and roleId');
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new Error('User already exists');

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await prisma.user.create({
    data: {