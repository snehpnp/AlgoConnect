"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.forgotPassword = exports.changePassword = exports.register = exports.me = exports.logout = exports.login = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const prismaClient_1 = __importDefault(require("../models/prismaClient"));
const asyncHandler_1 = require("../utils/asyncHandler");
const errorHandler_1 = require("../middlewares/errorHandler");
const emailService_1 = require("../utils/emailService");
// ─── LOGIN ───────────────────────────────────────────────────────────────────
exports.login = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        throw new errorHandler_1.AppError('Email and password are required.', 400);
    }
    const user = await prismaClient_1.default.user.findUnique({
        where: { email: email.toLowerCase().trim() },
        include: { role: true },
    });
    if (!user) {
        throw new errorHandler_1.AppError('Invalid email or password.', 401);
    }
    const isValid = await bcrypt_1.default.compare(password, user.password);
    if (!isValid) {
        throw new errorHandler_1.AppError('Invalid email or password.', 401);
    }
    const token = jsonwebtoken_1.default.sign({ id: user.id, roleId: user.roleId, role: user.role.name }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    res.status(200).json({
        message: 'Login successful',
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role.name,
            avatar: user.avatar,
        },
    });
});
// ─── LOGOUT ──────────────────────────────────────────────────────────────────
exports.logout = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    res.clearCookie('token');
    res.status(200).json({ message: 'Logged out successfully' });
});
// ─── GET CURRENT USER ────────────────────────────────────────────────────────
exports.me = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        throw new errorHandler_1.AppError('Not authenticated', 401);
    }
    const user = await prismaClient_1.default.user.findUnique({
        where: { id: req.user.id },
        include: { role: true },
    });
    if (!user) {
        throw new errorHandler_1.AppError('User not found', 404);
    }
    res.status(200).json({
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role.name,
            avatar: user.avatar,
        },
    });
});
// ─── REGISTER ────────────────────────────────────────────────────────────────
exports.register = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { email, password, name, roleId } = req.body;
    if (!email || !password || !name || !roleId) {
        throw new errorHandler_1.AppError('Please provide email, password, name, and roleId.', 400);
    }
    const existingUser = await prismaClient_1.default.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existingUser) {
        throw new errorHandler_1.AppError('A user with this email already exists.', 409);
    }
    const hashedPassword = await bcrypt_1.default.hash(password, 10);
    const newUser = await prismaClient_1.default.user.create({
        data: { email: email.toLowerCase().trim(), password: hashedPassword, name, roleId },
        include: { role: true },
    });
    res.status(201).json({
        message: 'User registered successfully',
        user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role.name },
    });
});
// ─── CHANGE PASSWORD ──────────────────────────────────────────────────────────
exports.changePassword = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;
    if (!userId)
        throw new errorHandler_1.AppError('Unauthorized.', 401);
    if (!currentPassword || !newPassword) {
        throw new errorHandler_1.AppError('Current password and new password are required.', 400);
    }
    if (newPassword.length < 6) {
        throw new errorHandler_1.AppError('New password must be at least 6 characters.', 400);
    }
    const user = await prismaClient_1.default.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new errorHandler_1.AppError('User not found.', 404);
    const isValid = await bcrypt_1.default.compare(currentPassword, user.password);
    if (!isValid)
        throw new errorHandler_1.AppError('Current password is incorrect.', 401);
    const hashedPassword = await bcrypt_1.default.hash(newPassword, 10);
    await prismaClient_1.default.user.update({ where: { id: userId }, data: { password: hashedPassword } });
    res.status(200).json({ message: 'Password updated successfully.' });
});
// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────
exports.forgotPassword = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { email } = req.body;
    if (!email) {
        throw new errorHandler_1.AppError('Email address is required.', 400);
    }
    const user = await prismaClient_1.default.user.findUnique({
        where: { email: email.toLowerCase().trim() },
    });
    if (!user) {
        // Security: do NOT reveal if user exists — but we throw a clear message here
        // since admin use case. You can change this to a generic message if needed.
        throw new errorHandler_1.AppError('No account found with this email address.', 404);
    }
    // Generate a secure random token
    const resetToken = crypto_1.default.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    // Save hashed token to DB
    const hashedToken = crypto_1.default.createHash('sha256').update(resetToken).digest('hex');
    await prismaClient_1.default.user.update({
        where: { id: user.id },
        data: {
            passwordResetToken: hashedToken,
            passwordResetExpiry: resetTokenExpiry,
        },
    });
    // Build reset link
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;
    // Send email
    try {
        const transporter = await (0, emailService_1.getEmailTransporter)();
        const senderId = await (0, emailService_1.getEmailSenderId)();
        await transporter.sendMail({
            from: senderId,
            to: user.email,
            subject: 'AlgoConnect – Password Reset Request',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 12px;">
          <div style="text-align:center; margin-bottom:24px;">
            <h2 style="color:#1e40af; font-size:22px; margin:0;">AlgoConnect</h2>
            <p style="color:#64748b; font-size:13px; margin:4px 0 0;">Sales & CRM Platform</p>
          </div>
          <div style="background:#ffffff; border-radius:10px; padding:28px; border:1px solid #e2e8f0;">
            <h3 style="color:#0f172a; margin-top:0;">Password Reset Request</h3>
            <p style="color:#475569; font-size:14px; line-height:1.6;">
              Hi <strong>${user.name}</strong>,<br/><br/>
              We received a request to reset the password for your AlgoConnect account.
              Click the button below to set a new password. This link is valid for <strong>1 hour</strong>.
            </p>
            <div style="text-align:center; margin:28px 0;">
              <a href="${resetLink}" style="display:inline-block; background:#2563eb; color:#ffffff; text-decoration:none; padding:12px 28px; border-radius:8px; font-size:14px; font-weight:600;">
                Reset My Password
              </a>
            </div>
            <p style="color:#94a3b8; font-size:12px; line-height:1.6;">
              If you did not request a password reset, please ignore this email. Your password will not change.<br/><br/>
              For security, this link will expire in 1 hour.
            </p>
            <hr style="border:none; border-top:1px solid #e2e8f0; margin:20px 0;" />
            <p style="color:#94a3b8; font-size:11px; text-align:center;">
              © ${new Date().getFullYear()} AlgoConnect. All rights reserved.
            </p>
          </div>
        </div>
      `,
        });
    }
    catch (emailErr) {
        // Roll back the token if email sending fails
        await prismaClient_1.default.user.update({
            where: { id: user.id },
            data: { passwordResetToken: null, passwordResetExpiry: null },
        });
        throw new errorHandler_1.AppError('Failed to send reset email. Please check your email integration settings.', 503);
    }
    res.status(200).json({
        message: `Password reset link has been sent to ${user.email}. Please check your inbox.`,
    });
});
// ─── RESET PASSWORD ────────────────────────────────────────────────────────────
exports.resetPassword = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { token, email, newPassword } = req.body;
    if (!token || !email || !newPassword) {
        throw new errorHandler_1.AppError('Token, email, and new password are required.', 400);
    }
    if (newPassword.length < 6) {
        throw new errorHandler_1.AppError('Password must be at least 6 characters.', 400);
    }
    const hashedToken = crypto_1.default.createHash('sha256').update(token).digest('hex');
    const user = await prismaClient_1.default.user.findFirst({
        where: {
            email: email.toLowerCase().trim(),
            passwordResetToken: hashedToken,
            passwordResetExpiry: { gt: new Date() }, // token not expired
        },
    });
    if (!user) {
        throw new errorHandler_1.AppError('Password reset link is invalid or has expired. Please request a new one.', 400);
    }
    const hashedPassword = await bcrypt_1.default.hash(newPassword, 10);
    await prismaClient_1.default.user.update({
        where: { id: user.id },
        data: {
            password: hashedPassword,
            passwordResetToken: null,
            passwordResetExpiry: null,
        },
    });
    res.status(200).json({ message: 'Password has been reset successfully. You can now log in.' });
});
