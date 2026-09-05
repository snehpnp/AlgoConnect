import { Router } from 'express';
import { getCampaigns, getCampaignById, createCampaign, updateCampaign, deleteCampaign, addLeadsToCampaign, removeLeadFromCampaign, getCampaignStats, getEngineStatus, toggleEngineStatus, sendManualMessage, getCampaignLogs, getCampaignConnectedLeads, getEngineLogs } from '../controllers/campaign.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/engine/status', authenticate, getEngineStatus);
router.post('/engine/toggle', authenticate, toggleEngineStatus);
router.get('/engine/logs', authenticate, getEngineLogs);

router.get('/', authenticate, getCampaigns);
router.get('/:id', authenticate, getCampaignById);
router.get('/:id/connected-leads', authenticate, getCampaignConnectedLeads);
router.get('/:id/stats', authenticate, getCampaignStats);
router.get('/:id/logs', authenticate, getCampaignLogs);
router.post('/', authenticate, createCampaign);
router.put('/:id', authenticate, updateCampaign);
router.delete('/:id', authenticate, deleteCampaign);

router.post('/:id/leads', authenticate, addLeadsToCampaign);
router.delete('/:id/leads/:leadId', authenticate, removeLeadFromCampaign);
router.post('/:id/manual-message', authenticate, sendManualMessage);

export default router;
