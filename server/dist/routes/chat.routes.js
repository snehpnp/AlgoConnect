"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chat_controller_1 = require("../controllers/chat.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Endpoint for sending chat messages to the AI
router.post('/', auth_middleware_1.authenticate, chat_controller_1.handleChat);
exports.default = router;
