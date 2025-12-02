import prisma from '../config/database';
import logger from '../utils/logger';

export interface CreateFollowUpData {
  leadId: string;
  type: 'CALL' | 'WHATSAPP' | 'EMAIL' | 'VISIT';
  scheduledAt: Date;
  notes?: string;
}

export interface UpdateFollowUpData {
  type?: 'CALL' | 'WHATSAPP' | 'EMAIL' | 'VISIT';
  scheduledAt?: Date;
  notes?: string;
  status?: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE';
}

export interface FollowUpFilters {
  leadId?: string;
  status?: string;
  type?: string;
  assignedToId?: string;
  gymId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  showCompleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface FollowUpListResponse {
  followUps: any[];
  total: number;
  hasMore: boolean;
  stats: {
    pending: number;
    completed: number;
    overdue: number;
    today: number;
  };
}

/**
 * Get all follow-ups with filtering and pagination
 */
export async function getAllFollowUps(filters: FollowUpFilters): Promise<FollowUpListResponse> {
  try {
    const {
      leadId,
      status,
      type,
      assignedToId,
      gymId,
      dateFrom,
      dateTo,
      showCompleted = true,
      limit = 50,
      offset = 0
    } = filters;

    // Build where clause
    const where: any = {};

    // Lead filter
    if (leadId) {
      where.leadId = leadId;
    }

    // Status filter
    if (status && status !== 'all') {
      where.status = status.toUpperCase();
    }

    // Type filter
    if (type && type !== 'all') {
      where.type = type.toUpperCase();
    }

    // Date range filter
    if (dateFrom || dateTo) {
      where.scheduledAt = {};
      if (dateFrom) where.scheduledAt.gte = dateFrom;
      if (dateTo) where.scheduledAt.lte = dateTo;
    }

    // Assigned user filter
    if (assignedToId) {
      where.lead = {
        assignedToId: assignedToId
      };
    }

    // Gym filter
    if (gymId) {
      where.lead = {
        ...where.lead,
        gymId: gymId
      };
    }

    // Show completed filter
    if (!showCompleted) {
      where.status = {
        not: 'COMPLETED'
      };
    }

    // Get follow-ups with pagination
    const [followUps, total, stats] = await Promise.all([
      prisma.followUp.findMany({
        where,
        include: {
          lead: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              status: true,
              assignedToId: true,
              gym: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        },
        orderBy: [
          { scheduledAt: 'asc' }
        ],
        take: limit,
        skip: offset
      }),
      prisma.followUp.count({ where }),
      getFollowUpStatistics(filters)
    ]);

    return {
      followUps,
      total,
      hasMore: offset + limit < total,
      stats
    };
  } catch (error) {
    logger.error('Error getting all follow-ups:', error);
    throw new Error('Failed to retrieve follow-ups');
  }
}

/**
 * Get follow-up statistics
 */
export async function getFollowUpStatistics(filters: FollowUpFilters): Promise<any> {
  try {
    const { assignedToId, gymId, dateFrom, dateTo } = filters;

    // Build base where clause
    const baseWhere: any = {};
    
    if (assignedToId) {
      baseWhere.lead = { assignedToId };
    }
    
    if (gymId) {
      baseWhere.lead = {
        ...baseWhere.lead,
        gymId
      };
    }

    // Date range for today's follow-ups
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      pending,
      completed,
      overdue,
      todayCount
    ] = await Promise.all([
      prisma.followUp.count({
        where: {
          ...baseWhere,
          status: 'PENDING',
          ...(dateFrom && { scheduledAt: { gte: dateFrom } }),
          ...(dateTo && { scheduledAt: { lte: dateTo } })
        }
      }),
      prisma.followUp.count({
        where: {
          ...baseWhere,
          status: 'COMPLETED',
          ...(dateFrom && { scheduledAt: { gte: dateFrom } }),
          ...(dateTo && { scheduledAt: { lte: dateTo } })
        }
      }),
      prisma.followUp.count({
        where: {
          ...baseWhere,
          status: 'OVERDUE',
          ...(dateFrom && { scheduledAt: { gte: dateFrom } }),
          ...(dateTo && { scheduledAt: { lte: dateTo } })
        }
      }),
      prisma.followUp.count({
        where: {
          ...baseWhere,
          scheduledAt: {
            gte: today,
            lt: tomorrow
          },
          status: {
            in: ['PENDING', 'OVERDUE']
          }
        }
      })
    ]);

    return {
      pending,
      completed,
      overdue,
      today: todayCount
    };
  } catch (error) {
    logger.error('Error getting follow-up statistics:', error);
    throw error;
  }
}

/**
 * Get follow-up by ID
 */
export async function getFollowUpById(followUpId: string): Promise<any> {
  try {
    const followUp = await prisma.followUp.findUnique({
      where: { id: followUpId },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            status: true,
            assignedToId: true,
            gym: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!followUp) {
      throw new Error('Follow-up not found');
    }

    return followUp;
  } catch (error) {
    logger.error('Error getting follow-up by ID:', error);
    throw error;
  }
}

/**
 * Create a new follow-up
 */
export async function createFollowUp(followUpData: CreateFollowUpData, createdBy: string): Promise<any> {
  try {
    // Check if lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: followUpData.leadId }
    });

    if (!lead) {
      throw new Error('Lead not found');
    }

    // Create follow-up
    const followUp = await prisma.followUp.create({
      data: {
        leadId: followUpData.leadId,
        type: followUpData.type,
        scheduledAt: followUpData.scheduledAt,
        notes: followUpData.notes,
        status: 'PENDING'
      },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            status: true,
            assignedToId: true,
            gym: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        type: 'FOLLOW_UP_CREATED',
        description: `Follow-up scheduled for ${lead.name}`,
        userId: createdBy,
        leadId: followUpData.leadId,
        metadata: {
          followUpId: followUp.id,
          type: followUpData.type,
          scheduledAt: followUpData.scheduledAt
        }
      }
    });

    logger.info(`Follow-up created: ${followUp.id} for lead ${lead.name} by ${createdBy}`);

    return followUp;
  } catch (error) {
    logger.error('Error creating follow-up:', error);
    throw error;
  }
}

