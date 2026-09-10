"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAutomation = exports.updateAutomation = exports.createAutomation = exports.getAutomations = void 0;
const prismaClient_1 = __importDefault(require("../models/prismaClient"));
const asyncHandler_1 = require("../utils/asyncHandler");
exports.getAutomations = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { campaignId } = req.query;
    const whereClause = campaignId ? { campaignId: parseInt(campaignId) } : {};
    const automations = await prismaClient_1.default.campaignAutomation.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        include: {
            campaign: { select: { id: true, name: true } }
        }
    });
    res.status(200).json({ data: automations, message: 'Automations retrieved successfully' });
});
exports.createAutomation = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { name, campaignId, trigger, waitTime, condition, action, status } = req.body;
    if (!name || !campaignId || !trigger || !action) {
        throw new Error('Name, campaignId, trigger, and action are required');
    }
    const automation = await prismaClient_1.default.campaignAutomation.create({
        data: {
            name,
            campaignId: parseInt(campaignId),
            trigger,
            waitTime: waitTime ? parseInt(waitTime) : null,
            condition,
            action,
            status: status || 'ACTIVE'
        }
    });
    res.status(201).json({ message: 'Automation created successfully', data: automation });
});
exports.updateAutomation = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { name, trigger, waitTime, condition, action, status } = req.body;
    const dataToUpdate = { name, trigger, condition, action, status };
    if (waitTime !== undefined)
        dataToUpdate.waitTime = waitTime ? parseInt(waitTime) : null;
    const automation = await prismaClient_1.default.campaignAutomation.update({
        where: { id: parseInt(id) },
        data: dataToUpdate
    });
    res.status(200).json({ message: 'Automation updated successfully', data: automation });
});
exports.deleteAutomation = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    await prismaClient_1.default.campaignAutomation.delete({
        where: { id: parseInt(id) }
    });
    res.status(200).json({ message: 'Automation deleted successfully' });
});
