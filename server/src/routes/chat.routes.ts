import { Router } from 'express';
import { handleChat } from '../controllers/chat.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Endpoint for sending chat messages to the AI
router.post('/', authenticate, handleChat);

export default router;
