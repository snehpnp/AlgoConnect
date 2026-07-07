import { Router } from 'express';
import { getConsents, updateConsent } from '../controllers/consent.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', getConsents);
router.post('/:leadId', updateConsent);

export default router;
