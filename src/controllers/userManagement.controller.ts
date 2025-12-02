import { Request, Response } from 'express';
import * as userManagementService from '../services/userManagement.service';
import * as gymAccess from '../utils/gymAccess';

/**
 * Get all users
 */
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Get accessible gym IDs (admins get all, others get only assigned)
    const accessibleGymIds = await gymAccess.getUserAccessibleGymIds(userId, userRole);

    const filters = {
      search: req.query.search as string,
      role: req.query.role as string,
      status: req.query.status as string,
      showDeleted: req.query.showDeleted === 'true',
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
      accessibleGymIds: userRole === 'ADMIN' ? undefined : accessibleGymIds // Admins see all
    };

    const result = await userManagementService.getAllUsers(filters);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get user by ID
 */
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await userManagementService.getUserById(req.params.id);
    res.status(200).json({ success: true, data: user });
  } catch (error: any) {
    const statusCode = error.message === 'User not found' ? 404 : 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

/**
 * Create user
 */
export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const createdBy = req.user?.userId || 'system';
    const user = await userManagementService.createUser(req.body, createdBy);
    res.status(201).json({ success: true, message: 'User created successfully', data: user });
  } catch (error: any) {
    const statusCode = error.message.includes('already exists') ? 409 : 400;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

/**
 * Update user
 */
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const updatedBy = req.user?.userId || 'system';
    const user = await userManagementService.updateUser(req.params.id, req.body, updatedBy);
    res.status(200).json({ success: true, message: 'User updated successfully', data: user });
  } catch (error: any) {
    const statusCode = error.message === 'User not found' ? 404 : 400;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

/**
 * Delete user
 */
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const deletedBy = req.user?.userId || 'system';
    await userManagementService.deleteUser(req.params.id, deletedBy);
    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Bulk update user status
 */
export const bulkUpdateUserStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userIds, status } = req.body;
    const updatedBy = req.user?.userId || 'system';

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({ success: false, message: 'User IDs array is required' });
      return;
    }

    await userManagementService.bulkUpdateUserStatus(userIds, status, updatedBy);
    res.status(200).json({ success: true, message: `${userIds.length} users updated` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Bulk delete users
 */
export const bulkDeleteUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userIds } = req.body;
    const deletedBy = req.user?.userId || 'system';

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({ success: false, message: 'User IDs array is required' });
      return;
    }

    await userManagementService.bulkDeleteUsers(userIds, deletedBy);
    res.status(200).json({ success: true, message: `${userIds.length} users deleted` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get user statistics
 */
export const getUserStatistics = async (_req: Request, res: Response): Promise<void> => {
  try {
    const statistics = await userManagementService.getUserStatistics();
    res.status(200).json({ success: true, data: statistics });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
