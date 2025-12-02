import { Request, Response } from 'express';
import * as integrationService from '../services/integration.service';
import * as evoIntegrationService from '../services/evoIntegration.service';
import * as webhookService from '../services/webhook.service';
import logger from '../utils/logger';

/**
 * Get all integrations for a gym
 */
export async function getGymIntegrations(req: Request, res: Response): Promise<void> {
  try {
    const { gymId } = req.params;
    const integrations = await integrationService.getGymIntegrations(gymId);

    res.json({
      success: true,
      data: integrations
    });
  } catch (error: any) {
    logger.error('Error in getGymIntegrations controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve integrations'
    });
  }
}

/**
 * Get integration by ID
 */
export async function getIntegrationById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const integration = await integrationService.getIntegrationById(id);

    if (!integration) {
      res.status(404).json({
        success: false,
        message: 'Integration not found'
      });
      return;
    }

    res.json({
      success: true,
      data: integration
    });
  } catch (error: any) {
    logger.error('Error in getIntegrationById controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve integration'
    });
  }
}

/**
 * Create new integration
 */
export async function createIntegration(req: Request, res: Response): Promise<void> {
  try {
    const { gymId, type, name, config } = req.body;
    const createdBy = (req as any).user.userId;

    if (!gymId || !type || !name) {
      res.status(400).json({
        success: false,
        message: 'gymId, type, and name are required'
      });
      return;
    }

    const integration = await integrationService.createIntegration(
      { gymId, type, name, config },
      createdBy
    );

    res.status(201).json({
      success: true,
      data: integration,
      message: 'Integration created successfully'
    });
  } catch (error: any) {
    logger.error('Error in createIntegration controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create integration'
    });
  }
}

/**
 * Update integration
 */
export async function updateIntegration(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, status, config } = req.body;
    const updatedBy = (req as any).user.userId;

    const integration = await integrationService.updateIntegration(
      id,
      { name, status, config },
      updatedBy
    );

    res.json({
      success: true,
      data: integration,
      message: 'Integration updated successfully'
    });
  } catch (error: any) {
    logger.error('Error in updateIntegration controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update integration'
    });
  }
}

/**
 * Delete integration
 */
export async function deleteIntegration(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const deletedBy = (req as any).user.userId;

    await integrationService.deleteIntegration(id, deletedBy);

    res.json({
      success: true,
      message: 'Integration deleted successfully'
    });
  } catch (error: any) {
    logger.error('Error in deleteIntegration controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete integration'
    });
  }
}

/**
 * Test integration connection
 */
export async function testConnection(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const isConnected = await integrationService.testIntegrationConnection(id);

    res.json({
      success: true,
      data: { connected: isConnected },
      message: isConnected ? 'Connection successful' : 'Connection failed'
    });
  } catch (error: any) {
    logger.error('Error in testConnection controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test connection'
    });
  }
}

/**
 * Get integration statistics
 */
export async function getIntegrationStatistics(req: Request, res: Response): Promise<void> {
  try {
    const { gymId } = req.params;
    const statistics = await integrationService.getIntegrationStatistics(gymId);

    res.json({
      success: true,
      data: statistics
    });
  } catch (error: any) {
    logger.error('Error in getIntegrationStatistics controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve integration statistics'
    });
  }
}

/**
 * Update field mappings
 */
export async function updateFieldMappings(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { mappings } = req.body;

    if (!Array.isArray(mappings)) {
      res.status(400).json({
        success: false,
        message: 'mappings must be an array'
      });
      return;
    }

    await integrationService.updateFieldMappings(id, mappings);

    res.json({
      success: true,
      message: 'Field mappings updated successfully'
    });
  } catch (error: any) {
    logger.error('Error in updateFieldMappings controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update field mappings'
    });
  }
}

// EVO Integration specific endpoints

/**
 * Create or update EVO integration
 */
