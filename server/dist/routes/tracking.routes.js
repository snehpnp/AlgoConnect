"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tracking_controller_1 = require("../controllers/tracking.controller");
const router = (0, express_1.Router)();
// Endpoint for the 1x1 tracking pixel
router.get('/open/:messageId', tracking_controller_1.trackEmailOpen);
exports.default = router;
