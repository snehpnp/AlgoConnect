"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoles = exports.deleteUser = exports.updateUser = exports.createUser = exports.getUsers = void 0;
const prismaClient_1 = __importDefault(require("../models/prismaClient"));
const asyncHandler_1 = require("../utils/asyncHandler");
const bcrypt_1 = __importDefault(require("bcrypt"));
exports.getUsers = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const users = await prismaClient_1.default.user.findMany({
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
exports.createUser = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { name, email, password, roleId } = req.body;
    if (!name || !email || !password || !roleId) {
        throw Object.assign(new Error('Please provide name, email, password, and roleId'), { statusCode: 400 });
    }
    const existing = await prismaClient_1.default.user.findUnique({ where: { email } });
    if (existing) {
        throw Object.assign(new Error('A user with this email already exists'), { statusCode: 409 });
    }
    const roleExists = await prismaClient_1.default.role.findUnique({ where: { id: Number(roleId) } });
    if (!roleExists) {
        throw Object.assign(new Error('Invalid role selected'), { statusCode: 400 });
    }
    const hashed = await bcrypt_1.default.hash(password, 10);
    const user = await prismaClient_1.default.user.create({
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
exports.updateUser = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = Number(req.params.id);
    const { name, email, roleId, password, avatar } = req.body;
    const existing = await prismaClient_1.default.user.findUnique({ where: { id: userId } });
    if (!existing) {
        throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }
    const updateData = {};
    if (name)
        updateData.name = name;
    if (email)
        updateData.email = email;
    if (roleId)
        updateData.roleId = Number(roleId);
    if (avatar !== undefined)
        updateData.avatar = avatar; // Allow setting null or string
    if (password && password.trim().length > 0) {
        updateData.password = await bcrypt_1.default.hash(password, 10);
    }
    const updated = await prismaClient_1.default.user.update({
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
exports.deleteUser = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = Number(req.params.id);
    const existing = await prismaClient_1.default.user.findUnique({ where: { id: userId } });
    if (!existing) {
        throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }
    await prismaClient_1.default.user.delete({ where: { id: userId } });
    res.status(200).json({ message: 'User deleted successfully' });
});
// GET /users/roles - list all available roles (for dropdown)
exports.getRoles = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const roles = await prismaClient_1.default.role.findMany({ orderBy: { id: 'asc' } });
    res.status(200).json({ message: 'Roles fetched successfully', data: roles });
});
