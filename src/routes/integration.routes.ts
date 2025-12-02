import express from 'express';
import * as integrationController from '../controllers/integration.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// General Integration Routes
/**
 * GET /api/integrations/gym/:gymId
 * Get all integrations for a gym
 */
router.get(
  '/gym/:gymId',
  integrationController.getGymIntegrations
);

/**
 * GET /api/integrations/:id
 * Get integration by ID
 */
router.get(
  '/:id',
  integrationController.getIntegrationById
);

/**
 * POST /api/integrations
 * Create new integration
 */
router.post(
  '/',
  integrationController.createIntegration
);

/**
 * PUT /api/integrations/:id
 * Update integration
 */
router.put(
  '/:id',
  integrationController.updateIntegration
);

/**
 * DELETE /api/integrations/:id
 * Delete integration
 */
router.delete(
  '/:id',
  integrationController.deleteIntegration
);

/**
 * POST /api/integrations/:id/test
 * Test integration connection
 */
router.post(
  '/:id/test',
  integrationController.testConnection
);

/**
 * GET /api/integrations/gym/:gymId/statistics
 * Get integration statistics for a gym
 */
router.get(
  '/gym/:gymId/statistics',
  integrationController.getIntegrationStatistics
);

/**
 * PUT /api/integrations/:id/field-mappings
 * Update field mappings for integration
 */
router.put(
  '/:id/field-mappings',
  integrationController.updateFieldMappings
);

// EVO Integration Routes
/**
 * POST /api/integrations/evo/gym/:gymId
 * Create or update EVO integration
 */
router.post(
  '/evo/gym/:gymId',
  integrationController.createOrUpdateEVOIntegration
);

/**
 * POST /api/integrations/evo/gym/:gymId/sync/:integrationId/from
 * Sync leads from EVO to DuxFit
 */
router.post(
  '/evo/gym/:gymId/sync/:integrationId/from',
  integrationController.syncFromEVO
);

/**
 * POST /api/integrations/evo/gym/:gymId/sync/:integrationId/to
 * Sync leads from DuxFit to EVO
 */
router.post(
  '/evo/gym/:gymId/sync/:integrationId/to',
  integrationController.syncToEVO
);

/**
 * GET /api/integrations/evo/:integrationId/sync-history
 * Get EVO sync history
 */
router.get(
  '/evo/:integrationId/sync-history',
  integrationController.getEVOSyncHistory
);

// Webhook Routes
/**
 * GET /api/integrations/webhooks/gym/:gymId
 * Get all webhooks for a gym
 */
router.get(
  '/webhooks/gym/:gymId',
  integrationController.getGymWebhooks
);

/**
 * POST /api/integrations/webhooks
 * Create new webhook
 */
router.post(
  '/webhooks',
  integrationController.createWebhook
);

/**
 * POST /api/integrations/webhooks/test-url
 * Test webhook URL
 */
router.post(
  '/webhooks/test-url',
  integrationController.testWebhookUrl
);

/**
 * GET /api/integrations/webhooks/gym/:gymId/statistics
 * Get webhook statistics for a gym
 */
router.get(
  '/webhooks/gym/:gymId/statistics',
  integrationController.getWebhookStatistics
);

export default router;
