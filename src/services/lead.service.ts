import prisma from '../config/database';
import { softDelete, restore, hardDelete } from '../utils/softDelete';
import logger from '../utils/logger';

export interface CreateLeadData {
  name: string;
  phone: string;
  email?: string;
  city?: string;
  state?: string;
  address?: string;
  zipCode?: string;
  gymId: string;
  source: string;
  status?: string;
  assignedToId?: string;
  notes?: string;
  tags?: string[];
}

export interface UpdateLeadData {
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  address?: string;
  zipCode?: string;
  status?: string;
  source?: string;
  assignedToId?: string;
  notes?: string;
  tags?: string[];
  score?: number;
  goal?: string;
  preferredTime?: string;
  budget?: string;
  startDate?: Date;
}

export interface LeadFilters {
  search?: string;
  status?: string;
  gymId?: string;
  source?: string;
  assignedToId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  showDeleted?: boolean;
  limit?: number;
  offset?: number;
  accessibleGymIds?: string[]; // Gym IDs the requesting user can access
}

export interface LeadListResponse {
  leads: any[];
  total: number;
  hasMore: boolean;
  stats: {
    all: number;
    new: number;
    interested: number;
    qualified: number;
    closed: number;
    inactive: number;
    lost: number;
  };
}

/**
 * Get all leads with filtering and pagination
 */
export async function getAllLeads(filters: LeadFilters): Promise<LeadListResponse> {
  try {
    const {
      search,
      status,
      gymId,
      source,
      assignedToId,
      dateFrom,
      dateTo,
      showDeleted = false,
      limit = 50,
      offset = 0,
      accessibleGymIds
    } = filters;

    // Build where clause
    const where: any = {};

    // Handle soft delete filter
    if (!showDeleted) {
      where.isDeleted = false;
    }

    // Search filter (name or phone)
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Status filter
    if (status && status !== 'all') {
      where.status = status.toUpperCase();
    }

    // Gym filter
    if (gymId) {
      where.gymId = gymId;
    } else if (accessibleGymIds && accessibleGymIds.length > 0) {
      // Filter by accessible gyms if no specific gymId provided (for non-admin users)
      where.gymId = { in: accessibleGymIds };
    }

    // Source filter
    if (source) {
      where.source = source.toUpperCase();
    }

    // Assigned filter
    if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    // Get leads with pagination
    const [leads, total, stats] = await Promise.all([
      prisma.lead.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          // city: true,  // Will be added after migration
          // state: true,  // Will be added after migration
          status: true,
          source: true,
          score: true,
          // tags: true,  // Will be added after migration
          // totalMessages: true,  // Will be added after migration
          // responseRate: true,  // Will be added after migration
          // avgResponseTime: true,  // Will be added after migration
          // lastContactAt: true,  // Will be added after migration
          createdAt: true,
          updatedAt: true,
          gym: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: [
          { createdAt: 'desc' }
        ],
        take: limit,
        skip: offset
      }),
      prisma.lead.count({ where }),
      getLeadStatistics(gymId, showDeleted)
    ]);

    return {
      leads,
      total,
      hasMore: offset + limit < total,
      stats
    };
  } catch (error) {
    logger.error('Error getting all leads:', error);
    throw new Error('Failed to retrieve leads');
  }
}

/**
 * Get lead statistics
 */
export async function getLeadStatistics(gymId?: string, showDeleted = false): Promise<any> {
  try {
    const where: any = { isDeleted: showDeleted ? undefined : false };
    if (gymId) where.gymId = gymId;

    const [
      all,
      newLeads,
      contacted,
      qualified,
      negotiating,
      closed,
      lost
    ] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.count({ where: { ...where, status: 'NEW' } }),
      prisma.lead.count({ where: { ...where, status: 'CONTACTED' } }),
      prisma.lead.count({ where: { ...where, status: 'QUALIFIED' } }),
      prisma.lead.count({ where: { ...where, status: 'NEGOTIATING' } }),
      prisma.lead.count({ where: { ...where, status: 'CLOSED' } }),
      prisma.lead.count({ where: { ...where, status: 'LOST' } })
    ]);

    return {
      all,
      new: newLeads,
      contacted: contacted, // Map CONTACTED to contacted for frontend
      qualified,
      negotiating: negotiating, // Map NEGOTIATING to negotiating for frontend
      closed,
      lost
    };
  } catch (error) {
    logger.error('Error getting lead statistics:', error);
    throw error;
  }
}

