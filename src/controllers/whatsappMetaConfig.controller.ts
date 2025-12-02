import { Request, Response } from 'express';
import * as whatsappMetaConfigService from '../services/whatsappMetaConfig.service';
import logger from '../utils/logger';

/**
 * GET /api/whatsapp/meta-config - Get WhatsApp Meta configuration
 */
export async function getWhatsAppMetaConfig(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Only admins can view Meta config
    if (userRole !== 'ADMIN') {
      res.status(403).json({ success: false, message: 'Admin access required' });
      return;
    }

    const metaConfig = await whatsappMetaConfigService.getWhatsAppMetaConfig();

    // Don't return app secret for security (only show partial)
    const response = {
      ...metaConfig,
      metaAppSecret: metaConfig.metaAppSecret 
        ? `${metaConfig.metaAppSecret.substring(0, 4)}${'*'.repeat(metaConfig.metaAppSecret.length - 4)}`
        : null
    };

    res.status(200).json({
      success: true,
      data: response
    });
  } catch (error: any) {
    logger.error('Error getting WhatsApp Meta config:', error);
    res.status(500).json({ success: false, message: 'Failed to get WhatsApp Meta configuration' });
  }
}

/**
 * PUT /api/whatsapp/meta-config - Update WhatsApp Meta configuration
 */
export async function updateWhatsAppMetaConfig(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Only admins can update Meta config
    if (userRole !== 'ADMIN') {
      res.status(403).json({ success: false, message: 'Admin access required' });
      return;
    }

    const {
      metaBusinessManagerId,
      metaAppId,
      metaAppSecret,
      webhookVerifyToken,
      webhookUrl
    } = req.body;

    // If updating app secret, we need the full value (not masked)
    const currentConfig = await whatsappMetaConfigService.getWhatsAppMetaConfig();
    const finalAppSecret = metaAppSecret && !metaAppSecret.includes('*') 
      ? metaAppSecret 
      : currentConfig.metaAppSecret;

    const metaConfig = await whatsappMetaConfigService.updateWhatsAppMetaConfig({
      metaBusinessManagerId,
      metaAppId,
      metaAppSecret: finalAppSecret,
      webhookVerifyToken,
      webhookUrl
    }, userId);

    // Return masked app secret
    const response = {
      ...metaConfig,
      metaAppSecret: metaConfig.metaAppSecret 
        ? `${metaConfig.metaAppSecret.substring(0, 4)}${'*'.repeat(metaConfig.metaAppSecret.length - 4)}`
        : null
    };

    res.status(200).json({
      success: true,
      message: 'WhatsApp Meta configuration updated successfully',
      data: response
    });
  } catch (error: any) {
    logger.error('Error updating WhatsApp Meta config:', error);
    res.status(500).json({ success: false, message: 'Failed to update WhatsApp Meta configuration' });
  }
}

