import { Router } from 'express';
import { getCampaigns, getCampaignById, createCampaign, updateCampaign, deleteCampaign, addLeadsToCampaign, removeLeadFromCampaign } from '../controllers/campaign.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate, getCampaigns);
router.get('/:id', authenticate, getCampaignById);
router.post('/', authenticate, createCampaign);
router.put('/:id', authenticate, updateCampaign);
router.delete('/:id', authenticate, deleteCampaign);

router.post('/:id/leads', authenticate, addLeadsToCampaign);
router.delete('/:id/leads/:leadId', authenticate, removeLeadFromCampaign);

export default router;
