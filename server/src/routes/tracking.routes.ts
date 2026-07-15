import { Router } from 'express';
import { trackEmailOpen } from '../controllers/tracking.controller';

const router = Router();

// Endpoint for the 1x1 tracking pixel
router.get('/open/:messageId', trackEmailOpen);

export default router;
