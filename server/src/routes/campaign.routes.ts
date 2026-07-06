import { Router } from 'express';
import { getCampaigns, createCampaign } from '../controllers/campaign.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate, getCampaigns);
router.post('/', authenticate, createCampaign);

export default router;
