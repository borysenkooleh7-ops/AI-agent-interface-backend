import { Request, Response } from 'express';
import axios, { AxiosError } from 'axios';
import prisma from '../config/database';
import logger from '../utils/logger';

/**
 * GET /api/whatsapp/config/:gymId - Get WhatsApp configuration for a gym
 */
export async function getWhatsAppConfig(req: Request, res: Response): Promise<void> {
  try {
    const { gymId } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Global admins have access to all gyms
    if (userRole === 'ADMIN') {
      // Verify gym exists
      const gym = await prisma.gym.findFirst({
        where: { id: gymId, isDeleted: false }
      });
      
      if (!gym) {
        res.status(404).json({ success: false, message: 'Gym not found' });
        return;
      }
    } else {
      // For non-admin users, verify they have access to this gym
      const userGym = await prisma.gymUser.findFirst({
        where: { userId, gymId }
      });

      if (!userGym) {
        res.status(403).json({ success: false, message: 'Access denied to this gym' });
        return;
      }
    }

    const whatsappConfig = await prisma.whatsAppAccount.findFirst({
      where: { gymId },
      select: {
        id: true,
        phoneNumber: true,
        phoneNumberId: true,
        accessToken: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    res.status(200).json({
      success: true,
      data: whatsappConfig
    });
  } catch (error: any) {
    logger.error('Error getting WhatsApp config:', error);
    res.status(500).json({ success: false, message: 'Failed to get WhatsApp configuration' });
  }
}

/**
 * POST /api/whatsapp/config - Create or update WhatsApp configuration
 */
export async function createOrUpdateWhatsAppConfig(req: Request, res: Response): Promise<void> {
  try {
    const { gymId, phoneNumber, phoneNumberId, accessToken } = req.body;
    const userId = req.user?.userId;

    if (!gymId || !phoneNumber || !phoneNumberId || !accessToken) {
      res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: gymId, phoneNumber, phoneNumberId, accessToken' 
      });
      return;
    }

    // Check user role from JWT token
    const userRole = req.user?.role;
    
    // Global admins have access to all gyms
    if (userRole === 'ADMIN') {
      // Verify gym exists
      const gym = await prisma.gym.findFirst({
        where: { id: gymId, isDeleted: false }
      });
      
      if (!gym) {
        res.status(404).json({ success: false, message: 'Gym not found' });
        return;
      }
    } else {
      // For non-admin users, check if they have admin role for this specific gym
      const userGym = await prisma.gymUser.findFirst({
        where: { userId, gymId, role: 'ADMIN' }
      });

      if (!userGym) {
        res.status(403).json({ success: false, message: 'Admin access required for this gym' });
        return;
      }
    }

    // Check if WhatsApp account already exists for this gym
    const existingConfig = await prisma.whatsAppAccount.findFirst({
      where: { gymId }
    });

    let whatsappConfig;
    if (existingConfig) {
      // Update existing configuration
      whatsappConfig = await prisma.whatsAppAccount.update({
        where: { id: existingConfig.id },
        data: {
          phoneNumber,
          phoneNumberId,
          accessToken,
          status: 'PENDING', // Reset to pending for verification
          updatedAt: new Date()
        },
      });
    } else {
      // Create new configuration
      whatsappConfig = await prisma.whatsAppAccount.create({
        data: {
          gymId,
          phoneNumber,
          phoneNumberId,
          accessToken,
          status: 'PENDING'
        },
        select: {
          id: true,
          phoneNumber: true,
          phoneNumberId: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'WhatsApp configuration saved successfully',
      data: whatsappConfig
    });
  } catch (error: any) {
    logger.error('Error creating/updating WhatsApp config:', error);
    res.status(500).json({ success: false, message: 'Failed to save WhatsApp configuration' });
  }
}

/**
 * POST /api/whatsapp/config/:gymId/test - Test WhatsApp connection
 */
export async function testWhatsAppConnection(req: Request, res: Response): Promise<void> {
  try {
    const { gymId } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Global admins have access to all gyms
    if (userRole === 'ADMIN') {
      // Verify gym exists
      const gym = await prisma.gym.findFirst({
        where: { id: gymId, isDeleted: false }
      });
      
      if (!gym) {
        res.status(404).json({ success: false, message: 'Gym not found' });
        return;
      }
    } else {
      // For non-admin users, verify they have access to this gym
      const userGym = await prisma.gymUser.findFirst({
        where: { userId, gymId }
      });

      if (!userGym) {
        res.status(403).json({ success: false, message: 'Access denied to this gym' });
        return;
      }
    }
    

    // Allow testing for both PENDING and ACTIVE configurations
    const whatsappConfig = await prisma.whatsAppAccount.findFirst({
      where: { 
        gymId, 
        status: { in: ['ACTIVE', 'PENDING'] }
      }
    });

    if (!whatsappConfig) {
      res.status(404).json({ 
        success: false, 
        message: 'No WhatsApp configuration found for this gym' 
      });
      return;
    }

    // Test the connection by trying to get business profile
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v18.0/${whatsappConfig.phoneNumberId}/whatsapp_business_profile`,
        {
          headers: {
            'Authorization': `Bearer ${whatsappConfig.accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: parseInt(process.env.WHATSAPP_API_TIMEOUT_MS || '15000', 10)
        }
      );

      res.status(200).json({
        success: true,
        message: 'WhatsApp connection test successful',
        data: {
          configured: true,
          businessProfile: response.data.data?.[0] || null
        }
      });
    } catch (apiError: any) {
      const isTimeout =
        (apiError as AxiosError).code === 'ECONNABORTED' ||
        apiError.message?.toLowerCase().includes('timeout');

      logger.error('WhatsApp API test failed:', apiError.response?.data || apiError.message);
      res.status(isTimeout ? 504 : 500).json({
        success: false,
        message: isTimeout
          ? 'WhatsApp connection test timed out. Please verify network connectivity or try again.'
          : 'WhatsApp connection test failed',
        data: {
          configured: false,
          error: apiError.response?.data?.error?.message || apiError.message
        }
      });
    }
  } catch (error: any) {
    logger.error('Error testing WhatsApp connection:', error);
    res.status(500).json({ success: false, message: 'Failed to test WhatsApp connection' });
  }
}

/**
 * POST /api/whatsapp/config/:gymId/activate - Activate WhatsApp configuration
 */
export async function activateWhatsAppConfig(req: Request, res: Response): Promise<void> {
  try {
    const { gymId } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Verify access
    if (userRole === 'ADMIN') {
      const gym = await prisma.gym.findFirst({
        where: { id: gymId, isDeleted: false }
      });
      
      if (!gym) {
        res.status(404).json({ success: false, message: 'Gym not found' });
        return;
      }
    } else {
      const userGym = await prisma.gymUser.findFirst({
        where: { userId, gymId, role: 'ADMIN' }
      });

      if (!userGym) {
        res.status(403).json({ success: false, message: 'Admin access required for this gym' });
        return;
      }
    }

    // Find the WhatsApp configuration
    const whatsappConfig = await prisma.whatsAppAccount.findFirst({
      where: { gymId }
    });

    if (!whatsappConfig) {
      res.status(404).json({ 
        success: false, 
        message: 'No WhatsApp configuration found for this gym' 
      });
      return;
    }

    // Test the connection first before activating
    try {
      await axios.get(
        `https://graph.facebook.com/v18.0/${whatsappConfig.phoneNumberId}/whatsapp_business_profile`,
        {
          headers: {
            'Authorization': `Bearer ${whatsappConfig.accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: parseInt(process.env.WHATSAPP_API_TIMEOUT_MS || '15000', 10)
        }
      );

      // If test succeeds, activate the configuration
      const updated = await prisma.whatsAppAccount.update({
        where: { id: whatsappConfig.id },
        data: { status: 'ACTIVE' },
        select: {
          id: true,
          phoneNumber: true,
          phoneNumberId: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      res.status(200).json({
        success: true,
        message: 'WhatsApp configuration activated successfully',
        data: updated
      });
    } catch (apiError: any) {
      const isTimeout =
        (apiError as AxiosError).code === 'ECONNABORTED' ||
        apiError.message?.toLowerCase().includes('timeout');

      logger.error('WhatsApp API test failed during activation:', apiError.response?.data || apiError.message);
      res.status(isTimeout ? 504 : 400).json({
        success: false,
        message: isTimeout
          ? 'Cannot activate: WhatsApp API request timed out'
          : 'Cannot activate: WhatsApp connection test failed',
        error: apiError.response?.data?.error?.message || apiError.message
      });
    }
  } catch (error: any) {
    logger.error('Error activating WhatsApp config:', error);
    res.status(500).json({ success: false, message: 'Failed to activate WhatsApp configuration' });
  }
}

/**
 * DELETE /api/whatsapp/config/:gymId - Delete WhatsApp configuration
 */
export async function deleteWhatsAppConfig(req: Request, res: Response): Promise<void> {
  try {
    const { gymId } = req.params;
    const userId = req.user?.userId;

    // Verify user has admin access to this gym
    const userGym = await prisma.gymUser.findFirst({
      where: { userId, gymId, role: 'ADMIN' }
    });

    if (!userGym) {
      res.status(403).json({ success: false, message: 'Admin access required for this gym' });
      return;
    }

    const deletedConfig = await prisma.whatsAppAccount.deleteMany({
      where: { gymId }
    });

    res.status(200).json({
      success: true,
      message: 'WhatsApp configuration deleted successfully',
      data: { deletedCount: deletedConfig.count }
    });
  } catch (error: any) {
    logger.error('Error deleting WhatsApp config:', error);
    res.status(500).json({ success: false, message: 'Failed to delete WhatsApp configuration' });
  }
}
