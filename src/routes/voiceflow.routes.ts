import { Router } from 'express';
import * as voiceflowController from '../controllers/voiceflow.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { z } from 'zod';

const router = Router();

// Esquemas de validación
const webhookSchema = z.object({
  sessionId: z.string().min(1, 'Se requiere sessionId'),
  agencyId: z.string().min(1, 'Se requiere agencyId'),
  phone: z.string().optional(),
  request: z.object({
    type: z.string(),
    payload: z.any().optional()
  }).optional()
});

const startSessionSchema = z.object({
  agencyId: z.string().min(1, 'Se requiere agencyId'),
  phone: z.string().optional()
});

const sendMessageSchema = z.object({
  text: z.string().min(1, 'Se requiere text'),
  agencyId: z.string().min(1, 'Se requiere agencyId')
});

const sendIntentSchema = z.object({
  intent: z.string().min(1, 'Se requiere intent'),
  entities: z.record(z.any()).optional(),
  agencyId: z.string().min(1, 'Se requiere agencyId')
});

// ==========================================
// RUTAS PÚBLICAS (Webhooks de Voiceflow)
// ==========================================

// Verificación del webhook (GET)
router.get('/webhook', voiceflowController.verifyWebhook);

// Webhook principal (POST) - No requiere autenticación
router.post('/webhook', validate(webhookSchema), voiceflowController.handleWebhook);

// Iniciar nueva sesión
router.post('/session/start', validate(startSessionSchema), voiceflowController.startSession);

// Enviar mensaje a sesión
router.post('/session/:sessionId/message', validate(sendMessageSchema), voiceflowController.sendMessage);

// Enviar intent a sesión
router.post('/session/:sessionId/intent', validate(sendIntentSchema), voiceflowController.sendIntent);

// Finalizar sesión
router.post('/session/:sessionId/end', voiceflowController.endSession);

// Obtener sesión (público para que Voiceflow pueda consultarla)
router.get('/session/:sessionId', voiceflowController.getSession);

// ==========================================
// RUTAS PROTEGIDAS (Admin/Dashboard)
// ==========================================

router.use(authenticate);

// Obtener sesiones de una agencia
router.get(
  '/agency/:agencyId/sessions',
  authorize(['ADMIN', 'MANAGER']),
  voiceflowController.getAgencySessions
);

// Obtener estadísticas de sesiones de voz
router.get(
  '/agency/:agencyId/statistics',
  authorize(['ADMIN', 'MANAGER']),
  voiceflowController.getVoiceStatistics
);

export default router;
