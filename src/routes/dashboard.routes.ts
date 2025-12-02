import express from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/dashboard
 * Get all dashboard data (KPIs, activities, quick stats, chart data)
 * Query params: gymId (string), startDate (ISO string), endDate (ISO string)
 */
router.get(
  '/',
  dashboardController.getDashboardData
);

/**
 * GET /api/dashboard/kpis
 * Get dashboard KPIs only
 */
router.get(
  '/kpis',
  dashboardController.getDashboardKPIs
);

/**
 * GET /api/dashboard/activities
 * Get recent activities only
 */
router.get(
  '/activities',
  dashboardController.getRecentActivities
);

/**
 * GET /api/dashboard/quick-stats
 * Get quick stats only
 */
router.get(
  '/quick-stats',
  dashboardController.getQuickStats
);

/**
 * GET /api/dashboard/leads-over-time
 * Get leads over time data for chart
 */
router.get(
  '/leads-over-time',
  dashboardController.getLeadsOverTime
);

export default router;

