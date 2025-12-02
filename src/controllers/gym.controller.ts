import { Request, Response } from 'express';
import * as gymService from '../services/gym.service';
import * as gymAccess from '../utils/gymAccess';

/**
 * Get active gyms for public registration (no auth required)
 */
export const getActiveGymsForRegistration = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await gymService.getAllGyms({
      status: 'ACTIVE',
      showDeleted: false,
      limit: 1000 // Get all active gyms for registration
    });
    // Return just the gyms array for easier consumption on the frontend
    res.status(200).json({ success: true, data: result.gyms || [] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get all gyms (filtered by user's accessible gyms)
 */
export const getAllGyms = async (req: Request, res: Response): Promise<void> => {
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
      status: req.query.status as string,
      showDeleted: req.query.showDeleted === 'true',
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
      accessibleGymIds: userRole === 'ADMIN' ? undefined : accessibleGymIds
    };

    const result = await gymService.getAllGyms(filters);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get gym by ID
 */
export const getGymById = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const gymId = req.params.id;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Check if user has access to this gym
    const hasAccess = await gymAccess.hasGymAccess(userId, userRole, gymId);
    if (!hasAccess) {
      res.status(403).json({ success: false, message: 'Access denied to this gym' });
      return;
    }

    const gym = await gymService.getGymById(gymId);
    res.status(200).json({ success: true, data: gym });
  } catch (error: any) {
    const statusCode = error.message === 'Gym not found' ? 404 : 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

/**
 * Get gym by slug
 */
export const getGymBySlug = async (req: Request, res: Response): Promise<void> => {
  try {
    const gym = await gymService.getGymBySlug(req.params.slug);
    res.status(200).json({ success: true, data: gym });
  } catch (error: any) {
    const statusCode = error.message === 'Gym not found' ? 404 : 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

/**
 * Create gym
 */
export const createGym = async (req: Request, res: Response): Promise<void> => {
  try {
    const createdBy = req.user?.userId || 'system';
    const gym = await gymService.createGym(req.body, createdBy);
    res.status(201).json({ success: true, message: 'Gym created successfully', data: gym });
  } catch (error: any) {
    const statusCode = error.message.includes('already exists') ? 409 : 400;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

/**
 * Update gym
 */
export const updateGym = async (req: Request, res: Response): Promise<void> => {
  try {
    const updatedBy = req.user?.userId || 'system';
    const gym = await gymService.updateGym(req.params.id, req.body, updatedBy);
    res.status(200).json({ success: true, message: 'Gym updated successfully', data: gym });
  } catch (error: any) {
    const statusCode = error.message === 'Gym not found' ? 404 : 400;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

/**
 * Delete gym
 */
export const deleteGym = async (req: Request, res: Response): Promise<void> => {
  try {
    const deletedBy = req.user?.userId || 'system';
    await gymService.deleteGym(req.params.id, deletedBy);
    res.status(200).json({ success: true, message: 'Gym deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get gym statistics
 */
export const getGymStatistics = async (_req: Request, res: Response): Promise<void> => {
  try {
    const statistics = await gymService.getGymStatistics();
    res.status(200).json({ success: true, data: statistics });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update gym settings
 */
export const updateGymSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const updatedBy = req.user?.userId || 'system';
    const gym = await gymService.updateGymSettings(req.params.id, req.body.settings, updatedBy);
    res.status(200).json({ success: true, message: 'Settings updated successfully', data: gym });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
