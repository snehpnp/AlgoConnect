import { Router } from 'express';
import { trackEmailOpen, trackLinkClick } from '../controllers/tracking.controller';

const router = Router();

// Endpoint for the 1x1 tracking pixel
router.get('/open/:messageId', trackEmailOpen);

// Endpoint for link click tracking
router.get('/click/:trackingId', trackLinkClick);

export default router;
