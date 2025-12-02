import { Router } from 'express';
import * as planController from '../controllers/plan.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createPlanSchema = z.object({
  gymId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().min(0),
  duration: z.number().int().min(1),
  features: z.any().optional(),
  active: z.boolean().optional()
});

const updatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().min(0).optional(),
  duration: z.number().int().min(1).optional(),
  features: z.any().optional(),
  active: z.boolean().optional()
});

// Apply authentication to all routes
router.use(authenticate);

// Apply authorization - only ADMIN and MANAGER can manage plans
router.use(authorize(['ADMIN', 'MANAGER']));

// Routes
router.get('/', planController.getAllPlans);
router.get('/gym/:gymId', planController.getPlansByGymId);
router.get('/:id', planController.getPlanById);
router.post('/', validate(createPlanSchema), planController.createPlan);
router.put('/:id', validate(updatePlanSchema), planController.updatePlan);
router.delete('/:id', planController.deletePlan);

export default router;

