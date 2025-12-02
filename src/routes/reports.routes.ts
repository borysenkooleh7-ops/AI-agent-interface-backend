import express from 'express';
import * as reportsController from '../controllers/reports.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/reports/templates
 * Get available report templates
 */
router.get(
  '/templates',
  reportsController.getReportTemplates
);

/**
 * GET /api/reports/generate/leads
 * Generate leads report
 * Query params: gymId, startDate, endDate, format, includeLevel
 */
router.get(
  '/generate/leads',
  reportsController.generateLeadsReport
);

/**
 * GET /api/reports/generate/performance
 * Generate performance report
 */
router.get(
  '/generate/performance',
  reportsController.generatePerformanceReport
);

/**
 * GET /api/reports/generate/conversion
 * Generate conversion report
 */
router.get(
  '/generate/conversion',
  reportsController.generateConversionReport
);

/**
 * GET /api/reports/generate/activity
 * Generate activity report
 */
router.get(
  '/generate/activity',
  reportsController.generateActivityReport
);

/**
 * GET /api/reports/history
 * Get export history for the user
 */
router.get(
  '/history',
  reportsController.getExportHistory
);

/**
 * GET /api/reports/statistics
 * Get export statistics
 */
router.get(
  '/statistics',
  reportsController.getExportStatistics
);

export default router;

