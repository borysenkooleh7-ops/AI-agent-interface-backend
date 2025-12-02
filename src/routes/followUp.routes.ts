import express from 'express';
import * as followUpController from '../controllers/followUp.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/followups
 * @desc    Get all follow-ups with filtering and pagination
 * @access  Private
 */
router.get('/', followUpController.getAllFollowUps);

/**
 * @route   GET /api/followups/statistics
 * @desc    Get follow-up statistics
 * @access  Private
 */
router.get('/statistics', followUpController.getFollowUpStatistics);

/**
 * @route   GET /api/followups/:id
 * @desc    Get follow-up by ID
 * @access  Private
 */
router.get('/:id', followUpController.getFollowUpById);

/**
 * @route   POST /api/followups
 * @desc    Create new follow-up
 * @access  Private
 */
router.post('/', followUpController.createFollowUp);

/**
 * @route   PUT /api/followups/:id
 * @desc    Update follow-up
 * @access  Private
 */
router.put('/:id', followUpController.updateFollowUp);

/**
 * @route   PATCH /api/followups/:id/complete
 * @desc    Complete follow-up
 * @access  Private
 */
router.patch('/:id/complete', followUpController.completeFollowUp);

/**
 * @route   PATCH /api/followups/:id/cancel
 * @desc    Cancel follow-up
 * @access  Private
 */
router.patch('/:id/cancel', followUpController.cancelFollowUp);

/**
 * @route   DELETE /api/followups/:id
 * @desc    Delete follow-up
 * @access  Private
 */
router.delete('/:id', followUpController.deleteFollowUp);

/**
 * @route   POST /api/followups/mark-overdue
 * @desc    Mark overdue follow-ups
 * @access  Private (ADMIN, MANAGER)
 */
router.post('/mark-overdue', authorize(['ADMIN', 'MANAGER']), followUpController.markOverdueFollowUps);

export default router;
