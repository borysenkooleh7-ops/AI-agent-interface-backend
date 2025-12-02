import express from 'express';
import * as leadController from '../controllers/lead.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/leads
 * @desc    Get all leads with filtering and pagination
 * @access  Private
 */
router.get('/', leadController.getAllLeads);

/**
 * @route   GET /api/leads/statistics
 * @desc    Get lead statistics
 * @access  Private
 */
router.get('/statistics', leadController.getLeadStatistics);

/**
 * @route   GET /api/leads/export
 * @desc    Export leads to CSV
 * @access  Private (ADMIN, MANAGER)
 */
router.get('/export', authorize(['ADMIN', 'MANAGER']), leadController.exportLeads);

/**
 * @route   PATCH /api/leads/bulk/status
 * @desc    Bulk update lead status
 * @access  Private
 */
router.patch('/bulk/status', leadController.bulkUpdateLeadStatus);

/**
 * @route   DELETE /api/leads/bulk
 * @desc    Bulk delete leads
 * @access  Private (ADMIN, MANAGER)
 */
router.delete('/bulk', authorize(['ADMIN', 'MANAGER']), leadController.bulkDeleteLeads);

/**
 * @route   POST /api/leads
 * @desc    Create new lead
 * @access  Private
 */
router.post('/', leadController.createLead);

/**
 * @route   GET /api/leads/:id
 * @desc    Get lead by ID
 * @access  Private
 */
router.get('/:id', leadController.getLeadById);

/**
 * @route   PUT /api/leads/:id
 * @desc    Update lead
 * @access  Private
 */
router.put('/:id', leadController.updateLead);

/**
 * @route   DELETE /api/leads/:id
 * @desc    Delete lead (soft delete)
 * @access  Private (ADMIN, MANAGER)
 */
router.delete('/:id', authorize(['ADMIN', 'MANAGER']), leadController.deleteLead);

export default router;