/**
 * Get lead by ID
 */
export async function getLeadById(leadId: string): Promise<any> {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        gym: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true
          }
        },
        conversations: {
          where: { isDeleted: false },
          include: {
            messages: {
              where: { isDeleted: false },
              orderBy: { sentAt: 'desc' },
              take: 10,
              select: {
                id: true,
                content: true,
                type: true,
                sender: true,
                sentAt: true,
                deliveredAt: true,
                readAt: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            type: true,
            description: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        followUps: {
          orderBy: { scheduledAt: 'desc' },
          take: 5,
          select: {
            id: true,
            type: true,
            status: true,
            scheduledAt: true,
            completedAt: true,
            notes: true
          }
        }
      }
    });

    if (!lead) {
      throw new Error('Lead not found');
    }

    return lead;
  } catch (error) {
    logger.error('Error getting lead by ID:', error);
    throw error;
  }
}

/**
 * Create a new lead
 */
export async function createLead(leadData: CreateLeadData, createdBy: string): Promise<any> {
  try {
    // Check if lead with phone already exists in this gym
    const existingLead = await prisma.lead.findFirst({
      where: {
        phone: leadData.phone,
        gymId: leadData.gymId,
        isDeleted: false
      }
    });

    if (existingLead) {
      throw new Error('Lead with this phone number already exists in this gym');
    }

    // Create lead
    const lead = await prisma.lead.create({
      data: {
        name: leadData.name,
        phone: leadData.phone,
        email: leadData.email,
        // city: leadData.city,  // Will be enabled after migration
        // state: leadData.state,  // Will be enabled after migration
        address: leadData.address,
        zipCode: leadData.zipCode,
        gymId: leadData.gymId,
        source: leadData.source as any,
        status: (leadData.status?.toUpperCase() as any) || 'NEW',
        assignedToId: leadData.assignedToId,
        notes: leadData.notes,
        // tags: leadData.tags || [],  // Will be enabled after migration
        // lastContactAt: new Date()  // Will be enabled after migration
      },
      include: {
        gym: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        type: 'LEAD_CREATED',
        description: `Lead ${lead.name} was created`,
        userId: createdBy,
        leadId: lead.id,
        metadata: {
          source: lead.source
        }
      }
    });

    logger.info(`Lead created: ${lead.name} (${lead.phone}) by ${createdBy}`);

    return lead;
  } catch (error) {
    logger.error('Error creating lead:', error);
    throw error;
  }
}

/**
 * Update lead
 */
export async function updateLead(leadId: string, leadData: UpdateLeadData, updatedBy: string): Promise<any> {
  try {
    // Check if lead exists
    const existingLead = await prisma.lead.findUnique({
      where: { id: leadId }
    });

    if (!existingLead) {
      throw new Error('Lead not found');
    }

    // If phone is being updated, check for duplicates in the same gym
    if (leadData.phone && leadData.phone !== existingLead.phone) {
      const phoneExists = await prisma.lead.findFirst({
        where: {
          phone: leadData.phone,
          gymId: existingLead.gymId,
          isDeleted: false,
          NOT: { id: leadId }
        }
      });

      if (phoneExists) {
        throw new Error('Phone number already exists in this gym');
      }
    }

    // Update lead
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        ...leadData,
        status: leadData.status ? (leadData.status.toUpperCase() as any) : undefined,
        source: leadData.source ? (leadData.source.toUpperCase() as any) : undefined,
        updatedAt: new Date()
      },
      include: {
        gym: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        type: 'LEAD_UPDATED',
        description: `Lead ${updatedLead.name} was updated`,
        userId: updatedBy,
        leadId: updatedLead.id,
        metadata: leadData as any
      }
    });

    logger.info(`Lead updated: ${updatedLead.name} by ${updatedBy}`);

    return updatedLead;
  } catch (error) {
    logger.error('Error updating lead:', error);
    throw error;
  }
}

