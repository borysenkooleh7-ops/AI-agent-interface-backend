import { Request, Response } from 'express';
import * as notificationService from '../services/notification.service';
import logger from '../utils/logger';

/**
 * Get all notifications for the authenticated user
 */
export async function getUserNotifications(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;
    const { read, type, limit, offset } = req.query;

    const filters: any = {
      userId,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0
    };

    if (read !== undefined) {
      filters.read = read === 'true';
    }

    if (type) {
      filters.type = type as string;
    }

    const result = await notificationService.getUserNotifications(filters, userRole);

    res.json({
      success: true,
      data: result.notifications,
      pagination: {
        total: result.total,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: result.hasMore
      }
    });
  } catch (error: any) {
    logger.error('Error in getUserNotifications controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve notifications'
    });
  }
}

/**
 * Get notification by ID
 */
export async function getNotificationById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;

    const notification = await notificationService.getNotificationById(id, userRole);

    // Verify the notification belongs to the user
    if (notification.userId !== userId) {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    res.json({
      success: true,
      data: notification
    });
  } catch (error: any) {
    logger.error('Error in getNotificationById controller:', error);
    if (error.message === 'Notification not found') {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve notification'
      });
    }
  }
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.userId;

    const count = await notificationService.getUnreadCount(userId);

    res.json({
      success: true,
      data: { count }
    });
  } catch (error: any) {
    logger.error('Error in getUnreadCount controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count'
    });
  }
}

/**
 * Mark notification as read
 */
export async function markAsRead(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;

    const notification = await notificationService.markNotificationAsRead(id, userId, userRole);

    res.json({
      success: true,
      data: notification,
      message: 'Notification marked as read'
    });
  } catch (error: any) {
    logger.error('Error in markAsRead controller:', error);
    if (error.message === 'Notification not found or access denied') {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read'
      });
    }
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.userId;

    const count = await notificationService.markAllNotificationsAsRead(userId);

    res.json({
      success: true,
      data: { count },
      message: `${count} notifications marked as read`
    });
  } catch (error: any) {
    logger.error('Error in markAllAsRead controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read'
    });
  }
}

/**
 * Delete notification
 */
export async function deleteNotification(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    await notificationService.deleteNotification(id, userId);

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error: any) {
    logger.error('Error in deleteNotification controller:', error);
    if (error.message === 'Notification not found or access denied') {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to delete notification'
      });
    }
  }
}

/**
 * Delete all read notifications
 */
export async function deleteReadNotifications(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.userId;

    const count = await notificationService.deleteReadNotifications(userId);

    res.json({
      success: true,
      data: { count },
      message: `${count} read notifications deleted`
    });
  } catch (error: any) {
    logger.error('Error in deleteReadNotifications controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete read notifications'
    });
  }
}

/**
 * Create notification (Admin only)
 */
export async function createNotification(req: Request, res: Response): Promise<void> {
  try {
    const { userId, type, title, message, data } = req.body;

    if (!userId || !type || !title || !message) {
      res.status(400).json({
        success: false,
        message: 'userId, type, title, and message are required'
      });
      return;
    }

    const notification = await notificationService.createNotification({
      userId,
      type,
      title,
      message,
      data
    });

    // Emit Socket.IO event (will be handled by socket setup)
    const io = (req.app as any).get('io');
    if (io) {
      io.to(`user:${userId}`).emit('notification', notification);
    }

    res.status(201).json({
      success: true,
      data: notification,
      message: 'Notification created successfully'
    });
  } catch (error: any) {
    logger.error('Error in createNotification controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create notification'
    });
  }
}

