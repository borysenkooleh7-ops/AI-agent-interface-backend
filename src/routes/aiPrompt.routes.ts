import { Router } from 'express';
import * as aiPromptController from '../controllers/aiPrompt.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createAIPromptSchema = z.object({
  gymId: z.string(),
  systemPrompt: z.string().min(10),
  greetingMessage: z.string().optional(),
  qualificationFlow: z.any().optional(),
  objectionHandling: z.any().optional(),
  faqs: z.any().optional(),
  escalationRules: z.any().optional()
});

const updateAIPromptSchema = z.object({
  systemPrompt: z.string().min(10).optional(),
  greetingMessage: z.string().optional(),
  qualificationFlow: z.any().optional(),
  objectionHandling: z.any().optional(),
  faqs: z.any().optional(),
  escalationRules: z.any().optional()
});

// Apply authentication to all routes
router.use(authenticate);

// Routes
router.get('/template', aiPromptController.getDefaultTemplate);
router.get('/:gymId', authorize(['ADMIN', 'MANAGER']), aiPromptController.getAIPrompt);
router.post('/', authorize(['ADMIN']), validate(createAIPromptSchema), aiPromptController.createAIPrompt);
router.put('/:gymId', authorize(['ADMIN', 'MANAGER']), validate(updateAIPromptSchema), aiPromptController.updateAIPrompt);
router.delete('/:gymId', authorize(['ADMIN']), aiPromptController.deleteAIPrompt);

export default router;
