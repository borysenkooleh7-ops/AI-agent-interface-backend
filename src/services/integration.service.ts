import prisma from '../config/database';
import logger from '../utils/logger';

export interface IntegrationConfig {
  [key: string]: any;
}

export interface CreateIntegrationData {
  gymId: string;
  type: 'EVO' | 'GOOGLE_ANALYTICS' | 'FACEBOOK_PIXEL' | 'ZAPIER' | 'WEBHOOK' | 'CUSTOM';
  name: string;
  config: IntegrationConfig;
}

export interface UpdateIntegrationData {
  name?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'PENDING';
  config?: IntegrationConfig;
}

/**
 * Get all integrations for a gym
 */
export async function getGymIntegrations(gymId: string) {
  return await prisma.integration.findMany({
    where: { gymId },
    include: {
      fieldMappings: true,
      syncHistory: {
        orderBy: { startedAt: 'desc' },
        take: 5
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Get integration by ID
 */
export async function getIntegrationById(integrationId: string) {
  return await prisma.integration.findUnique({
    where: { id: integrationId },
    include: {
      fieldMappings: true,
      syncHistory: {
        orderBy: { startedAt: 'desc' },
        take: 20
      },
      gym: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
}

/**
 * Create new integration
 */
export async function createIntegration(data: CreateIntegrationData, _createdBy: string) {
  const integration = await prisma.integration.create({
    data: {
      gymId: data.gymId,
      type: data.type,
      name: data.name,
      config: data.config,
      status: 'PENDING'
    }
  });

  logger.info(`Integration created: ${integration.id} for gym ${data.gymId}`);
  return integration;
}

/**
 * Update integration
 */
export async function updateIntegration(
  integrationId: string,
  data: UpdateIntegrationData,
  _updatedBy: string
) {
  const integration = await prisma.integration.update({
    where: { id: integrationId },
    data: {
      ...data,
      updatedAt: new Date()
    }
  });

  logger.info(`Integration updated: ${integrationId}`);
  return integration;
}

/**
 * Delete integration
 */
export async function deleteIntegration(integrationId: string, _deletedBy: string) {
  // Delete related records first
  await prisma.fieldMapping.deleteMany({
    where: { integrationId }
  });

  await prisma.syncHistory.deleteMany({
    where: { integrationId }
  });

  const integration = await prisma.integration.delete({
    where: { id: integrationId }
  });

  logger.info(`Integration deleted: ${integrationId}`);
  return integration;
}

/**
 * Test integration connection
 */
export async function testIntegrationConnection(integrationId: string): Promise<boolean> {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId }
  });

  if (!integration) {
    throw new Error('Integration not found');
  }

  try {
    switch (integration.type) {
      case 'EVO':
        const { testEVOConnection } = await import('./evoIntegration.service');
        return await testEVOConnection(integration.config as any);
      
      case 'GOOGLE_ANALYTICS':
        return await testGoogleAnalyticsConnection(integration.config);
      
      case 'FACEBOOK_PIXEL':
        return await testFacebookPixelConnection(integration.config);
      
      case 'ZAPIER':
        return await testZapierConnection(integration.config);
      
      default:
        return true; // For webhooks and custom integrations
    }
  } catch (error) {
    logger.error(`Connection test failed for integration ${integrationId}:`, error);
    return false;
  }
}

/**
 * Test Google Analytics connection
 */
async function testGoogleAnalyticsConnection(config: any): Promise<boolean> {
  try {
    // Test Google Analytics API connection
    const response = await fetch(`https://www.googleapis.com/analytics/v3/management/accounts`, {
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    return response.ok;
  } catch (error) {
    logger.error('Google Analytics connection test failed:', error);
    return false;
  }
}

/**
 * Test Facebook Pixel connection
 */
async function testFacebookPixelConnection(config: any): Promise<boolean> {
  try {
    // Test Facebook Graph API connection
    const response = await fetch(`https://graph.facebook.com/v18.0/${config.pixelId}`, {
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    return response.ok;
  } catch (error) {
    logger.error('Facebook Pixel connection test failed:', error);
    return false;
  }
}

/**
 * Test Zapier connection
 */
async function testZapierConnection(config: any): Promise<boolean> {
  try {
    // Test Zapier webhook URL
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ test: true })
    });
    return response.ok;
  } catch (error) {
    logger.error('Zapier connection test failed:', error);
    return false;
  }
}

/**
 * Get integration statistics
 */
export async function getIntegrationStatistics(gymId: string) {
  const [totalIntegrations, activeIntegrations, lastSyncs] = await Promise.all([
    prisma.integration.count({
      where: { gymId }
    }),
    prisma.integration.count({
      where: { gymId, status: 'ACTIVE' }
    }),
    prisma.integration.findMany({
      where: { gymId, lastSyncAt: { not: null } },
      select: { lastSyncAt: true, type: true },
      orderBy: { lastSyncAt: 'desc' },
      take: 5
    })
  ]);

  return {
    totalIntegrations,
    activeIntegrations,
    inactiveIntegrations: totalIntegrations - activeIntegrations,
    lastSyncs
  };
}

/**
 * Update integration status
 */
export async function updateIntegrationStatus(
  integrationId: string,
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'PENDING'
) {
  const integration = await prisma.integration.update({
    where: { id: integrationId },
    data: { status }
  });

  logger.info(`Integration ${integrationId} status updated to ${status}`);
  return integration;
}

/**
 * Get field mappings for integration
 */
export async function getFieldMappings(integrationId: string) {
  return await prisma.fieldMapping.findMany({
    where: { integrationId },
    orderBy: { duxfitField: 'asc' }
  });
}

/**
 * Update field mappings
 */
export async function updateFieldMappings(
  integrationId: string,
  mappings: Array<{
    duxfitField: string;
    externalField: string;
    isActive: boolean;
  }>
) {
  // Delete existing mappings
  await prisma.fieldMapping.deleteMany({
    where: { integrationId }
  });

  // Create new mappings
  if (mappings.length > 0) {
    await prisma.fieldMapping.createMany({
      data: mappings.map(mapping => ({
        integrationId,
        ...mapping
      }))
    });
  }

  logger.info(`Field mappings updated for integration ${integrationId}`);
}
