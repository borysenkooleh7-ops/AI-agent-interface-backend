import { Router } from 'express';
import * as userManagementController from '../controllers/userManagement.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  role: z.enum(['ADMIN', 'MANAGER', 'AGENT']),
  phone: z.string().optional()
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'AGENT']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  phone: z.string().optional()
});

const bulkStatusUpdateSchema = z.object({
  userIds: z.array(z.string()).min(1),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED'])
});

const bulkDeleteSchema = z.object({
  userIds: z.array(z.string()).min(1)
});

// Apply authentication to all routes
router.use(authenticate);

// Routes
router.get('/', authorize(['ADMIN', 'MANAGER']), userManagementController.getAllUsers);
router.get('/statistics', authorize(['ADMIN']), userManagementController.getUserStatistics);
router.get('/:id', authorize(['ADMIN', 'MANAGER']), userManagementController.getUserById);
router.post('/', authorize(['ADMIN']), validate(createUserSchema), userManagementController.createUser);
router.put('/:id', authorize(['ADMIN']), validate(updateUserSchema), userManagementController.updateUser);
router.delete('/:id', authorize(['ADMIN']), userManagementController.deleteUser);
router.patch('/bulk/status', authorize(['ADMIN']), validate(bulkStatusUpdateSchema), userManagementController.bulkUpdateUserStatus);
router.delete('/bulk', authorize(['ADMIN']), validate(bulkDeleteSchema), userManagementController.bulkDeleteUsers);

export default router;
