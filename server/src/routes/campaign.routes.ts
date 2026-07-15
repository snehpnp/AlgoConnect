import { Router } from 'express';
import { getCampaigns, getCampaignById, createCampaign, updateCampaign, deleteCampaign, addLeadsToCampaign, removeLeadFromCampaign, getCampaignStats, getEngineStatus, toggleEngineStatus, sendManualMessage, getCampaignLogs, getCampaignLogDetail, sendProductLaunchBroadcast } from '../controllers/campaign.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.post('/broadcast', authenticate, sendProductLaunchBroadcast);

router.get('/engine/status', authenticate, getEngineStatus);
router.post('/engine/toggle', authenticate, toggleEngineStatus);

router.get('/', authenticate, getCampaigns);
router.get('/:id', authenticate, getCampaignById);
router.get('/:id/stats', authenticate, getCampaignStats);
router.get('/:id/logs', authenticate, getCampaignLogs);
router.get('/:id/logs/:logId', authenticate, getCampaignLogDetail);
router.post('/', authenticate, createCampaign);
router.put('/:id', authenticate, updateCampaign);
router.delete('/:id', authenticate, deleteCampaign);

router.post('/:id/leads', authenticate, addLeadsToCampaign);
router.delete('/:id/leads/:leadId', authenticate, removeLeadFromCampaign);
router.post('/:id/manual-message', authenticate, sendManualMessage);

export default router;
