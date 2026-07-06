import { Router } from 'express';
import { getUsers, createUser, updateUser, deleteUser, getRoles } from '../controllers/user.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// All user routes require authentication (admin only enforcement can be middleware-extended later)
router.get('/', authenticate, getUsers);
router.get('/roles', authenticate, getRoles);
router.post('/', authenticate, createUser);
router.put('/:id', authenticate, updateUser);
router.delete('/:id', authenticate, deleteUser);

export default router;
