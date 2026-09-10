import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { getAuditLogs, getAuditLogFilters } from '../controllers/audit.controller';

const router = Router();

router.use(authenticate);

router.get('/', getAuditLogs);
router.get('/filters', getAuditLogFilters);

export default router;
