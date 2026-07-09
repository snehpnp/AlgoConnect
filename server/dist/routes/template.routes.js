"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const template_controller_1 = require("../controllers/template.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Apply auth middleware to all routes
router.use(auth_middleware_1.authenticate);
router.route('/')
    .get(template_controller_1.getTemplates)
    .post(template_controller_1.createTemplate);
router.route('/:id')
    .get(template_controller_1.getTemplateById)
    .put(template_controller_1.updateTemplate)
    .delete(template_controller_1.deleteTemplate);
exports.default = router;
