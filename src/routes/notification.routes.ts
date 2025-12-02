import express from 'express';
import * as notificationController from '../controllers/notification.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/notifications
 * Get all notifications for the authenticated user
 * Query params: read (boolean), type (string), limit (number), offset (number)
 */
router.get(
  '/',
  notificationController.getUserNotifications
);

/**
 * GET /api/notifications/unread/count
 * Get unread notification count for the authenticated user
 */
router.get(
  '/unread/count',
  notificationController.getUnreadCount
);

/**
 * GET /api/notifications/:id
 * Get notification by ID
 */
router.get(
  '/:id',
  notificationController.getNotificationById
);

/**
 * PATCH /api/notifications/:id/read
 * Mark notification as read
 */
router.patch(
  '/:id/read',
  notificationController.markAsRead
);

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read for the authenticated user
 */
router.patch(
  '/read-all',
  notificationController.markAllAsRead
);

/**
 * DELETE /api/notifications/:id
 * Delete notification
 */
router.delete(
  '/:id',
  notificationController.deleteNotification
);

/**
 * DELETE /api/notifications/read/all
 * Delete all read notifications for the authenticated user
 */
router.delete(
  '/read/all',
  notificationController.deleteReadNotifications
);

/**
 * POST /api/notifications
 * Create notification (Admin only)
 */
router.post(
  '/',
  authorize(['ADMIN']),
  notificationController.createNotification
);

export default router;

