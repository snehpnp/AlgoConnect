"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ai_controller_1 = require("../controllers/ai.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Only authenticated users can generate templates
router.post('/generate-template', auth_middleware_1.authenticate, ai_controller_1.generateTemplate);
exports.default = router;
