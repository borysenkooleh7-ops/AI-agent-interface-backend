import { Request, Response } from 'express';
import * as leadService from '../services/lead.service';
import * as gymAccess from '../utils/gymAccess';
import logger from '../utils/logger';

/**
 * Get all leads with filtering
 */
export async function getAllLeads(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const {
      search,
      status,
      gymId,
      source,
      assignedToId,
      dateFrom,
      dateTo,
      showDeleted,
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

    // If no gymId specified and user is not admin, filter by accessible gyms
    if (!filterGymId && userRole !== 'ADMIN' && accessibleGymIds.length > 0) {
      // Will be handled in the service level
    }

    const filters = {
      search: search as string,
      status: status as string,
      gymId: filterGymId,
      source: source as string,
      assignedToId: assignedToId as string,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
      showDeleted: showDeleted === 'true',
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
      accessibleGymIds: userRole === 'ADMIN' ? undefined : accessibleGymIds
    };

    const result = await leadService.getAllLeads(filters);

    res.status(200).json({
      success: true,
      data: result.leads,
      pagination: {
        total: result.total,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: result.hasMore
      },
      stats: result.stats
    });
  } catch (error: any) {
    logger.error('Error in getAllLeads controller:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve leads'
    });
  }
}

/**
 * Get lead by ID
 */
export async function getLeadById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const lead = await leadService.getLeadById(id);

    res.status(200).json({
      success: true,
      data: lead
    });
  } catch (error: any) {
    logger.error('Error in getLeadById controller:', error);
    res.status(404).json({
      success: false,
      message: error.message || 'Lead not found'
    });
  }
}

/**
 * Create new lead
 */
export async function createLead(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    const leadData = req.body;
    const lead = await leadService.createLead(leadData, userId);

    res.status(201).json({
      success: true,
      data: lead,
      message: 'Lead created successfully'
    });
  } catch (error: any) {
    logger.error('Error in createLead controller:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create lead'
    });
  }
}

/**
 * Update lead
 */
export async function updateLead(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    const leadData = req.body;
    const updatedLead = await leadService.updateLead(id, leadData, userId);

    res.status(200).json({
      success: true,
      data: updatedLead,
      message: 'Lead updated successfully'
    });
  } catch (error: any) {
    logger.error('Error in updateLead controller:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update lead'
    });
  }
}

/**
 * Delete lead (soft delete)
 */
export async function deleteLead(req: Request, res: Response): Promise<void> {
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

    await leadService.deleteLead(id, userId);

    res.status(200).json({
      success: true,
      message: 'Lead deleted successfully'
    });
  } catch (error: any) {
    logger.error('Error in deleteLead controller:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to delete lead'
    });
  }
}

/**
 * Bulk update lead status
 */
export async function bulkUpdateLeadStatus(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    const { leadIds, status } = req.body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Lead IDs are required'
      });
      return;
    }

    if (!status) {
      res.status(400).json({
        success: false,
        message: 'Status is required'
      });
      return;
    }

    await leadService.bulkUpdateLeadStatus(leadIds, status, userId);

    res.status(200).json({
      success: true,
      message: `${leadIds.length} leads updated successfully`
    });
  } catch (error: any) {
    logger.error('Error in bulkUpdateLeadStatus controller:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update leads'
    });
  }
}

/**
 * Bulk delete leads
 */
export async function bulkDeleteLeads(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    const { leadIds } = req.body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Lead IDs are required'
      });
      return;
    }

    await leadService.bulkDeleteLeads(leadIds, userId);

    res.status(200).json({
      success: true,
      message: `${leadIds.length} leads deleted successfully`
    });
  } catch (error: any) {
    logger.error('Error in bulkDeleteLeads controller:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to delete leads'
    });
  }
}

/**
 * Get lead statistics
 */
export async function getLeadStatistics(req: Request, res: Response): Promise<void> {
  try {
    const { gymId } = req.query;
    
    const stats = await leadService.getLeadStatistics(gymId as string);

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    logger.error('Error in getLeadStatistics controller:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve statistics'
    });
  }
}

/**
 * Export leads to CSV
 */
export async function exportLeads(req: Request, res: Response): Promise<void> {
  try {
    const {
      search,
      status,
      gymId,
      source,
      assignedToId,
      dateFrom,
      dateTo
    } = req.query;

    const filters = {
      search: search as string,
      status: status as string,
      gymId: gymId as string,
      source: source as string,
      assignedToId: assignedToId as string,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
      showDeleted: false,
      limit: 10000, // Export all
      offset: 0
    };

    const result = await leadService.getAllLeads(filters);

    // Convert to CSV
    const headers = ['Name', 'Phone', 'Email', 'City', 'State', 'Status', 'Source', 'Score', 'Gym', 'Created At'];
    const csv = [
      headers.join(','),
      ...result.leads.map(lead => [
        lead.name,
        lead.phone,
        lead.email || '',
        lead.city || '',
        lead.state || '',
        lead.status,
        lead.source,
        lead.score,
        lead.gym.name,
        new Date(lead.createdAt).toISOString()
      ].join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=leads-${Date.now()}.csv`);
    res.status(200).send(csv);
  } catch (error: any) {
    logger.error('Error in exportLeads controller:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to export leads'
    });
  }
}

