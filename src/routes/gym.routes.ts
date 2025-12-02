import { Router } from 'express';
import * as gymController from '../controllers/gym.controller';
import * as gymAdvantageController from '../controllers/gymAdvantage.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createGymSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  logo: z.string().optional(),
  settings: z.any().optional()
});

const updateGymSchema = z.object({
  name: z.string().min(2).optional(),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  logo: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'TRIAL']).optional(),
  settings: z.any().optional()
});

const updateSettingsSchema = z.object({
  settings: z.any()
});

const advantageCreateSchema = z.object({
  title: z.string().min(2),
  description: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().optional()
  ),
  order: z.preprocess(
    (val) => (val === '' || val === null ? undefined : Number(val)),
    z.number().int().min(0).optional()
  )
});

const advantageUpdateSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().optional()
  ),
  order: z.preprocess(
    (val) => (val === '' || val === null ? undefined : Number(val)),
    z.number().int().min(0).optional()
  )
}).refine(
  (data) => data.title !== undefined || data.description !== undefined || data.order !== undefined,
  { message: 'At least one field must be provided' }
);

// Public route for registration (no auth required)
router.get('/public/active', gymController.getActiveGymsForRegistration);

// Apply authentication to all routes below
router.use(authenticate);

// Gym routes
router.get('/', authorize(['ADMIN', 'MANAGER', 'AGENT']), gymController.getAllGyms);
router.get('/statistics', authorize(['ADMIN']), gymController.getGymStatistics);
router.get('/slug/:slug', gymController.getGymBySlug);
router.get('/:id', gymController.getGymById);
router.post('/', authorize(['ADMIN']), validate(createGymSchema), gymController.createGym);
router.put('/:id', authorize(['ADMIN']), validate(updateGymSchema), gymController.updateGym);
router.delete('/:id', authorize(['ADMIN']), gymController.deleteGym);
router.patch('/:id/settings', authorize(['ADMIN']), validate(updateSettingsSchema), gymController.updateGymSettings);

// Gym advantages
router.get('/:gymId/advantages', authorize(['ADMIN', 'MANAGER']), gymAdvantageController.listAdvantages);
router.post(
  '/:gymId/advantages',
  authorize(['ADMIN', 'MANAGER']),
  validate(advantageCreateSchema),
  gymAdvantageController.createAdvantage
);
router.put(
  '/:gymId/advantages/:advantageId',
  authorize(['ADMIN', 'MANAGER']),
  validate(advantageUpdateSchema),
  gymAdvantageController.updateAdvantage
);
router.delete(
  '/:gymId/advantages/:advantageId',
  authorize(['ADMIN', 'MANAGER']),
  gymAdvantageController.deleteAdvantage
);

export default router;
