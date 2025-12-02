import { Request, Response } from 'express';
import * as memberService from '../services/member.service';
import * as gymAccess from '../utils/gymAccess';
import logger from '../utils/logger';

/**
 * Get all members with filtering
 */
export async function getAllMembers(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { gymId, status, search, limit, offset } = req.query;

    // Get accessible gym IDs
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
      status: status as string,
      search: search as string,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
      accessibleGymIds: userRole === 'ADMIN' ? undefined : accessibleGymIds
    };

    const result = await memberService.getAllMembers(filters);

    res.status(200).json({
      success: true,
      data: result.members,
      pagination: {
        total: result.total,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: result.hasMore
      }
    });
  } catch (error: any) {
    logger.error('Error in getAllMembers controller:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve members'
    });
  }
}

/**
 * Get member by ID
 */
export async function getMemberById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const member = await memberService.getMemberById(id);

    res.status(200).json({
      success: true,
      data: member
    });
  } catch (error: any) {
    logger.error('Error in getMemberById controller:', error);
    res.status(404).json({
      success: false,
      message: error.message || 'Member not found'
    });
  }
}

/**
 * Create new member application
 */
export async function createMember(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    const memberData = req.body;
    const member = await memberService.createMember(memberData, userId);

    res.status(201).json({
      success: true,
      data: member,
      message: 'Member application created successfully'
    });
  } catch (error: any) {
    logger.error('Error in createMember controller:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create member application'
    });
  }
}

/**
 * Update member
 */
export async function updateMember(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    const memberData = req.body;
    const updatedMember = await memberService.updateMember(id, memberData, userId);

    res.status(200).json({
      success: true,
      data: updatedMember,
      message: 'Member updated successfully'
    });
  } catch (error: any) {
    logger.error('Error in updateMember controller:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update member'
    });
  }
}

/**
 * Approve member application
 */
export async function approveMember(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    const member = await memberService.approveMember(id, userId);

    res.status(200).json({
      success: true,
      data: member,
      message: 'Member application approved successfully'
    });
  } catch (error: any) {
    logger.error('Error in approveMember controller:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to approve member application'
    });
  }
}

/**
 * Reject member application
 */
export async function rejectMember(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    const member = await memberService.rejectMember(id, userId);

    res.status(200).json({
      success: true,
      data: member,
      message: 'Member application rejected'
    });
  } catch (error: any) {
    logger.error('Error in rejectMember controller:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to reject member application'
    });
  }
}

/**
 * Delete member (soft delete)
 */
export async function deleteMember(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    await memberService.deleteMember(id, userId);

    res.status(200).json({
      success: true,
      message: 'Member deleted successfully'
    });
  } catch (error: any) {
    logger.error('Error in deleteMember controller:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to delete member'
    });
  }
}

/**
 * Get member statistics
 */
export async function getMemberStatistics(req: Request, res: Response): Promise<void> {
  try {
    const { gymId } = req.query;
    
    const stats = await memberService.getMemberStatistics(gymId as string);

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    logger.error('Error in getMemberStatistics controller:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve statistics'
    });
  }
}