/**
 * Update follow-up
 */
export async function updateFollowUp(followUpId: string, followUpData: UpdateFollowUpData, updatedBy: string): Promise<any> {
  try {
    // Check if follow-up exists
    const existingFollowUp = await prisma.followUp.findUnique({
      where: { id: followUpId }
    });

    if (!existingFollowUp) {
      throw new Error('Follow-up not found');
    }

    // Update follow-up
    const updatedFollowUp = await prisma.followUp.update({
      where: { id: followUpId },
      data: {
        ...followUpData,
        updatedAt: new Date()
      },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            status: true,
            assignedToId: true,
            gym: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        type: 'FOLLOW_UP_CREATED',
        description: `Follow-up updated for ${updatedFollowUp.lead.name}`,
        userId: updatedBy,
        leadId: updatedFollowUp.leadId,
        metadata: followUpData as any
      }
    });

    logger.info(`Follow-up updated: ${followUpId} by ${updatedBy}`);

    return updatedFollowUp;
  } catch (error) {
    logger.error('Error updating follow-up:', error);
    throw error;
  }
}

/**
 * Complete follow-up
 */
export async function completeFollowUp(followUpId: string, completedBy: string, notes?: string): Promise<any> {
  try {
    const followUp = await prisma.followUp.findUnique({
      where: { id: followUpId },
      include: {
        lead: {
          select: {
            name: true
          }
        }
      }
    });

    if (!followUp) {
      throw new Error('Follow-up not found');
    }

    if (followUp.status === 'COMPLETED') {
      throw new Error('Follow-up is already completed');
    }

    // Update follow-up status
    const updatedFollowUp = await prisma.followUp.update({
      where: { id: followUpId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        notes: notes || followUp.notes,
        updatedAt: new Date()
      },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            status: true,
            assignedToId: true,
            gym: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        type: 'FOLLOW_UP_COMPLETED',
        description: `Follow-up completed for ${followUp.lead.name}`,
        userId: completedBy,
        leadId: followUp.leadId,
        metadata: {
          followUpId: followUpId,
          completedAt: new Date(),
          notes: notes
        }
      }
    });

    logger.info(`Follow-up completed: ${followUpId} by ${completedBy}`);

    return updatedFollowUp;
  } catch (error) {
    logger.error('Error completing follow-up:', error);
    throw error;
  }
}

/**
 * Cancel follow-up
 */
export async function cancelFollowUp(followUpId: string, cancelledBy: string, reason?: string): Promise<any> {
  try {
    const followUp = await prisma.followUp.findUnique({
      where: { id: followUpId },
      include: {
        lead: {
          select: {
            name: true
          }
        }
      }
    });

    if (!followUp) {
      throw new Error('Follow-up not found');
    }

    if (followUp.status === 'CANCELLED') {
      throw new Error('Follow-up is already cancelled');
    }

    // Update follow-up status
    const updatedFollowUp = await prisma.followUp.update({
      where: { id: followUpId },
      data: {
        status: 'CANCELLED',
        notes: reason || followUp.notes,
        updatedAt: new Date()
      },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            status: true,
            assignedToId: true,
            gym: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        type: 'FOLLOW_UP_CREATED',
        description: `Follow-up cancelled for ${followUp.lead.name}`,
        userId: cancelledBy,
        leadId: followUp.leadId,
        metadata: {
          followUpId: followUpId,
          reason: reason
        }
      }
    });

    logger.info(`Follow-up cancelled: ${followUpId} by ${cancelledBy}`);

    return updatedFollowUp;
  } catch (error) {
    logger.error('Error cancelling follow-up:', error);
    throw error;
  }
}

/**
 * Delete follow-up
 */
export async function deleteFollowUp(followUpId: string, deletedBy: string): Promise<void> {
  try {
    const followUp = await prisma.followUp.findUnique({
      where: { id: followUpId }
    });

    if (!followUp) {
      throw new Error('Follow-up not found');
    }

    await prisma.followUp.delete({
      where: { id: followUpId }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        type: 'FOLLOW_UP_CREATED',
        description: `Follow-up deleted`,
        userId: deletedBy,
        leadId: followUp.leadId,
        metadata: {
          followUpId: followUpId
        }
      }
    });

    logger.info(`Follow-up deleted: ${followUpId} by ${deletedBy}`);
  } catch (error) {
    logger.error('Error deleting follow-up:', error);
    throw error;
  }
}

/**
 * Mark overdue follow-ups
 */
export async function markOverdueFollowUps(): Promise<void> {
  try {
    const now = new Date();
    
    await prisma.followUp.updateMany({
      where: {
        status: 'PENDING',
        scheduledAt: {
          lt: now
        }
      },
      data: {
        status: 'OVERDUE'
      }
    });

    logger.info('Overdue follow-ups marked');
  } catch (error) {
    logger.error('Error marking overdue follow-ups:', error);
    throw error;
  }
}
