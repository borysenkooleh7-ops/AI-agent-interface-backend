import prisma from '../config/database';
import logger from '../utils/logger';
import { ActivityType } from '@prisma/client';

export interface ActivityLogFilters {
  gymId?: string;
  userId?: string;
  leadId?: string;
  type?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface ActivityLog {
  id: string;
  type: string;
  description: string;
  userId?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  leadId?: string;
  lead?: {
    id: string;
    name: string;
    phone: string;
    email?: string;
  };
  gymId?: string;
  gym?: {
    id: string;
    name: string;
  };
  metadata?: any;
  createdAt: Date;
}

/**
 * Get activity logs with filtering and pagination
 */
export async function getActivityLogs(filters: ActivityLogFilters = {}) {
  try {
    const {
      gymId,
      userId,
      leadId,
      type,
      search,
      startDate,
      endDate,
      limit = 50,
      offset = 0
    } = filters;

    // Build where clause
    const where: any = {};

    if (gymId) where.gymId = gymId;
    if (userId) where.userId = userId;
    if (leadId) where.leadId = leadId;
    if (type) where.type = type;

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    // Search filter (search in description)
    if (search) {
      where.description = {
        contains: search,
        mode: 'insensitive'
      };
    }

    // Get total count for pagination
    const total = await prisma.activityLog.count({ where });

    // Get activity logs with relations
    const activities = await prisma.activityLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        },
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset
    });

    // Get statistics
    const stats = await getActivityLogStats(filters);

    return {
      activities,
      total,
      hasMore: offset + limit < total,
      stats
    };
  } catch (error) {
    logger.error('Error getting activity logs:', error);
    throw error;
  }
}

/**
 * Get activity log statistics
 */
export async function getActivityLogStats(filters: ActivityLogFilters = {}) {
  try {
    const { gymId, startDate, endDate } = filters;

    // Build base where clause
    const baseWhere: any = {};
    if (gymId) baseWhere.gymId = gymId;
    if (startDate || endDate) {
      baseWhere.createdAt = {};
      if (startDate) baseWhere.createdAt.gte = startDate;
      if (endDate) baseWhere.createdAt.lte = endDate;
    }

    // Get counts by type
    const [totalActivities, leadActivities, followUpActivities, messageActivities, userActivities] = await Promise.all([
      prisma.activityLog.count({ where: baseWhere }),
      prisma.activityLog.count({ 
        where: { 
          ...baseWhere, 
          type: { in: ['LEAD_CREATED', 'LEAD_UPDATED', 'LEAD_STATUS_CHANGED'] }
        }
      }),
      prisma.activityLog.count({ 
        where: { 
          ...baseWhere, 
          type: { in: ['FOLLOW_UP_CREATED', 'FOLLOW_UP_COMPLETED'] }
        }
      }),
      prisma.activityLog.count({ 
        where: { 
          ...baseWhere, 
          type: 'MESSAGE_SENT'
        }
      }),
      prisma.activityLog.count({ 
        where: { 
          ...baseWhere, 
          type: 'USER_LOGIN'
        }
      })
    ]);

    return {
      totalActivities,
      leadActivities,
      followUpActivities,
      messageActivities,
      userActivities
    };
  } catch (error) {
    logger.error('Error getting activity log stats:', error);
    throw error;
  }
}

/**
 * Get activity log by ID
 */
export async function getActivityLogById(id: string) {
  try {
    const activity = await prisma.activityLog.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        },
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true
          }
        }
      }
    });

    if (!activity) {
      throw new Error('Activity log not found');
    }

    return activity;
  } catch (error) {
    logger.error('Error getting activity log by ID:', error);
    throw error;
  }
}

/**
 * Create activity log entry
 */
export async function createActivityLog(data: {
  type: ActivityType;
  description: string;
  userId?: string;
  leadId?: string;
  gymId?: string;
  metadata?: any;
}) {
  try {
    const activity = await prisma.activityLog.create({
      data: {
        type: data.type,
        description: data.description,
        userId: data.userId,
        leadId: data.leadId,
        gymId: data.gymId,
        metadata: data.metadata || {}
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        },
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true
          }
        }
      }
    });

    return activity;
  } catch (error) {
    logger.error('Error creating activity log:', error);
    throw error;
  }
}

/**
 * Export activity logs to CSV
 */
export async function exportActivityLogs(filters: ActivityLogFilters = {}) {
  try {
    const { activities } = await getActivityLogs({
      ...filters,
      limit: 10000 // Export all
    });

    // Convert to CSV format
    const headers = [
      'ID',
      'Type',
      'Description',
      'User',
      'Lead',
      'Gym',
      'Created At',
      'Metadata'
    ];

    const csvRows = [
      headers.join(','),
      ...activities.map(activity => [
        activity.id,
        activity.type,
        `"${activity.description.replace(/"/g, '""')}"`,
        activity.user?.name || '',
        activity.lead?.name || '',
        '', // Gym name not available in current query
        activity.createdAt.toISOString(),
        activity.metadata ? `"${JSON.stringify(activity.metadata).replace(/"/g, '""')}"` : ''
      ].join(','))
    ];

    return csvRows.join('\n');
  } catch (error) {
    logger.error('Error exporting activity logs:', error);
    throw error;
  }
}
