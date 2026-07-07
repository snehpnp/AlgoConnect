import { Router } from 'express';
import { createSegment, getSegments, previewSegment, deleteSegment, getSegmentLeads } from '../controllers/segment.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.post('/', authenticate, createSegment);
router.get('/', authenticate, getSegments);
router.post('/preview', authenticate, previewSegment);
router.delete('/:id', authenticate, deleteSegment);
router.get('/:id/leads', authenticate, getSegmentLeads);

export default router;
