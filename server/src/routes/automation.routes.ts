import { Router } from 'express';
import { 
  getAutomations, 
  createAutomation, 
  updateAutomation, 
  deleteAutomation 
} from '../controllers/automation.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate, getAutomations);
router.post('/', authenticate, createAutomation);
router.put('/:id', authenticate, updateAutomation);
router.delete('/:id', authenticate, deleteAutomation);

export default router;
