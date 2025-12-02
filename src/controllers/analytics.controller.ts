import { Request, Response } from 'express';
import * as analyticsService from '../services/analytics.service';
import * as gymAccess from '../utils/gymAccess';
import logger from '../utils/logger';

/**
 * Get analytics summary
 */
export async function getAnalyticsSummary(req: Request, res: Response): Promise<void> {
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

    const summary = await analyticsService.getAnalyticsSummary(filters);

    res.json({
      success: true,
      data: summary
    });
  } catch (error: any) {
    logger.error('Error in getAnalyticsSummary controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve analytics summary'
    });
  }
}

/**
 * Get leads acquisition trend
 */
export async function getLeadsAcquisitionTrend(req: Request, res: Response): Promise<void> {
  try {
    const { gymId, startDate, endDate } = req.query;

    const filters: any = {};
    
    if (gymId) {
      filters.gymId = gymId as string;
    }

    if (startDate && endDate) {
      filters.startDate = new Date(startDate as string);
      filters.endDate = new Date(endDate as string);
    }

    const data = await analyticsService.getLeadsAcquisitionTrend(filters);

    res.json({
      success: true,
      data
    });
  } catch (error: any) {
    logger.error('Error in getLeadsAcquisitionTrend controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve leads acquisition trend'
    });
  }
}

/**
 * Get lead status distribution
 */
export async function getLeadStatusDistribution(req: Request, res: Response): Promise<void> {
  try {
    const { gymId } = req.query;

    const filters: any = {};
    
    if (gymId) {
      filters.gymId = gymId as string;
    }

    const data = await analyticsService.getLeadStatusDistribution(filters);

    res.json({
      success: true,
      data
    });
  } catch (error: any) {
    logger.error('Error in getLeadStatusDistribution controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve lead status distribution'
    });
  }
}

/**
 * Get conversion funnel
 */
export async function getConversionFunnel(req: Request, res: Response): Promise<void> {
  try {
    const { gymId, startDate, endDate } = req.query;

    const filters: any = {};
    
    if (gymId) {
      filters.gymId = gymId as string;
    }

    if (startDate && endDate) {
      filters.startDate = new Date(startDate as string);
      filters.endDate = new Date(endDate as string);
    }

    const data = await analyticsService.getConversionFunnel(filters);

    res.json({
      success: true,
      data
    });
  } catch (error: any) {
    logger.error('Error in getConversionFunnel controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve conversion funnel'
    });
  }
}

/**
 * Get lead sources
 */
export async function getLeadSources(req: Request, res: Response): Promise<void> {
  try {
    const { gymId } = req.query;

    const filters: any = {};
    
    if (gymId) {
      filters.gymId = gymId as string;
    }

    const data = await analyticsService.getLeadSources(filters);

    res.json({
      success: true,
      data
    });
  } catch (error: any) {
    logger.error('Error in getLeadSources controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve lead sources'
    });
  }
}

/**
 * Get peak performance hours
 */
export async function getPeakPerformanceHours(req: Request, res: Response): Promise<void> {
  try {
    const { gymId } = req.query;

    const filters: any = {};
    
    if (gymId) {
      filters.gymId = gymId as string;
    }

    const data = await analyticsService.getPeakPerformanceHours(filters);

    res.json({
      success: true,
      data
    });
  } catch (error: any) {
    logger.error('Error in getPeakPerformanceHours controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve peak performance hours'
    });
  }
}

/**
 * Get agent performance
 */
export async function getAgentPerformance(req: Request, res: Response): Promise<void> {
  try {
    const { gymId } = req.query;

    const filters: any = {};
    
    if (gymId) {
      filters.gymId = gymId as string;
    }

    const data = await analyticsService.getAgentPerformance(filters);

    res.json({
      success: true,
      data
    });
  } catch (error: any) {
    logger.error('Error in getAgentPerformance controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve agent performance'
    });
  }
}

/**
 * Get conversion metrics
 */
export async function getConversionMetrics(req: Request, res: Response): Promise<void> {
  try {
    const { gymId, startDate, endDate } = req.query;

    const filters: any = {};
    
    if (gymId) {
      filters.gymId = gymId as string;
    }

    if (startDate && endDate) {
      filters.startDate = new Date(startDate as string);
      filters.endDate = new Date(endDate as string);
    }

    const data = await analyticsService.getConversionMetrics(filters);

    res.json({
      success: true,
      data
    });
  } catch (error: any) {
    logger.error('Error in getConversionMetrics controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve conversion metrics'
    });
  }
}

/**
 * Get engagement metrics
 */
export async function getEngagementMetrics(req: Request, res: Response): Promise<void> {
  try {
    const { gymId, startDate, endDate } = req.query;

    const filters: any = {};
    
    if (gymId) {
      filters.gymId = gymId as string;
    }

    if (startDate && endDate) {
      filters.startDate = new Date(startDate as string);
      filters.endDate = new Date(endDate as string);
    }

    const data = await analyticsService.getEngagementMetrics(filters);

    res.json({
      success: true,
      data
    });
  } catch (error: any) {
    logger.error('Error in getEngagementMetrics controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve engagement metrics'
    });
  }
}

/**
 * Get all analytics data
 */
export async function getAnalyticsData(req: Request, res: Response): Promise<void> {
  try {
    const { gymId, startDate, endDate } = req.query;

    const filters: any = {};
    
    if (gymId) {
      filters.gymId = gymId as string;
    }

    if (startDate && endDate) {
      filters.startDate = new Date(startDate as string);
      filters.endDate = new Date(endDate as string);
    }

    const data = await analyticsService.getAnalyticsData(filters);

    res.json({
      success: true,
      data
    });
  } catch (error: any) {
    logger.error('Error in getAnalyticsData controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve analytics data'
    });
  }
}

