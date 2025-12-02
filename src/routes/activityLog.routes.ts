import express from 'express';
import * as activityLogController from '../controllers/activityLog.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/activity-logs
 * Get activity logs with filtering and pagination
 * Query params: gymId, userId, leadId, type, search, startDate, endDate, limit, offset
 */
router.get(
  '/',
  activityLogController.getActivityLogs
);

/**
 * GET /api/activity-logs/stats
 * Get activity log statistics
 * Query params: gymId, startDate, endDate
 */
router.get(
  '/stats',
  activityLogController.getActivityLogStats
);

/**
 * GET /api/activity-logs/export
 * Export activity logs to CSV
 * Query params: gymId, userId, leadId, type, search, startDate, endDate
 */
router.get(
  '/export',
  activityLogController.exportActivityLogs
);

/**
 * GET /api/activity-logs/:id
 * Get activity log by ID
 */
router.get(
  '/:id',
  activityLogController.getActivityLogById
);

export default router;
