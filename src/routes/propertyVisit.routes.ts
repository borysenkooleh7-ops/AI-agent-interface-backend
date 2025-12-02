import { Router } from 'express';
import * as visitController from '../controllers/propertyVisit.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { z } from 'zod';

const router = Router();

// Esquemas de validación
const createVisitSchema = z.object({
  agencyId: z.string().min(1, 'Se requiere agencyId'),
  propertyId: z.string().min(1, 'Se requiere propertyId'),
  leadId: z.string().min(1, 'Se requiere leadId'),
  agentId: z.string().optional(),
  scheduledAt: z.string().transform(val => new Date(val)),
  duration: z.number().int().min(15).max(180).optional(),
  notes: z.string().optional()
});

const updateVisitSchema = z.object({
  agentId: z.string().optional(),
  scheduledAt: z.string().transform(val => new Date(val)).optional(),
  duration: z.number().int().min(15).max(180).optional(),
  notes: z.string().optional(),
  feedback: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional()
});

const completeVisitSchema = z.object({
  feedback: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional()
});

const cancelVisitSchema = z.object({
  reason: z.string().optional()
});

const rescheduleVisitSchema = z.object({
  newDate: z.string().min(1, 'Se requiere newDate')
});

// Aplicar autenticación a todas las rutas
router.use(authenticate);

// Rutas de visitas
router.get('/', authorize(['ADMIN', 'MANAGER', 'AGENT']), visitController.getAllVisits);
router.get('/today/:agencyId', authorize(['ADMIN', 'MANAGER', 'AGENT']), visitController.getTodayVisits);
router.get('/upcoming/:agencyId', authorize(['ADMIN', 'MANAGER', 'AGENT']), visitController.getUpcomingVisits);
router.get('/statistics/:agencyId', authorize(['ADMIN', 'MANAGER']), visitController.getVisitStatistics);
router.get('/agent/:agentId/availability', authorize(['ADMIN', 'MANAGER', 'AGENT']), visitController.getAgentAvailability);
router.get('/:id', authorize(['ADMIN', 'MANAGER', 'AGENT']), visitController.getVisitById);

router.post('/', authorize(['ADMIN', 'MANAGER', 'AGENT']), validate(createVisitSchema), visitController.createVisit);

router.put('/:id', authorize(['ADMIN', 'MANAGER', 'AGENT']), validate(updateVisitSchema), visitController.updateVisit);

// Acciones de estado
router.patch('/:id/confirm', authorize(['ADMIN', 'MANAGER', 'AGENT']), visitController.confirmVisit);
router.patch('/:id/complete', authorize(['ADMIN', 'MANAGER', 'AGENT']), validate(completeVisitSchema), visitController.completeVisit);
router.patch('/:id/cancel', authorize(['ADMIN', 'MANAGER', 'AGENT']), validate(cancelVisitSchema), visitController.cancelVisit);
router.patch('/:id/no-show', authorize(['ADMIN', 'MANAGER', 'AGENT']), visitController.markNoShow);
router.patch('/:id/reschedule', authorize(['ADMIN', 'MANAGER', 'AGENT']), validate(rescheduleVisitSchema), visitController.rescheduleVisit);

// Recordatorios
router.post('/:id/reminder', authorize(['ADMIN', 'MANAGER', 'AGENT']), visitController.sendReminder);

export default router;
