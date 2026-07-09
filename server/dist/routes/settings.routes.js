"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const settings_controller_1 = require("../controllers/settings.controller");
const router = (0, express_1.Router)();
router.get('/integrations', settings_controller_1.getAllSettings);
router.put('/integrations/:type', settings_controller_1.updateSetting);
router.post('/integrations/:type/test', settings_controller_1.testIntegration);
exports.default = router;
