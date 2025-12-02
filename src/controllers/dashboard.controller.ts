import { Request, Response } from 'express';
import * as dashboardService from '../services/dashboard.service';
import * as gymAccess from '../utils/gymAccess';
import logger from '../utils/logger';

/**
 * Get dashboard KPIs
 */
export async function getDashboardKPIs(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { gymId, startDate, endDate } = req.query;

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

    const filters: any = {
      accessibleGymIds: userRole === 'ADMIN' ? undefined : accessibleGymIds
    };
    
    if (filterGymId) {
      filters.gymId = filterGymId;
    }

    if (startDate && endDate) {
      filters.startDate = new Date(startDate as string);
      filters.endDate = new Date(endDate as string);
    }

    const kpis = await dashboardService.getDashboardKPIs(filters);

    res.json({
      success: true,
      data: kpis
    });
  } catch (error: any) {
    logger.error('Error in getDashboardKPIs controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard KPIs'
    });
  }
}

/**
 * Get recent activities
 */
export async function getRecentActivities(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { gymId } = req.query;

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

    const filters: any = {
      accessibleGymIds: userRole === 'ADMIN' ? undefined : accessibleGymIds
    };
    
    if (filterGymId) {
      filters.gymId = filterGymId;
    }

    const activities = await dashboardService.getRecentActivities(filters);

    res.json({
      success: true,
      data: activities
    });
  } catch (error: any) {
    logger.error('Error in getRecentActivities controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve recent activities'
    });
  }
}

/**
 * Get quick stats
 */
export async function getQuickStats(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { gymId } = req.query;

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

    const filters: any = {
      accessibleGymIds: userRole === 'ADMIN' ? undefined : accessibleGymIds
    };
    
    if (filterGymId) {
      filters.gymId = filterGymId;
    }

    const stats = await dashboardService.getQuickStats(filters);

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    logger.error('Error in getQuickStats controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve quick stats'
    });
  }
}

/**
 * Get leads over time data
 */
export async function getLeadsOverTime(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { gymId } = req.query;

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

    const filters: any = {
      accessibleGymIds: userRole === 'ADMIN' ? undefined : accessibleGymIds
    };
    
    if (filterGymId) {
      filters.gymId = filterGymId;
    }

    const data = await dashboardService.getLeadsOverTime(filters);

    res.json({
      success: true,
      data
    });
  } catch (error: any) {
    logger.error('Error in getLeadsOverTime controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve leads over time data'
    });
  }
}

/**
 * Get all dashboard data in one call
 */
export async function getDashboardData(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { gymId, startDate, endDate } = req.query;

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

    const filters: any = {
      accessibleGymIds: userRole === 'ADMIN' ? undefined : accessibleGymIds
    };
    
    if (filterGymId) {
      filters.gymId = filterGymId;
    }

    if (startDate && endDate) {
      filters.startDate = new Date(startDate as string);
      filters.endDate = new Date(endDate as string);
    }

    const data = await dashboardService.getDashboardData(filters);

    res.json({
      success: true,
      data
    });
  } catch (error: any) {
    logger.error('Error in getDashboardData controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard data'
    });
  }
}

