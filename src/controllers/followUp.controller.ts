import { Request, Response } from 'express';
import * as followUpService from '../services/followUp.service';
import logger from '../utils/logger';

/**
 * Get all follow-ups
 */
export async function getAllFollowUps(req: Request, res: Response): Promise<void> {
  try {
    const {
      leadId,
      status,
      type,
      assignedToId,
      gymId,
      dateFrom,
      dateTo,
      showCompleted,
      limit,
      offset
    } = req.query;

    const filters = {
      leadId: leadId as string,
      status: status as string,
      type: type as string,
      assignedToId: assignedToId as string,
      gymId: gymId as string,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
      showCompleted: showCompleted === 'true',
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0
    };

    const result = await followUpService.getAllFollowUps(filters);

    res.json({
      success: true,
      data: result.followUps,
      pagination: {
        total: result.total,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: result.hasMore
      },
      stats: result.stats
    });
  } catch (error: any) {
    logger.error('Error in getAllFollowUps controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve follow-ups'
    });
  }
}

/**
 * Get follow-up by ID
 */
export async function getFollowUpById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const followUp = await followUpService.getFollowUpById(id);

    res.json({
      success: true,
      data: followUp
    });
  } catch (error: any) {
    logger.error('Error in getFollowUpById controller:', error);
    res.status(404).json({
      success: false,
      message: error.message || 'Follow-up not found'
    });
  }
}

/**
 * Create follow-up
 */
export async function createFollowUp(req: Request, res: Response): Promise<void> {
  try {
    const { leadId, type, scheduledAt, notes } = req.body;
    const createdBy = (req as any).user.id;

    const followUp = await followUpService.createFollowUp({
      leadId,
      type,
      scheduledAt: new Date(scheduledAt),
      notes
    }, createdBy);

    res.status(201).json({
      success: true,
      data: followUp,
      message: 'Follow-up created successfully'
    });
  } catch (error: any) {
    logger.error('Error in createFollowUp controller:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create follow-up'
    });
  }
}

/**
 * Update follow-up
 */
export async function updateFollowUp(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const updatedBy = (req as any).user.id;

    const followUp = await followUpService.updateFollowUp(id, updateData, updatedBy);

    res.json({
      success: true,
      data: followUp,
      message: 'Follow-up updated successfully'
    });
  } catch (error: any) {
    logger.error('Error in updateFollowUp controller:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update follow-up'
    });
  }
}

/**
 * Complete follow-up
 */
export async function completeFollowUp(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const completedBy = (req as any).user.id;

    const followUp = await followUpService.completeFollowUp(id, completedBy, notes);

    res.json({
      success: true,
      data: followUp,
      message: 'Follow-up completed successfully'
    });
  } catch (error: any) {
    logger.error('Error in completeFollowUp controller:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to complete follow-up'
    });
  }
}

/**
 * Cancel follow-up
 */
export async function cancelFollowUp(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const cancelledBy = (req as any).user.id;

    const followUp = await followUpService.cancelFollowUp(id, cancelledBy, reason);

    res.json({
      success: true,
      data: followUp,
      message: 'Follow-up cancelled successfully'
    });
  } catch (error: any) {
    logger.error('Error in cancelFollowUp controller:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to cancel follow-up'
    });
  }
}

/**
 * Delete follow-up
 */
export async function deleteFollowUp(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const deletedBy = (req as any).user.id;

    await followUpService.deleteFollowUp(id, deletedBy);

    res.json({
      success: true,
      message: 'Follow-up deleted successfully'
    });
  } catch (error: any) {
    logger.error('Error in deleteFollowUp controller:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to delete follow-up'
    });
  }
}

/**
 * Get follow-up statistics
 */
export async function getFollowUpStatistics(req: Request, res: Response): Promise<void> {
  try {
    const {
      assignedToId,
      gymId,
      dateFrom,
      dateTo
    } = req.query;

    const filters = {
      assignedToId: assignedToId as string,
      gymId: gymId as string,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined
    };

    const stats = await followUpService.getFollowUpStatistics(filters);

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    logger.error('Error in getFollowUpStatistics controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve follow-up statistics'
    });
  }
}

/**
 * Mark overdue follow-ups
 */
export async function markOverdueFollowUps(_req: Request, res: Response): Promise<void> {
  try {
    await followUpService.markOverdueFollowUps();

    res.json({
      success: true,
      message: 'Overdue follow-ups marked successfully'
    });
  } catch (error: any) {
    logger.error('Error in markOverdueFollowUps controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark overdue follow-ups'
    });
  }
}
