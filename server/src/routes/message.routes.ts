import { Router } from 'express';
import { getCampaignMessages, getMessageDetails, getEmailAnalytics, simulateSend, getLeadMessages } from '../controllers/message.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/analytics/email', getEmailAnalytics);
router.get('/campaigns/:id/messages', getCampaignMessages);
router.post('/campaigns/:id/send', simulateSend);
router.get('/leads/:leadId', getLeadMessages);
router.get('/:id', getMessageDetails);

export default router;
