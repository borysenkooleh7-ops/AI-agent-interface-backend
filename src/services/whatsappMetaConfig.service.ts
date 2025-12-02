import prisma from '../config/database';
import logger from '../utils/logger';

export interface WhatsAppMetaConfigData {
  metaBusinessManagerId?: string;
  metaAppId?: string;
  metaAppSecret?: string;
  webhookVerifyToken?: string;
  webhookUrl?: string;
}

/**
 * Get WhatsApp Meta configuration (singleton)
 */
export async function getWhatsAppMetaConfig() {
  // Get or create the single Meta config record
  let metaConfig = await prisma.whatsAppMetaConfig.findFirst();
  
  if (!metaConfig) {
    // Create default empty config
    metaConfig = await prisma.whatsAppMetaConfig.create({
      data: {}
    });
  }

  return metaConfig;
}

/**
 * Update WhatsApp Meta configuration
 */
export async function updateWhatsAppMetaConfig(
  data: WhatsAppMetaConfigData,
  updatedBy?: string
) {
  // Get existing config or create new one
  let metaConfig = await prisma.whatsAppMetaConfig.findFirst();
  
  if (metaConfig) {
    // Update existing
    metaConfig = await prisma.whatsAppMetaConfig.update({
      where: { id: metaConfig.id },
      data: {
        metaBusinessManagerId: data.metaBusinessManagerId ?? metaConfig.metaBusinessManagerId,
        metaAppId: data.metaAppId ?? metaConfig.metaAppId,
        metaAppSecret: data.metaAppSecret ?? metaConfig.metaAppSecret,
        webhookVerifyToken: data.webhookVerifyToken ?? metaConfig.webhookVerifyToken,
        webhookUrl: data.webhookUrl ?? metaConfig.webhookUrl,
        updatedAt: new Date()
      }
    });
  } else {
    // Create new
    metaConfig = await prisma.whatsAppMetaConfig.create({
      data: {
        metaBusinessManagerId: data.metaBusinessManagerId,
        metaAppId: data.metaAppId,
        metaAppSecret: data.metaAppSecret,
        webhookVerifyToken: data.webhookVerifyToken,
        webhookUrl: data.webhookUrl
      }
    });
  }

  logger.info(`WhatsApp Meta configuration updated by ${updatedBy || 'system'}`);
  return metaConfig;
}

/**
 * Get webhook verify token (used for webhook verification)
 */
export async function getWebhookVerifyToken(): Promise<string | null> {
  const metaConfig = await getWhatsAppMetaConfig();
  return metaConfig.webhookVerifyToken || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || null;
}

