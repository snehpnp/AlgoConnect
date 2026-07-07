import { Router } from 'express';
import { createSegment, getSegments, previewSegment, deleteSegment } from '../controllers/segment.controller';

const router = Router();

router.post('/', createSegment);
router.get('/', getSegments);
router.post('/preview', previewSegment);
router.delete('/:id', deleteSegment);

export default router;
