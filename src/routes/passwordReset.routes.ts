/**
 * Password Reset Routes
 * Routes for password reset functionality
 */

import { Router } from 'express';
import * as passwordResetController from '../controllers/passwordReset.controller';
import { validate, passwordResetSchemas } from '../middleware/validate.middleware';

const router = Router();

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset email
 * @access  Public
 */
router.post(
  '/forgot-password',
  validate(passwordResetSchemas.requestReset),
  passwordResetController.requestPasswordReset
);

/**
 * @route   POST /api/auth/reset-password/verify
 * @desc    Verify reset token validity
 * @access  Public
 */
router.post(
  '/reset-password/verify',
  validate(passwordResetSchemas.verifyToken),
  passwordResetController.verifyResetToken
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with valid token
 * @access  Public
 */
router.post(
  '/reset-password',
  validate(passwordResetSchemas.resetPassword),
  passwordResetController.resetPassword
);

/**
 * @route   GET /api/auth/test-email
 * @desc    Test email configuration (development only)
 * @access  Public (development only)
 */
router.get(
  '/test-email',
  passwordResetController.testEmailConfig
);

export default router;

