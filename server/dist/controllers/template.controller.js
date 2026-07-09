"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTemplate = exports.updateTemplate = exports.createTemplate = exports.getTemplateById = exports.getTemplates = void 0;
const prismaClient_1 = __importDefault(require("../models/prismaClient"));
const asyncHandler_1 = require("../utils/asyncHandler");
exports.getTemplates = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const templates = await prismaClient_1.default.messageTemplate.findMany({
        orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ data: templates, message: 'Templates retrieved successfully' });
});
exports.getTemplateById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const template = await prismaClient_1.default.messageTemplate.findUnique({
        where: { id: parseInt(id) }
    });
    if (!template) {
        throw new Error('Template not found');
    }
    res.status(200).json({ data: template, message: 'Template retrieved successfully' });
});
exports.createTemplate = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { name, content, type, status } = req.body;
    if (!name || !content || !type) {
        throw new Error('Name, content, and type are required');
    }
    const newTemplate = await prismaClient_1.default.messageTemplate.create({
        data: {
            name,
            content,
            type,
            status: status || 'PENDING'
        }
    });
    res.status(201).json({ data: newTemplate, message: 'Template created successfully' });
});
exports.updateTemplate = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { name, content, type, status } = req.body;
    const template = await prismaClient_1.default.messageTemplate.update({
        where: { id: parseInt(id) },
        data: {
            name,
            content,
            type,
            status
        }
    });
    res.status(200).json({ data: template, message: 'Template updated successfully' });
});
exports.deleteTemplate = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    await prismaClient_1.default.messageTemplate.delete({
        where: { id: parseInt(id) }
    });
    res.status(200).json({ message: 'Template deleted successfully' });
});
