import { Request, Response } from 'express';
import * as planService from '../services/plan.service';
import * as gymAccess from '../utils/gymAccess';
import logger from '../utils/logger';

/**
 * Get all plans with filtering
 */
export async function getAllPlans(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const {
      gymId,
      active,
      search,
      limit,
      offset
    } = req.query;

    // Get accessible gym IDs (admins get all, others get only assigned)
    const accessibleGymIds = await gymAccess.getUserAccessibleGymIds(userId, userRole);

    // If specific gymId is requested, verify access
    let filterGymId = gymId as string;
    if (filterGymId && userRole !== 'ADMIN') {
      if (!accessibleGymIds.includes(filterGymId)) {
        res.status(403).json({ success: false, message: 'Access denied to this gym' });
        return;
      }
    }

    const filters = {
      gymId: filterGymId,
      active: active === 'true' ? true : active === 'false' ? false : undefined,
      search: search as string,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
      accessibleGymIds: userRole === 'ADMIN' ? undefined : accessibleGymIds
    };

    const result = await planService.getAllPlans(filters);

    res.status(200).json({
      success: true,
      data: result.plans,
      pagination: {
        total: result.total,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: result.hasMore
      }
    });
  } catch (error: any) {
    logger.error('Error in getAllPlans controller:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get plan by ID
 */
export async function getPlanById(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const plan = await planService.getPlanById(req.params.id);

    // Verify access to the gym
    const hasAccess = await gymAccess.hasGymAccess(userId, userRole, plan.gymId);
    if (!hasAccess) {
      res.status(403).json({ success: false, message: 'Access denied to this plan' });
      return;
    }

    res.status(200).json({ success: true, data: plan });
  } catch (error: any) {
    const statusCode = error.message === 'Plan not found' ? 404 : 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
}

/**
 * Get plans by gym ID
 */
export async function getPlansByGymId(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const gymId = req.params.gymId;

    // Verify access to the gym
    const hasAccess = await gymAccess.hasGymAccess(userId, userRole, gymId);
    if (!hasAccess) {
      res.status(403).json({ success: false, message: 'Access denied to this gym' });
      return;
    }

    const plans = await planService.getPlansByGymId(gymId);

    res.status(200).json({ success: true, data: plans });
  } catch (error: any) {
    logger.error('Error in getPlansByGymId controller:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Create new plan
 */
export async function createPlan(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { gymId, name, description, price, duration, features, active } = req.body;

    if (!gymId || !name || price === undefined || duration === undefined) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: gymId, name, price, duration'
      });
      return;
    }

    // Verify access to the gym
    const hasAccess = await gymAccess.hasGymAccess(userId, userRole, gymId);
    if (!hasAccess) {
      res.status(403).json({ success: false, message: 'Access denied to this gym' });
      return;
    }

    const plan = await planService.createPlan({
      gymId,
      name,
      description,
      price,
      duration,
      features,
      active
    }, userId);

    res.status(201).json({ success: true, message: 'Plan created successfully', data: plan });
  } catch (error: any) {
    logger.error('Error in createPlan controller:', error);
    const statusCode = error.message === 'Gym not found' ? 404 : 400;
    res.status(statusCode).json({ success: false, message: error.message });
  }
}

/**
 * Update plan
 */
export async function updatePlan(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // First get the plan to check access
    const existingPlan = await planService.getPlanById(req.params.id);

    // Verify access to the gym
    const hasAccess = await gymAccess.hasGymAccess(userId, userRole, existingPlan.gymId);
    if (!hasAccess) {
      res.status(403).json({ success: false, message: 'Access denied to this plan' });
      return;
    }

    const plan = await planService.updatePlan(req.params.id, req.body, userId);

    res.status(200).json({ success: true, message: 'Plan updated successfully', data: plan });
  } catch (error: any) {
    logger.error('Error in updatePlan controller:', error);
    const statusCode = error.message === 'Plan not found' ? 404 : 400;
    res.status(statusCode).json({ success: false, message: error.message });
  }
}

/**
 * Delete plan
 */
export async function deletePlan(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // First get the plan to check access
    const existingPlan = await planService.getPlanById(req.params.id);

    // Verify access to the gym
    const hasAccess = await gymAccess.hasGymAccess(userId, userRole, existingPlan.gymId);
    if (!hasAccess) {
      res.status(403).json({ success: false, message: 'Access denied to this plan' });
      return;
    }

    await planService.deletePlan(req.params.id, userId);

    res.status(200).json({ success: true, message: 'Plan deleted successfully' });
  } catch (error: any) {
    logger.error('Error in deletePlan controller:', error);
    const statusCode = error.message === 'Plan not found' ? 404 : 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
}

