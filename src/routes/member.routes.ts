import express from 'express';
import * as memberController from '../controllers/member.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/auth.middleware';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/members
 * Get all members with filtering
 * Query params: gymId, status, search, limit, offset
 */
router.get(
  '/',
  memberController.getAllMembers
);

/**
 * GET /api/members/statistics
 * Get member statistics
 */
router.get(
  '/statistics',
  memberController.getMemberStatistics
);

/**
 * GET /api/members/:id
 * Get member by ID
 */
router.get(
  '/:id',
  memberController.getMemberById
);

/**
 * POST /api/members
 * Create new member application
 */
router.post(
  '/',
  authorize(['ADMIN', 'MANAGER', 'AGENT']),
  memberController.createMember
);

/**
 * PUT /api/members/:id
 * Update member
 */
router.put(
  '/:id',
  authorize(['ADMIN', 'MANAGER']),
  memberController.updateMember
);

/**
 * PATCH /api/members/:id/approve
 * Approve member application
 */
router.patch(
  '/:id/approve',
  authorize(['ADMIN', 'MANAGER']),
  memberController.approveMember
);

/**
 * PATCH /api/members/:id/reject
 * Reject member application
 */
router.patch(
  '/:id/reject',
  authorize(['ADMIN', 'MANAGER']),
  memberController.rejectMember
);

/**
 * DELETE /api/members/:id
 * Delete member (soft delete)
 */
router.delete(
  '/:id',
  authorize(['ADMIN', 'MANAGER']),
  memberController.deleteMember
);

export default router;

