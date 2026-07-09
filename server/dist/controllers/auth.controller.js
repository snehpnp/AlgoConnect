"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePassword = exports.register = exports.login = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prismaClient_1 = __importDefault(require("../models/prismaClient"));
const asyncHandler_1 = require("../utils/asyncHandler");
exports.login = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        throw new Error('Email and password are required');
    // Include role in query
    const user = await prismaClient_1.default.user.findUnique({
        where: { email },
        include: { role: true },
    });
    if (!user)
        throw new Error('Invalid credentials');
    const isValid = await bcrypt_1.default.compare(password, user.password);
    if (!isValid)
        throw new Error('Invalid credentials');
    const token = jsonwebtoken_1.default.sign({ id: user.id, roleId: user.roleId, role: user.role.name }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
    res.status(200).json({
        message: 'Login successful',
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role.name,
            avatar: user.avatar,
        },
    });
});
exports.register = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { email, password, name, roleId } = req.body;
    if (!email || !password || !name || !roleId) {
        throw new Error('Please provide email, password, name, and roleId');
    }
    const existingUser = await prismaClient_1.default.user.findUnique({ where: { email } });
    if (existingUser)
        throw new Error('User already exists');
    const hashedPassword = await bcrypt_1.default.hash(password, 10);
    const newUser = await prismaClient_1.default.user.create({
        data: { email, password: hashedPassword, name, roleId },
        include: { role: true },
    });
    res.status(201).json({
        message: 'User registered successfully',
        user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role.name },
    });
});
exports.changePassword = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;
    if (!userId)
        throw new Error('Unauthorized');
    if (!currentPassword || !newPassword)
        throw new Error('Current and new passwords are required');
    const user = await prismaClient_1.default.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new Error('User not found');
    const isValid = await bcrypt_1.default.compare(currentPassword, user.password);
    if (!isValid)
        throw new Error('Incorrect current password');
    const hashedPassword = await bcrypt_1.default.hash(newPassword, 10);
    await prismaClient_1.default.user.update({
        where: { id: userId },
        data: { password: hashedPassword }
    });
    res.status(200).json({ message: 'Password updated successfully' });
});