export async function createOrUpdateEVOIntegration(req: Request, res: Response): Promise<void> {
  try {
    const { gymId } = req.params;
    const { apiUrl, apiKey, branchId, autoSync, bidirectional, syncNotifications, syncInterval } = req.body;
    const createdBy = (req as any).user.userId;

    if (!apiUrl || !apiKey || !branchId) {
      res.status(400).json({
        success: false,
        message: 'apiUrl, apiKey, and branchId are required'
      });
      return;
    }

    const config = {
      apiUrl,
      apiKey,
      branchId,
      autoSync: autoSync || false,
      bidirectional: bidirectional || false,
      syncNotifications: syncNotifications || false,
      syncInterval: syncInterval || 15
    };

    const integration = await evoIntegrationService.createOrUpdateEVOIntegration(
      gymId,
      config,
      createdBy
    );

    res.json({
      success: true,
      data: integration,
      message: 'EVO integration configured successfully'
    });
  } catch (error: any) {
    logger.error('Error in createOrUpdateEVOIntegration controller:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to configure EVO integration'
    });
  }
}

/**
 * Sync leads from EVO
 */
export async function syncFromEVO(req: Request, res: Response): Promise<void> {
  try {
    const { gymId, integrationId } = req.params;
    const result = await evoIntegrationService.syncLeadsFromEVO(gymId, integrationId);

    res.json({
      success: result.success,
      data: result,
      message: result.success 
        ? `Sync completed: ${result.recordsSynced} records synced`
        : 'Sync failed'
    });
  } catch (error: any) {
    logger.error('Error in syncFromEVO controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync from EVO'
    });
  }
}

/**
 * Sync leads to EVO
 */
export async function syncToEVO(req: Request, res: Response): Promise<void> {
  try {
    const { gymId, integrationId } = req.params;
    const result = await evoIntegrationService.syncLeadsToEVO(gymId, integrationId);

    res.json({
      success: result.success,
      data: result,
      message: result.success 
        ? `Sync completed: ${result.recordsSynced} records synced`
        : 'Sync failed'
    });
  } catch (error: any) {
    logger.error('Error in syncToEVO controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync to EVO'
    });
  }
}

/**
 * Get EVO sync history
 */
export async function getEVOSyncHistory(req: Request, res: Response): Promise<void> {
  try {
    const { integrationId } = req.params;
    const { limit = 50 } = req.query;
    const history = await evoIntegrationService.getSyncHistory(integrationId, Number(limit));

    res.json({
      success: true,
      data: history
    });
  } catch (error: any) {
    logger.error('Error in getEVOSyncHistory controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve sync history'
    });
  }
}

// Webhook endpoints

/**
 * Get all webhooks for a gym
 */
export async function getGymWebhooks(req: Request, res: Response): Promise<void> {
  try {
    const { gymId } = req.params;
    const webhooks = await webhookService.getGymWebhooks(gymId);

    res.json({
      success: true,
      data: webhooks
    });
  } catch (error: any) {
    logger.error('Error in getGymWebhooks controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve webhooks'
    });
  }
}

/**
 * Create webhook
 */
export async function createWebhook(req: Request, res: Response): Promise<void> {
  try {
    const { gymId, name, url, events, secret } = req.body;
    const createdBy = (req as any).user.userId;

    if (!gymId || !name || !url || !events || !Array.isArray(events)) {
      res.status(400).json({
        success: false,
        message: 'gymId, name, url, and events are required'
      });
      return;
    }

    const webhook = await webhookService.createWebhook(
      { gymId, name, url, events, secret },
      createdBy
    );

    res.status(201).json({
      success: true,
      data: webhook,
      message: 'Webhook created successfully'
    });
  } catch (error: any) {
    logger.error('Error in createWebhook controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create webhook'
    });
  }
}

/**
 * Test webhook URL
 */
export async function testWebhookUrl(req: Request, res: Response): Promise<void> {
  try {
    const { url, secret } = req.body;

    if (!url) {
      res.status(400).json({
        success: false,
        message: 'url is required'
      });
      return;
    }

    const isValid = await webhookService.testWebhookUrl(url, secret);

    res.json({
      success: true,
      data: { valid: isValid },
      message: isValid ? 'Webhook URL is valid' : 'Webhook URL is invalid'
    });
  } catch (error: any) {
    logger.error('Error in testWebhookUrl controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test webhook URL'
    });
  }
}

/**
 * Get webhook statistics
 */
export async function getWebhookStatistics(req: Request, res: Response): Promise<void> {
  try {
    const { gymId } = req.params;
    const statistics = await webhookService.getWebhookStatistics(gymId);

    res.json({
      success: true,
      data: statistics
    });
  } catch (error: any) {
    logger.error('Error in getWebhookStatistics controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve webhook statistics'
    });
  }
}
