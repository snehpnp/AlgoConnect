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
      role: user.role.name,
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
    data: { email, password: hashedPassword, name, roleId },
    include: { role: true },
  });

  res.status(201).json({
    message: 'User registered successfully',
    user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role.name },
  });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { currentPassword, newPassword } = req.body;

  if (!userId) throw new Error('Unauthorized');
  if (!currentPassword || !newPassword) throw new Error('Current and new passwords are required');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) throw new Error('Incorrect current password');

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword }
  });

  res.status(200).json({ message: 'Password updated successfully' });
});
