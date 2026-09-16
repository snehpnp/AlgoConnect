"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearNotifications = exports.markAllAsRead = exports.markAsRead = exports.getNotifications = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const prismaClient_1 = __importDefault(require("../models/prismaClient"));
exports.getNotifications = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    if (!userId)
        return res.status(401).json({ message: 'Unauthorized' });
    const notifications = await prismaClient_1.default.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50
    });
    res.status(200).json(notifications);
});
exports.markAsRead = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    const { id } = req.params;
    await prismaClient_1.default.notification.updateMany({
        where: { id: parseInt(id), userId },
        data: { isRead: true }
    });
    res.status(200).json({ message: 'Marked as read' });
});
exports.markAllAsRead = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    await prismaClient_1.default.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true }
    });
    res.status(200).json({ message: 'All marked as read' });
});
exports.clearNotifications = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.id;
    await prismaClient_1.default.notification.deleteMany({
        where: { userId }
    });
    res.status(200).json({ message: 'Notifications cleared' });
});
