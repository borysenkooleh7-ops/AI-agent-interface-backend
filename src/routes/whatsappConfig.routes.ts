import express from 'express';
import * as whatsappConfigController from '../controllers/whatsappConfig.controller';
import * as whatsappMetaConfigController from '../controllers/whatsappMetaConfig.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Meta Configuration Routes (Shared settings, Admin only)
router.get('/meta-config', authorize(['ADMIN']), whatsappMetaConfigController.getWhatsAppMetaConfig);
router.put('/meta-config', authorize(['ADMIN']), whatsappMetaConfigController.updateWhatsAppMetaConfig);

// Get WhatsApp configuration for a specific gym
router.get('/config/:gymId', authorize(['ADMIN', 'MANAGER', 'TRAINER']), whatsappConfigController.getWhatsAppConfig);

// Create or update WhatsApp configuration for a gym (Admin only)
router.post('/config', authorize(['ADMIN']), whatsappConfigController.createOrUpdateWhatsAppConfig);

// Test WhatsApp connection for a specific gym
router.post('/config/:gymId/test', authorize(['ADMIN', 'MANAGER']), whatsappConfigController.testWhatsAppConnection);

// Activate WhatsApp configuration for a gym (Admin only)
router.post('/config/:gymId/activate', authorize(['ADMIN']), whatsappConfigController.activateWhatsAppConfig);

// Delete WhatsApp configuration for a specific gym (Admin only)
router.delete('/config/:gymId', authorize(['ADMIN']), whatsappConfigController.deleteWhatsAppConfig);

export default router;
