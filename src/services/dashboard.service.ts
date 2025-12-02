import prisma from '../config/database';
import logger from '../utils/logger';

export interface DashboardFilters {
  userId?: string;
  gymId?: string;
  startDate?: Date;
  endDate?: Date;
  accessibleGymIds?: string[]; // Gym IDs the requesting user can access
}

/**
 * Get dashboard KPIs (Key Performance Indicators)
 */
export async function getDashboardKPIs(filters: DashboardFilters = {}) {
  try {
    const { gymId, startDate, endDate } = filters;

    // Calculate date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Build where clause for current period
    const currentWhere: any = { isDeleted: false };
    if (gymId) currentWhere.gymId = gymId;
    if (startDate && endDate) {
      currentWhere.createdAt = { gte: startDate, lte: endDate };
    } else {
      currentWhere.createdAt = { gte: startOfMonth };
    }

    // Build where clause for last period (for comparison)
    const lastPeriodWhere: any = { isDeleted: false };
    if (gymId) lastPeriodWhere.gymId = gymId;
    lastPeriodWhere.createdAt = { gte: startOfLastMonth, lte: endOfLastMonth };

    // Get total leads (all time)
    const totalLeads = await prisma.lead.count({
      where: {
        isDeleted: false,
        ...(gymId && { gymId })
      }
    });

    // Get leads this period
    const leadsThisPeriod = await prisma.lead.count({
      where: currentWhere
    });

    // Get leads last period
    const leadsLastPeriod = await prisma.lead.count({
      where: lastPeriodWhere
    });

    // Calculate lead trend
    const leadTrend = leadsLastPeriod > 0 
      ? Math.round(((leadsThisPeriod - leadsLastPeriod) / leadsLastPeriod) * 100)
      : 100;

    // Get qualified leads
    const qualifiedLeads = await prisma.lead.count({
      where: {
        isDeleted: false,
        status: 'QUALIFIED',
        ...(gymId && { gymId })
      }
    });

    // Get qualified leads this period
    const qualifiedThisPeriod = await prisma.lead.count({
      where: {
        ...currentWhere,
        status: 'QUALIFIED'
      }
    });

    // Get qualified leads last period
    const qualifiedLastPeriod = await prisma.lead.count({
      where: {
        ...lastPeriodWhere,
        status: 'QUALIFIED'
      }
    });

    // Calculate qualified trend
    const qualifiedTrend = qualifiedLastPeriod > 0
      ? Math.round(((qualifiedThisPeriod - qualifiedLastPeriod) / qualifiedLastPeriod) * 100)
      : 100;

    // Get closed deals this month
    const closedThisMonth = await prisma.lead.count({
      where: {
        isDeleted: false,
        status: 'CLOSED',
        updatedAt: { gte: startOfMonth },
        ...(gymId && { gymId })
      }
    });

    // Get closed deals last month
    const closedLastMonth = await prisma.lead.count({
      where: {
        isDeleted: false,
        status: 'CLOSED',
        updatedAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        ...(gymId && { gymId })
      }
    });

    // Calculate closed trend
    const closedTrend = closedLastMonth > 0
      ? Math.round(((closedThisMonth - closedLastMonth) / closedLastMonth) * 100)
      : 100;

    // Calculate conversion rate
    const totalLeadsForRate = await prisma.lead.count({
      where: {
        isDeleted: false,
        createdAt: { gte: startOfMonth },
        ...(gymId && { gymId })
      }
    });

    const conversionRate = totalLeadsForRate > 0
      ? ((closedThisMonth / totalLeadsForRate) * 100).toFixed(1)
      : '0.0';

    // Calculate last month conversion rate
    const totalLeadsLastMonth = await prisma.lead.count({
      where: {
        isDeleted: false,
        createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        ...(gymId && { gymId })
      }
    });

    const conversionRateLastMonth = totalLeadsLastMonth > 0
      ? ((closedLastMonth / totalLeadsLastMonth) * 100)
      : 0;

    const conversionTrend = conversionRateLastMonth > 0
      ? Math.round(((parseFloat(conversionRate) - conversionRateLastMonth) / conversionRateLastMonth) * 100)
      : 0;

    return {
      totalLeads: {
        value: totalLeads,
        trend: {
          value: Math.abs(leadTrend),
          isPositive: leadTrend >= 0
        }
      },
      qualifiedLeads: {
        value: qualifiedLeads,
        trend: {
          value: Math.abs(qualifiedTrend),
          isPositive: qualifiedTrend >= 0
        }
      },
      closedThisMonth: {
        value: closedThisMonth,
        trend: {
          value: Math.abs(closedTrend),
          isPositive: closedTrend >= 0
        }
      },
      conversionRate: {
        value: `${conversionRate}%`,
        trend: {
          value: Math.abs(conversionTrend),
          isPositive: conversionTrend >= 0
        }
      }
    };
  } catch (error) {
    logger.error('Error getting dashboard KPIs:', error);
    throw error;
  }
}

