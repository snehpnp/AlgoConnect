"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const notes_controller_1 = require("../controllers/notes.controller");
const router = (0, express_1.Router)();
// Notes
router.get('/leads/:leadId/notes', auth_middleware_1.authenticate, notes_controller_1.getNotes);
router.post('/leads/:leadId/notes', auth_middleware_1.authenticate, notes_controller_1.createNote);
router.delete('/notes/:id', auth_middleware_1.authenticate, notes_controller_1.deleteNote);
// Follow-Up
router.put('/leads/:leadId/follow-up', auth_middleware_1.authenticate, notes_controller_1.setFollowUp);
router.get('/follow-ups/today', auth_middleware_1.authenticate, notes_controller_1.getTodaysFollowUps);
router.get('/follow-ups/overdue', auth_middleware_1.authenticate, notes_controller_1.getOverdueFollowUps);
// CSV Export
router.get('/leads/export/csv', auth_middleware_1.authenticate, notes_controller_1.exportLeadsCSV);
exports.default = router;
