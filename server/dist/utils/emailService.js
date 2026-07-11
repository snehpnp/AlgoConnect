"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmailSenderId = exports.getEmailTransporter = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const prismaClient_1 = __importDefault(require("../models/prismaClient"));
const errorHandler_1 = require("../middlewares/errorHandler");
const getEmailTransporter = async () => {
    const setting = await prismaClient_1.default.integrationSetting.findUnique({
        where: { type: 'EMAIL' },
    });
    if (!setting || !setting.host || !setting.apiKey || !setting.apiSecret) {
        throw new errorHandler_1.AppError('Email service is not configured. Contact your admin.', 503);
    }
    return nodemailer_1.default.createTransport({
        host: setting.host,
        port: Number(setting.port) || 587,
        secure: setting.secure === true,
        auth: { user: setting.apiKey, pass: setting.apiSecret },
    });
};
exports.getEmailTransporter = getEmailTransporter;
const getEmailSenderId = async () => {
    const setting = await prismaClient_1.default.integrationSetting.findUnique({
        where: { type: 'EMAIL' },
    });
    return setting?.senderId || 'noreply@algoconnect.com';
};
exports.getEmailSenderId = getEmailSenderId;
