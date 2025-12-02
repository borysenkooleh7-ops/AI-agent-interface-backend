import prisma from '../config/database';
import logger from '../utils/logger';
import crypto from 'crypto';

export interface CreateWebhookData {
  gymId: string;
  name: string;
  url: string;
  events: string[];
  secret?: string;
}

export interface UpdateWebhookData {
  name?: string;
  url?: string;
  events?: string[];
  secret?: string;
  isActive?: boolean;
}

/**
 * Get all webhooks for a gym
 */
export async function getGymWebhooks(gymId: string) {
  return await prisma.webhook.findMany({
    where: { gymId },
    include: {
      webhookLogs: {
        orderBy: { triggeredAt: 'desc' },
        take: 5
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Get webhook by ID
 */
export async function getWebhookById(webhookId: string) {
  return await prisma.webhook.findUnique({
    where: { id: webhookId },
    include: {
      webhookLogs: {
        orderBy: { triggeredAt: 'desc' },
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
 * Create new webhook
 */
export async function createWebhook(data: CreateWebhookData, _createdBy: string) {
  const webhook = await prisma.webhook.create({
    data: {
      gymId: data.gymId,
      name: data.name,
      url: data.url,
      events: data.events,
      secret: data.secret || generateWebhookSecret()
    }
  });

  logger.info(`Webhook created: ${webhook.id} for gym ${data.gymId}`);
  return webhook;
}

/**
 * Update webhook
 */
export async function updateWebhook(
  webhookId: string,
  data: UpdateWebhookData,
  _updatedBy: string
) {
  const webhook = await prisma.webhook.update({
    where: { id: webhookId },
    data: {
      ...data,
      updatedAt: new Date()
    }
  });

  logger.info(`Webhook updated: ${webhookId}`);
  return webhook;
}

/**
 * Delete webhook
 */
export async function deleteWebhook(webhookId: string, _deletedBy: string) {
  // Delete webhook logs first
  await prisma.webhookLog.deleteMany({
    where: { webhookId }
  });

  const webhook = await prisma.webhook.delete({
    where: { id: webhookId }
  });

  logger.info(`Webhook deleted: ${webhookId}`);
  return webhook;
}

/**
 * Trigger webhook
 */
export async function triggerWebhook(
  webhookId: string,
  eventType: string,
  payload: any
): Promise<boolean> {
  const webhook = await prisma.webhook.findUnique({
    where: { id: webhookId }
  });

  if (!webhook || !webhook.isActive) {
    return false;
  }

  if (!webhook.events.includes(eventType)) {
    logger.warn(`Webhook ${webhookId} does not listen for event ${eventType}`);
    return false;
  }

  const startTime = Date.now();
  let success = false;
  let error: string | null = null;
  let statusCode: number | null = null;
  let response: any = null;

  try {
    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json',
      'User-Agent': 'DuxFit-Webhook/1.0'
    };

    // Add signature if secret is configured
    if (webhook.secret) {
      const signature = generateWebhookSignature(JSON.stringify(payload), webhook.secret);
      headers['X-Webhook-Signature'] = signature;
    }

    const fetchResponse = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event: eventType,
        timestamp: new Date().toISOString(),
        data: payload
      }),
      // timeout: 10000 // Not supported in standard fetch
    });

    statusCode = fetchResponse.status;
    success = fetchResponse.ok;

    if (fetchResponse.ok) {
      response = await fetchResponse.json().catch(() => null);
    } else {
      error = `HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`;
    }

  } catch (err: any) {
    error = err.message;
    success = false;
  }

  // Log webhook execution
  await prisma.webhookLog.create({
    data: {
      webhookId,
      eventType,
      payload,
      response,
      statusCode,
      duration: Date.now() - startTime,
      error,
      triggeredAt: new Date()
    }
  });

  // Update webhook last triggered time
  if (success) {
    await prisma.webhook.update({
      where: { id: webhookId },
      data: { lastTriggered: new Date() }
    });
  }

  logger.info(`Webhook ${webhookId} triggered: ${success ? 'success' : 'failed'}`);
  return success;
}

/**
 * Trigger webhooks for event
 */
export async function triggerWebhooksForEvent(
  gymId: string,
  eventType: string,
  payload: any
): Promise<{ triggered: number; failed: number }> {
  const webhooks = await prisma.webhook.findMany({
    where: {
      gymId,
      isActive: true,
      events: {
        has: eventType
      }
    }
  });

  let triggered = 0;
  let failed = 0;

  for (const webhook of webhooks) {
    const success = await triggerWebhook(webhook.id, eventType, payload);
    if (success) {
      triggered++;
    } else {
      failed++;
    }
  }

  logger.info(`Event ${eventType} triggered ${triggered} webhooks, ${failed} failed`);
  return { triggered, failed };
}

/**
 * Test webhook URL
 */
export async function testWebhookUrl(url: string, secret?: string): Promise<boolean> {
  try {
    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json',
      'User-Agent': 'DuxFit-Webhook/1.0'
    };

    if (secret) {
      const testPayload = { test: true, timestamp: new Date().toISOString() };
      const signature = generateWebhookSignature(JSON.stringify(testPayload), secret);
      headers['X-Webhook-Signature'] = signature;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event: 'test',
        timestamp: new Date().toISOString(),
        data: { test: true }
      }),
      // timeout: 5000 // Not supported in standard fetch
    });

    return response.ok;
  } catch (error) {
    logger.error('Webhook URL test failed:', error);
    return false;
  }
}

/**
 * Generate webhook secret
 */
function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate webhook signature
 */
function generateWebhookSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = generateWebhookSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Get webhook logs
 */
export async function getWebhookLogs(
  webhookId: string,
  limit: number = 50,
  offset: number = 0
) {
  return await prisma.webhookLog.findMany({
    where: { webhookId },
    orderBy: { triggeredAt: 'desc' },
    take: limit,
    skip: offset
  });
}

/**
 * Get webhook statistics
 */
export async function getWebhookStatistics(gymId: string) {
  const [totalWebhooks, activeWebhooks, totalLogs, recentLogs] = await Promise.all([
    prisma.webhook.count({
      where: { gymId }
    }),
    prisma.webhook.count({
      where: { gymId, isActive: true }
    }),
    prisma.webhookLog.count({
      where: {
        webhook: { gymId }
      }
    }),
    prisma.webhookLog.findMany({
      where: {
        webhook: { gymId },
        triggeredAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      select: {
        error: true,
        triggeredAt: true
      }
    })
  ]);

  const successCount = recentLogs.filter(log => !log.error).length;
  const successRate = recentLogs.length > 0 ? (successCount / recentLogs.length) * 100 : 0;

  return {
    totalWebhooks,
    activeWebhooks,
    inactiveWebhooks: totalWebhooks - activeWebhooks,
    totalLogs,
    recentLogs: recentLogs.length,
    successRate: Math.round(successRate * 100) / 100
  };
}