/**
 * Get recent activities
 */
export async function getRecentActivities(filters: DashboardFilters = {}) {
  try {
    const { userId, gymId } = filters;

    const where: any = {};
    
    if (userId) {
      where.userId = userId;
    }

    if (gymId) {
      where.OR = [
        { gymId },
        { lead: { gymId, isDeleted: false } }
        // Note: member relation removed as it may not exist in all databases
        // { member: { gymId, isDeleted: false } }
      ];
    }

    // Only include member relation if memberId column exists (for backward compatibility)
    const includeRelations: any = {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      lead: {
        select: {
          id: true,
          name: true
        }
      }
    };

    const activities = await prisma.activityLog.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      take: 10,
      include: includeRelations
    });

    return activities;
  } catch (error) {
    logger.error('Error getting recent activities:', error);
    throw error;
  }
}

/**
 * Get quick stats
 */
export async function getQuickStats(filters: DashboardFilters = {}) {
  try {
    const { gymId } = filters;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Active conversations count
    const activeConversations = await prisma.conversation.count({
      where: {
        isDeleted: false,
        status: 'ACTIVE',
        ...(gymId && { lead: { gymId, isDeleted: false } })
      }
    });

    // Conversations awaiting response
    const awaitingResponse = await prisma.conversation.count({
      where: {
        isDeleted: false,
        status: 'ACTIVE',
        lastMessage: { lt: new Date(Date.now() - 3600000) }, // No response in last hour
        ...(gymId && { lead: { gymId, isDeleted: false } })
      }
    });

    // New leads today
    const newLeadsToday = await prisma.lead.count({
      where: {
        isDeleted: false,
        createdAt: { gte: today },
        ...(gymId && { gymId })
      }
    });

    // New leads yesterday
    const newLeadsYesterday = await prisma.lead.count({
      where: {
        isDeleted: false,
        createdAt: { gte: yesterday, lt: today },
        ...(gymId && { gymId })
      }
    });

    const newLeadsDiff = newLeadsToday - newLeadsYesterday;

    // Average response time (mock for now - would need message timestamps)
    const responseTime = '2.3m'; // TODO: Calculate from actual message data

    return {
      activeConversations: {
        value: activeConversations,
        detail: `${awaitingResponse} awaiting response`
      },
      newLeadsToday: {
        value: newLeadsToday,
        detail: `${newLeadsDiff >= 0 ? '+' : ''}${newLeadsDiff} from yesterday`
      },
      responseTime: {
        value: responseTime,
        detail: 'Average response time'
      }
    };
  } catch (error) {
    logger.error('Error getting quick stats:', error);
    throw error;
  }
}

/**
 * Get leads over time data for chart
 */
export async function getLeadsOverTime(filters: DashboardFilters = {}) {
  try {
    const { gymId } = filters;
    const days = 30;
    const data = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const count = await prisma.lead.count({
        where: {
          isDeleted: false,
          createdAt: {
            gte: date,
            lt: nextDate
          },
          ...(gymId && { gymId })
        }
      });

      data.push({
        date: date.toISOString().split('T')[0],
        count
      });
    }

    return data;
  } catch (error) {
    logger.error('Error getting leads over time:', error);
    throw error;
  }
}

/**
 * Get all dashboard data in one call
 */
export async function getDashboardData(filters: DashboardFilters = {}) {
  try {
    const [kpis, activities, quickStats, leadsOverTime] = await Promise.all([
      getDashboardKPIs(filters),
      getRecentActivities(filters),
      getQuickStats(filters),
      getLeadsOverTime(filters)
    ]);

    return {
      kpis,
      activities,
      quickStats,
      leadsOverTime
    };
  } catch (error) {
    logger.error('Error getting dashboard data:', error);
    throw error;
  }
}

