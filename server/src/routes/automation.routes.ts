import { Router } from 'express';
import { 
  getAutomations, 
  createAutomation, 
  updateAutomation, 
  deleteAutomation,
  getGlobalToggle,
  updateGlobalToggle
} from '../controllers/automation.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/toggle', authenticate, getGlobalToggle);
router.patch('/toggle', authenticate, updateGlobalToggle);

router.get('/', authenticate, getAutomations);
router.post('/', authenticate, createAutomation);
router.put('/:id', authenticate, updateAutomation);
router.delete('/:id', authenticate, deleteAutomation);

export default router;
