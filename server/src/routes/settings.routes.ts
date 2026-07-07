import { Router } from 'express';
import { getAllSettings, updateSetting, testIntegration } from '../controllers/settings.controller';

const router = Router();

router.get('/integrations', getAllSettings);
router.put('/integrations/:type', updateSetting);
router.post('/integrations/:type/test', testIntegration);

export default router;
