import { Router } from 'express';
import { generateTemplate } from '../controllers/ai.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Only authenticated users can generate templates
router.post('/generate-template', authenticate, generateTemplate);

export default router;