/**
 * Delete lead (soft delete)
 */
export async function deleteLead(leadId: string, deletedBy: string): Promise<void> {
  try {
    const result = await softDelete(prisma.lead, leadId, deletedBy);
    
    if (!result) {
      throw new Error(`Lead with id ${leadId} not found or already deleted`);
    }
    
    logger.info(`Lead soft deleted: ${leadId} by ${deletedBy}`);
  } catch (error) {
    logger.error('Error deleting lead:', error);
    throw error;
  }
}

/**
 * Restore soft-deleted lead
 */
export async function restoreLead(leadId: string, restoredBy: string): Promise<any> {
  try {
    const lead = await restore(prisma.lead, leadId);
    logger.info(`Lead restored: ${leadId} by ${restoredBy}`);
    return lead;
  } catch (error) {
    logger.error('Error restoring lead:', error);
    throw error;
  }
}

/**
 * Hard delete lead (permanent removal)
 */
export async function hardDeleteLead(leadId: string, deletedBy: string): Promise<void> {
  try {
    await hardDelete(prisma.lead, leadId);
    logger.info(`Lead hard deleted: ${leadId} by ${deletedBy}`);
  } catch (error) {
    logger.error('Error hard deleting lead:', error);
    throw error;
  }
}

/**
 * Bulk update lead status
 */
export async function bulkUpdateLeadStatus(leadIds: string[], status: string, updatedBy: string): Promise<void> {
  try {
    await prisma.lead.updateMany({
      where: {
        id: { in: leadIds }
      },
      data: {
        status: status.toUpperCase() as any,
        updatedAt: new Date()
      }
    });

    logger.info(`Bulk status update: ${leadIds.length} leads updated to ${status} by ${updatedBy}`);
  } catch (error) {
    logger.error('Error bulk updating lead status:', error);
    throw error;
  }
}

/**
 * Bulk delete leads (soft delete)
 */
export async function bulkDeleteLeads(leadIds: string[], deletedBy: string): Promise<void> {
  try {
    // First, verify which leads exist and aren't already deleted
    const existingLeads = await prisma.lead.findMany({
      where: {
        id: { in: leadIds },
        isDeleted: false // Only get leads that aren't already deleted
      },
      select: {
        id: true
      }
    });

    const existingLeadIds = existingLeads.map(lead => lead.id);
    const notFoundIds = leadIds.filter(id => !existingLeadIds.includes(id));

    if (existingLeadIds.length === 0) {
      throw new Error('No valid leads found to delete. All leads may already be deleted or do not exist.');
    }

    // Only update leads that exist and aren't deleted
    const result = await prisma.lead.updateMany({
      where: {
        id: { in: existingLeadIds },
        isDeleted: false // Double-check to ensure we don't update already deleted leads
      },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy
      }
    });

    // Log warnings for leads that couldn't be deleted
    if (notFoundIds.length > 0) {
      logger.warn(`Bulk delete: ${notFoundIds.length} lead(s) not found or already deleted`, {
        notFoundIds,
        deletedBy
      });
    }

    logger.info(`Bulk delete: ${result.count} of ${leadIds.length} leads soft deleted by ${deletedBy}`);
    
    // Only throw error if NO leads were deleted
    if (result.count === 0) {
      throw new Error(
        `No leads were deleted. All ${leadIds.length} lead(s) may already be deleted or do not exist.`
      );
    }
  } catch (error: any) {
    logger.error('Error bulk deleting leads:', error);
    throw error;
  }
}

/**
 * Update lead engagement stats
 */
export async function updateLeadEngagement(leadId: string, _data: {
  totalMessages?: number;
  responseRate?: number;
  avgResponseTime?: number;
}): Promise<void> {
  try {
    // Will be enabled after migration
    // await prisma.lead.update({
    //   where: { id: leadId },
    //   data: {
    //     ..._data,
    //     lastContactAt: new Date()
    //   }
    // });
    logger.info(`Lead engagement update deferred until migration: ${leadId}`);
  } catch (error) {
    logger.error('Error updating lead engagement:', error);
    throw error;
  }
}

