import { Router } from 'express';
import { getUsers, createUser, updateUser, deleteUser, getRoles } from '../controllers/user.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// All user routes require authentication
router.get('/', authenticate, getUsers);
router.get('/roles', authenticate, getRoles);

// Only System Admin can manage (add/edit/delete) users and roles
router.post('/', authenticate, authorizeRoles('System Admin'), createUser);
router.put('/:id', authenticate, authorizeRoles('System Admin'), updateUser);
router.delete('/:id', authenticate, authorizeRoles('System Admin'), deleteUser);

export default router;
