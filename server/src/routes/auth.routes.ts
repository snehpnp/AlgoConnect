import { Router } from 'express';
import { login, register, changePassword, forgotPassword, resetPassword, logout, me } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/me', authenticate, me);
router.post('/register', register);
router.post('/change-password', authenticate, changePassword);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
