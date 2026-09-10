"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleChat = void 0;
const chat_service_1 = require("../services/chat.service");
const handleChat = async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            res.status(400).json({ error: 'Message is required' });
            return;
        }
        const response = await chat_service_1.chatService.processQuery(message);
        res.status(200).json({ response });
    }
    catch (error) {
        console.error(`[ChatController] Error: ${error.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.handleChat = handleChat;
