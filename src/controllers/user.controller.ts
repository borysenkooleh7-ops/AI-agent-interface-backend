/**
 * User Controller
 * Handles HTTP requests for user profile operations
 */

import { Request, Response } from 'express';
import * as userService from '../services/user.service';
import { getFileUrl, deleteAvatarFile, getFilenameFromUrl } from '../config/upload';

/**
 * Get current user profile
 * GET /api/users/me
 */
export async function getMyProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.userId;

    const user = await userService.getUserProfile(userId);

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error: any) {
    console.error('Error in getMyProfile:', error);
    res.status(error.message === 'User not found' ? 404 : 500).json({
      success: false,
      message: error.message || 'Failed to get user profile'
    });
  }
}

/**
 * Update current user profile
 * PUT /api/users/me
 */
export async function updateMyProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const { name, phone, avatar } = req.body;

    const updatedUser = await userService.updateUserProfile(userId, {
      name,
      phone,
      avatar
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  } catch (error: any) {
    console.error('Error in updateMyProfile:', error);
    res.status(error.message === 'User not found' ? 404 : 500).json({
      success: false,
      message: error.message || 'Failed to update profile'
    });
  }
}

/**
 * Change password
 * PUT /api/users/me/password
 */
export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const { currentPassword, newPassword } = req.body;

    const result = await userService.changePassword(userId, currentPassword, newPassword);

    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error: any) {
    console.error('Error in changePassword:', error);
    
    const statusCode = error.message === 'User not found' ? 404 
                      : error.message === 'Current password is incorrect' ? 400
                      : 500;

    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to change password'
    });
  }
}

/**
 * Get user activity log
 * GET /api/users/me/activity
 */
export async function getMyActivity(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    const result = await userService.getUserActivity(userId, { limit, offset });

    res.status(200).json({
      success: true,
      data: result.activities,
      pagination: result.pagination
    });
  } catch (error: any) {
    console.error('Error in getMyActivity:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get activity log'
    });
  }
}

/**
 * Get user statistics
 * GET /api/users/me/stats
 */
export async function getMyStats(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const gymId = req.query.gymId as string | undefined;

    const stats = await userService.getUserStats(userId, gymId);

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('Error in getMyStats:', error);
    res.status(error.message === 'User not found' ? 404 : 500).json({
      success: false,
      message: error.message || 'Failed to get user statistics'
    });
  }
}

/**
 * Upload avatar
 * POST /api/users/me/avatar
 */
export async function uploadAvatar(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const { avatarUrl } = req.body;

    if (!avatarUrl) {
      res.status(400).json({
        success: false,
        message: 'Avatar URL is required'
      });
      return;
    }

    const updatedUser = await userService.uploadAvatar(userId, avatarUrl);

    res.status(200).json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: updatedUser
    });
  } catch (error: any) {
    console.error('Error in uploadAvatar:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload avatar'
    });
  }
}

/**
 * Upload avatar file
 * POST /api/users/me/avatar/upload
 */
export async function uploadAvatarFile(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
      return;
    }

    // Get current user to delete old avatar if exists
    const currentUser = await userService.getUserProfile(userId);
    if (currentUser.avatar) {
      const oldFilename = getFilenameFromUrl(currentUser.avatar);
      if (oldFilename) {
        deleteAvatarFile(oldFilename);
      }
    }

    // Generate file URL
    const avatarUrl = getFileUrl(req.file.filename, 'avatar');

    // Update user with new avatar URL
    const updatedUser = await userService.uploadAvatar(userId, avatarUrl);

    res.status(200).json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: updatedUser
    });
  } catch (error: any) {
    console.error('Error in uploadAvatarFile:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload avatar file'
    });
  }
}

/**
 * Delete avatar
 * DELETE /api/users/me/avatar
 */
export async function deleteAvatar(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.userId;

    // Get current user to delete avatar file
    const currentUser = await userService.getUserProfile(userId);
    if (currentUser.avatar) {
      const filename = getFilenameFromUrl(currentUser.avatar);
      if (filename) {
        deleteAvatarFile(filename);
      }
    }

    const updatedUser = await userService.deleteAvatar(userId);

    res.status(200).json({
      success: true,
      message: 'Avatar deleted successfully',
      data: updatedUser
    });
  } catch (error: any) {
    console.error('Error in deleteAvatar:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete avatar'
    });
  }
}

