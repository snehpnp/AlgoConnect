import { Request, Response } from 'express';
import prisma from '../models/prismaClient';
import { asyncHandler } from '../utils/asyncHandler';
import bcrypt from 'bcrypt';
import { getEmailTransporter, getEmailSenderId } from '../utils/emailService';

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

  // Try to send welcome email
  try {
    const transporter = await getEmailTransporter();
    const senderId = await getEmailSenderId();
    
    const loginUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    await transporter.sendMail({
      from: senderId,
      to: user.email,
      subject: 'Welcome to AlgoConnect - Your Account Details',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 12px;">
          <div style="text-align:center; margin-bottom:24px;">
            <h2 style="color:#1e40af; font-size:22px; margin:0;">AlgoConnect</h2>
            <p style="color:#64748b; font-size:13px; margin:4px 0 0;">Sales & CRM Platform</p>
          </div>
          <div style="background:#ffffff; border-radius:10px; padding:28px; border:1px solid #e2e8f0;">
            <h3 style="color:#0f172a; margin-top:0;">Welcome aboard, ${user.name}!</h3>
            <p style="color:#475569; font-size:14px; line-height:1.6;">
              An administrator has created a new account for you on AlgoConnect.<br/>
              Your assigned role is: <strong>${user.role.name}</strong>
            </p>
            
            <div style="background:#f1f5f9; padding:16px; border-radius:8px; margin:20px 0;">
              <p style="margin:0; font-size:13px; color:#475569;"><strong>Login ID (Email):</strong> ${user.email}</p>
              <p style="margin:8px 0 0; font-size:13px; color:#475569;"><strong>Password:</strong> ${password}</p>
            </div>

            <div style="text-align:center; margin:28px 0;">
              <a href="${loginUrl}" style="display:inline-block; background:#2563eb; color:#ffffff; text-decoration:none; padding:12px 28px; border-radius:8px; font-size:14px; font-weight:600;">
                Login to AlgoConnect
              </a>
            </div>
            
            <p style="color:#94a3b8; font-size:12px; line-height:1.6;">
              Please change your password immediately after logging in for the first time.
            </p>
            <hr style="border:none; border-top:1px solid #e2e8f0; margin:20px 0;" />
            <p style="color:#94a3b8; font-size:11px; text-align:center;">
              © ${new Date().getFullYear()} AlgoConnect. All rights reserved.
            </p>
          </div>
        </div>
      `,
    });
  } catch (emailError) {
    console.error('Failed to send welcome email:', emailError);
    // We do not fail the user creation if email fails
  }

  res.status(201).json({ message: 'User created successfully', data: user });
});

// PUT /users/:id - update name, email, or roleId
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const userId = Number(req.params.id);
  const { name, email, roleId, password, avatar } = req.body;

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (name) updateData.name = name;
  if (email) updateData.email = email;
  if (roleId) updateData.roleId = Number(roleId);
  if (avatar !== undefined) updateData.avatar = avatar; // Allow setting null or string
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
