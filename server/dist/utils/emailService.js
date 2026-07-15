"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmailSenderId = exports.getEmailTransporter = void 0;
const nodemailer = __importStar(require("nodemailer"));
const prismaClient_1 = __importDefault(require("../models/prismaClient"));
const errorHandler_1 = require("../middlewares/errorHandler");
const getEmailTransporter = async () => {
    const setting = await prismaClient_1.default.integrationSetting.findUnique({
        where: { type: 'EMAIL' },
    });
    if (!setting || !setting.host || !setting.apiKey || !setting.apiSecret) {
        throw new errorHandler_1.AppError('Email service is not configured. Contact your admin.', 503);
    }
    return nodemailer.createTransport({
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
