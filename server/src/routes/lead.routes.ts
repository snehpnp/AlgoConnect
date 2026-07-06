import { Router } from 'express';
import { importLeads, getLeads, createLead, updateLead } from '../controllers/lead.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// All lead routes require a valid JWT token
router.get('/', authenticate, getLeads);
router.post('/', authenticate, createLead);
router.put('/:id', authenticate, updateLead);
router.post('/import', authenticate, importLeads);

export default router;
