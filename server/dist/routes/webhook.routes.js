"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const webhook_controller_1 = require("../controllers/webhook.controller");
const router = (0, express_1.Router)();
// Handle all email events (Open, Click, Delivered, Bounced, etc)
router.post('/email', webhook_controller_1.handleEmailWebhook);
router.post('/email/delivered', webhook_controller_1.handleEmailWebhook);
router.post('/email/opened', webhook_controller_1.handleEmailWebhook);
router.post('/email/clicked', webhook_controller_1.handleEmailWebhook);
router.post('/email/replied', webhook_controller_1.handleEmailWebhook);
router.post('/email/bounced', webhook_controller_1.handleEmailWebhook);
router.post('/email/unsubscribed', webhook_controller_1.handleEmailWebhook);
router.post('/email/spam', webhook_controller_1.handleEmailWebhook);
exports.default = router;
