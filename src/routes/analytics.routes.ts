import express from 'express';
import * as analyticsController from '../controllers/analytics.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/analytics
 * Get all analytics data
 * Query params: gymId, startDate, endDate
 */
router.get(
  '/',
  analyticsController.getAnalyticsData
);

/**
 * GET /api/analytics/summary
 * Get analytics summary metrics
 */
router.get(
  '/summary',
  analyticsController.getAnalyticsSummary
);

/**
 * GET /api/analytics/leads-acquisition-trend
 * Get leads acquisition trend data
 */
router.get(
  '/leads-acquisition-trend',
  analyticsController.getLeadsAcquisitionTrend
);

/**
 * GET /api/analytics/status-distribution
 * Get lead status distribution
 */
router.get(
  '/status-distribution',
  analyticsController.getLeadStatusDistribution
);

/**
 * GET /api/analytics/conversion-funnel
 * Get conversion funnel data
 */
router.get(
  '/conversion-funnel',
  analyticsController.getConversionFunnel
);

/**
 * GET /api/analytics/lead-sources
 * Get lead sources distribution
 */
router.get(
  '/lead-sources',
  analyticsController.getLeadSources
);

/**
 * GET /api/analytics/peak-hours
 * Get peak performance hours
 */
router.get(
  '/peak-hours',
  analyticsController.getPeakPerformanceHours
);

/**
 * GET /api/analytics/agent-performance
 * Get agent performance metrics
 */
router.get(
  '/agent-performance',
  analyticsController.getAgentPerformance
);

/**
 * GET /api/analytics/conversion-metrics
 * Get conversion metrics
 */
router.get(
  '/conversion-metrics',
  analyticsController.getConversionMetrics
);

/**
 * GET /api/analytics/engagement-metrics
 * Get engagement metrics
 */
router.get(
  '/engagement-metrics',
  analyticsController.getEngagementMetrics
);

export default router;

