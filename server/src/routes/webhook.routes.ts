import { Router } from 'express';
import { handleEmailWebhook } from '../controllers/webhook.controller';

const router = Router();

// Handle all email events (Open, Click, Delivered, Bounced, etc)
router.post('/email', handleEmailWebhook);
router.post('/email/delivered', handleEmailWebhook);
router.post('/email/opened', handleEmailWebhook);
router.post('/email/clicked', handleEmailWebhook);
router.post('/email/replied', handleEmailWebhook);
router.post('/email/bounced', handleEmailWebhook);
router.post('/email/unsubscribed', handleEmailWebhook);
router.post('/email/spam', handleEmailWebhook);

export default router;
