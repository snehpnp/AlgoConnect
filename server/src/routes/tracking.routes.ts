import { Router } from 'express';
import { trackOpen, trackClick } from '../controllers/tracking.controller';

const router = Router();

// These endpoints do not require authentication because they are hit by the email clients / redirect links
router.get('/open/:emailLogId', trackOpen);
router.get('/click/:emailLogId', trackClick);

export default router;
