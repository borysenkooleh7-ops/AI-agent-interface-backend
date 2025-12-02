import { Request, Response } from 'express';
import * as activityLogService from '../services/activityLog.service';
import * as gymAccess from '../utils/gymAccess';
import logger from '../utils/logger';

/**
 * Get activity logs with filtering and pagination
 * GET /api/activity-logs
 */
export async function getActivityLogs(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const {
      gymId,
      userId: filterUserId,
      leadId,
      type,
      search,
      startDate,
      endDate,
      limit,
      offset
    } = req.query;

    // Get accessible gym IDs (admins get all, others get only assigned)
    const accessibleGymIds = await gymAccess.getUserAccessibleGymIds(userId, userRole);

    // If specific gymId is requested, verify access
    let filterGymId = gymId as string;
    if (filterGymId && userRole !== 'ADMIN') {
      if (!accessibleGymIds.includes(filterGymId)) {
        res.status(403).json({ success: false, message: 'Access denied to this gym' });
        return;
      }
    }

    const filters = {
      gymId: filterGymId,
      userId: filterUserId as string,
      leadId: leadId as string,
      type: type as string,
      search: search as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
      accessibleGymIds: userRole === 'ADMIN' ? undefined : accessibleGymIds
    };

    const result = await activityLogService.getActivityLogs(filters);

    res.status(200).json({
      success: true,
      data: result.activities,
      pagination: {
        total: result.total,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: result.hasMore
      },
      stats: result.stats
    });
  } catch (error: any) {
    logger.error('Error in getActivityLogs controller:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve activity logs'
    });
  }
}

/**
 * Get activity log by ID
 * GET /api/activity-logs/:id
 */
export async function getActivityLogById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const activity = await activityLogService.getActivityLogById(id);

    res.status(200).json({
      success: true,
      data: activity
    });
  } catch (error: any) {
    logger.error('Error in getActivityLogById controller:', error);
    const statusCode = error.message === 'Activity log not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to retrieve activity log'
    });
  }
}

/**
 * Get activity log statistics
 * GET /api/activity-logs/stats
 */
export async function getActivityLogStats(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const {
      gymId,
      startDate,
      endDate
    } = req.query;

    // Get accessible gym IDs (admins get all, others get only assigned)
    const accessibleGymIds = await gymAccess.getUserAccessibleGymIds(userId, userRole);

    // If specific gymId is requested, verify access
    let filterGymId = gymId as string;
    if (filterGymId && userRole !== 'ADMIN') {
      if (!accessibleGymIds.includes(filterGymId)) {
        res.status(403).json({ success: false, message: 'Access denied to this gym' });
        return;
      }
    }

    const filters = {
      gymId: filterGymId,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      accessibleGymIds: userRole === 'ADMIN' ? undefined : accessibleGymIds
    };

    const stats = await activityLogService.getActivityLogStats(filters);

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    logger.error('Error in getActivityLogStats controller:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve activity log statistics'
    });
  }
}

/**
 * Export activity logs to CSV
 * GET /api/activity-logs/export
 */
export async function exportActivityLogs(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const {
      gymId,
      userId: filterUserId,
      leadId,
      type,
      search,
      startDate,
      endDate
    } = req.query;

    // Get accessible gym IDs (admins get all, others get only assigned)
    const accessibleGymIds = await gymAccess.getUserAccessibleGymIds(userId, userRole);

    // If specific gymId is requested, verify access
    let filterGymId = gymId as string;
    if (filterGymId && userRole !== 'ADMIN') {
      if (!accessibleGymIds.includes(filterGymId)) {
        res.status(403).json({ success: false, message: 'Access denied to this gym' });
        return;
      }
    }

    const filters = {
      gymId: filterGymId,
      userId: filterUserId as string,
      leadId: leadId as string,
      type: type as string,
      search: search as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      accessibleGymIds: userRole === 'ADMIN' ? undefined : accessibleGymIds
    };

    const csv = await activityLogService.exportActivityLogs(filters);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=activity-logs-${Date.now()}.csv`);
    res.status(200).send(csv);
  } catch (error: any) {
    logger.error('Error in exportActivityLogs controller:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to export activity logs'
    });
  }
}
