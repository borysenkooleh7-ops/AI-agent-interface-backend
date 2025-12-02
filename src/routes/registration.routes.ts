import { Router } from 'express';
import {
  validateInvitation,
  acceptInvitation,
  registerGymOwner,
  createInvitation,
  getGymInvitations,
  cancelInvitation,
  resendInvitation,
  createRegistrationRequest,
  getRegistrationRequests,
  approveRegistrationRequest,
  rejectRegistrationRequest,
} from '../controllers/registration.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate, registrationSchemas } from '../middleware/validate.middleware';

const router = Router();

/**
 * @route   POST /api/auth/register/invitation/validate
 * @desc    Validate invitation code
 * @access  Public
 */
router.post('/invitation/validate', validate(registrationSchemas.validateInvitation), validateInvitation);

/**
 * @route   POST /api/auth/register/invitation/accept
 * @desc    Accept invitation and create user
 * @access  Public
 */
router.post('/invitation/accept', validate(registrationSchemas.acceptInvitation), acceptInvitation);

/**
 * @route   POST /api/auth/register/request
 * @desc    Create registration request (AGENT or MANAGER)
 * @access  Public
 */
router.post('/request', validate(registrationSchemas.createRegistrationRequest), createRegistrationRequest);

/**
 * @route   POST /api/auth/register/gym-owner
 * @desc    Register as gym owner (create gym + admin user)
 * @access  Public
 */
router.post('/gym-owner', validate(registrationSchemas.registerGymOwner), registerGymOwner);

/**
 * @route   POST /api/auth/register/invitation/create
 * @desc    Create invitation (admin only)
 * @access  Private (Admin)
 */
router.post('/invitation/create', authenticate, authorize(['ADMIN']), validate(registrationSchemas.createInvitation), createInvitation);

/**
 * @route   GET /api/auth/register/invitations/:gymId
 * @desc    Get gym invitations (admin only)
 * @access  Private (Admin)
 */
router.get('/invitations/:gymId', authenticate, authorize(['ADMIN']), getGymInvitations);

/**
 * @route   DELETE /api/auth/register/invitation/:id
 * @desc    Cancel invitation (admin only)
 * @access  Private (Admin)
 */
router.delete('/invitation/:id', authenticate, authorize(['ADMIN']), cancelInvitation);

/**
 * @route   POST /api/auth/register/invitation/:id/resend
 * @desc    Resend invitation (admin only)
 * @access  Private (Admin)
 */
router.post('/invitation/:id/resend', authenticate, authorize(['ADMIN']), validate(registrationSchemas.resendInvitation), resendInvitation);

/**
 * @route   GET /api/auth/register/requests
 * @desc    Get registration requests (admin/manager)
 * @access  Private (Admin, Manager)
 */
router.get('/requests', authenticate, authorize(['ADMIN', 'MANAGER']), getRegistrationRequests);

/**
 * @route   POST /api/auth/register/requests/:id/approve
 * @desc    Approve registration request (admin/manager)
 * @access  Private (Admin, Manager)
 */
router.post('/requests/:id/approve', authenticate, authorize(['ADMIN', 'MANAGER']), approveRegistrationRequest);

/**
 * @route   POST /api/auth/register/requests/:id/reject
 * @desc    Reject registration request (admin/manager)
 * @access  Private (Admin, Manager)
 */
router.post('/requests/:id/reject', authenticate, authorize(['ADMIN', 'MANAGER']), rejectRegistrationRequest);

export default router;
