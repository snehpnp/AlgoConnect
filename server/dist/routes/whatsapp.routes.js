"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const whatsapp_service_1 = require("../services/whatsapp.service");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const whatsapp_controller_1 = require("../controllers/whatsapp.controller");
const router = (0, express_1.Router)();
console.log("----------------------------------");
router.get('/leads/:leadId/chat', auth_middleware_1.authenticate, whatsapp_controller_1.getLeadWhatsAppHistory);
router.post('/leads/:leadId/send', auth_middleware_1.authenticate, whatsapp_controller_1.sendWhatsAppMessage);
router.get('/status', auth_middleware_1.authenticate, (req, res) => {
    const status = whatsapp_service_1.whatsappService.getStatus();
    res.status(200).json({ success: true, ...status });
});
router.post('/logout', auth_middleware_1.authenticate, async (req, res) => {
    try {
        await whatsapp_service_1.whatsappService.logout();
        res.status(200).json({ success: true, message: 'Logged out successfully' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to logout' });
    }
});
exports.default = router;
