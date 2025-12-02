/**
 * User Routes
 * Routes for user profile operations
 */

import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate, userProfileSchemas } from '../middleware/validate.middleware';
import { avatarUpload } from '../config/upload';

const router = Router();

// All user routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/users/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', userController.getMyProfile);

/**
 * @route   PUT /api/users/me
 * @desc    Update current user profile
 * @access  Private
 */
router.put(
  '/me',
  validate(userProfileSchemas.updateProfile),
  userController.updateMyProfile
);

/**
 * @route   PUT /api/users/me/password
 * @desc    Change password
 * @access  Private
 */
router.put(
  '/me/password',
  validate(userProfileSchemas.changePassword),
  userController.changePassword
);

/**
 * @route   GET /api/users/me/activity
 * @desc    Get user activity log
 * @access  Private
 */
router.get('/me/activity', userController.getMyActivity);

/**
 * @route   GET /api/users/me/stats
 * @desc    Get user statistics
 * @access  Private
 */
router.get('/me/stats', userController.getMyStats);

/**
 * @route   POST /api/users/me/avatar
 * @desc    Upload user avatar (URL)
 * @access  Private
 */
router.post(
  '/me/avatar',
  validate(userProfileSchemas.uploadAvatar),
  userController.uploadAvatar
);

/**
 * @route   POST /api/users/me/avatar/upload
 * @desc    Upload user avatar (File)
 * @access  Private
 */
router.post(
  '/me/avatar/upload',
  avatarUpload.single('avatar'),
  userController.uploadAvatarFile
);

/**
 * @route   DELETE /api/users/me/avatar
 * @desc    Delete user avatar
 * @access  Private
 */
router.delete('/me/avatar', userController.deleteAvatar);

export default router;

