import { Router } from 'express';
import { whatsappService } from '../services/whatsapp.service';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/status', authenticate, (req, res) => {
  const status = whatsappService.getStatus();
  res.status(200).json({ success: true, ...status });
});

router.post('/logout', authenticate, async (req, res) => {
  try {
    await whatsappService.logout();
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to logout' });
  }
});

export default router;
