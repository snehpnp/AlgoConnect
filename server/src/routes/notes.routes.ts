import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import {
  getNotes, createNote, deleteNote,
  setFollowUp, getTodaysFollowUps, getOverdueFollowUps,
  exportLeadsCSV
} from '../controllers/notes.controller';

const router = Router();

// Notes
router.get('/leads/:leadId/notes', authenticate, getNotes);
router.post('/leads/:leadId/notes', authenticate, createNote);
router.delete('/notes/:id', authenticate, deleteNote);

// Follow-Up
router.put('/leads/:leadId/follow-up', authenticate, setFollowUp);
router.get('/follow-ups/today', authenticate, getTodaysFollowUps);
router.get('/follow-ups/overdue', authenticate, getOverdueFollowUps);

// CSV Export
router.get('/leads/export/csv', authenticate, exportLeadsCSV);

export default router;
