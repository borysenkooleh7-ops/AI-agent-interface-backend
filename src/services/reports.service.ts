import prisma from '../config/database';
import logger from '../utils/logger';

export interface ReportFilters {
  gymId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  reportType?: string;
  format?: 'PDF' | 'XLSX' | 'CSV' | 'JSON';
  includeLevel?: 'ALL' | 'SUMMARY' | 'DETAILED';
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  reportType: string;
}

/**
 * Get available report templates
 */
export async function getReportTemplates() {
  try {
    const templates: ReportTemplate[] = [
      {
        id: 'monthly-performance',
        name: 'Monthly Performance Report',
        description: 'Complete overview of monthly metrics',
        category: 'Performance',
        reportType: 'performance'
      },
      {
        id: 'leads-pipeline',
        name: 'Leads Pipeline Report',
        description: 'Detailed lead status and conversion data',
        category: 'Leads',
        reportType: 'leads'
      },
      {
        id: 'conversion-funnel',
        name: 'Conversion Funnel Analysis',
        description: 'Stage-by-stage conversion metrics',
        category: 'Analytics',
        reportType: 'conversion'
      },
      {
        id: 'whatsapp-activity',
        name: 'WhatsApp Activity Report',
        description: 'Message volume and response rates',
        category: 'Communication',
        reportType: 'activity'
      }
    ];

    return templates;
  } catch (error) {
    logger.error('Error getting report templates:', error);
    throw error;
  }
}

/**
 * Generate leads report data
 */
export async function generateLeadsReport(filters: ReportFilters) {
  try {
    const { gymId, startDate, endDate } = filters;

    const where: any = { isDeleted: false };
    if (gymId) where.gymId = gymId;
    if (startDate && endDate) {
      where.createdAt = { gte: startDate, lte: endDate };
    }

    const leads = await prisma.lead.findMany({
      where,
      include: {
        gym: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculate summary statistics
    const summary = {
      total: leads.length,
      byStatus: {} as Record<string, number>,
      bySource: {} as Record<string, number>,
      qualified: leads.filter(l => l.status === 'QUALIFIED').length,
      closed: leads.filter(l => l.status === 'CLOSED').length,
      lost: leads.filter(l => l.status === 'LOST').length,
      conversionRate: leads.length > 0 
        ? ((leads.filter(l => l.status === 'CLOSED').length / leads.length) * 100).toFixed(1)
        : '0.0'
    };

    // Group by status
    leads.forEach(lead => {
      summary.byStatus[lead.status] = (summary.byStatus[lead.status] || 0) + 1;
      summary.bySource[lead.source] = (summary.bySource[lead.source] || 0) + 1;
    });

    return {
      leads,
      summary,
      filters,
      generatedAt: new Date()
    };
  } catch (error) {
    logger.error('Error generating leads report:', error);
    throw error;
  }
}

/**
 * Generate performance report data
 */
export async function generatePerformanceReport(filters: ReportFilters) {
  try {
    const { gymId, startDate, endDate } = filters;

    const dateWhere: any = {};
    if (startDate && endDate) {
      dateWhere.gte = startDate;
      dateWhere.lte = endDate;
    }

    // Get leads data
    const totalLeads = await prisma.lead.count({
      where: {
        isDeleted: false,
        ...(gymId && { gymId }),
        ...(startDate && endDate && { createdAt: dateWhere })
      }
    });

    const closedLeads = await prisma.lead.count({
      where: {
        isDeleted: false,
        status: 'CLOSED',
        ...(gymId && { gymId }),
        ...(startDate && endDate && { updatedAt: dateWhere })
      }
    });

    const qualifiedLeads = await prisma.lead.count({
      where: {
        isDeleted: false,
        status: 'QUALIFIED',
        ...(gymId && { gymId })
      }
    });

    // Get conversation data
    const totalConversations = await prisma.conversation.count({
      where: {
        isDeleted: false,
        ...(gymId && { lead: { gymId } }),
        ...(startDate && endDate && { createdAt: dateWhere })
      }
    });

    const activeConversations = await prisma.conversation.count({
      where: {
        isDeleted: false,
        status: 'ACTIVE',
        ...(gymId && { lead: { gymId } })
      }
    });

    // Get message data
    const totalMessages = await prisma.message.count({
      where: {
        ...(gymId && { conversation: { lead: { gymId } } }),
        ...(startDate && endDate && { sentAt: dateWhere })
      }
    });

    // Get follow-up data
    const completedFollowUps = await prisma.followUp.count({
      where: {
        status: 'COMPLETED',
        ...(gymId && { lead: { gymId } }),
        ...(startDate && endDate && { completedAt: dateWhere })
      }
    });

    const pendingFollowUps = await prisma.followUp.count({
      where: {
        status: 'PENDING',
        ...(gymId && { lead: { gymId } })
      }
    });

    return {
      leads: {
        total: totalLeads,
        closed: closedLeads,
        qualified: qualifiedLeads,
        conversionRate: totalLeads > 0 ? ((closedLeads / totalLeads) * 100).toFixed(1) : '0.0'
      },
      conversations: {
        total: totalConversations,
        active: activeConversations
      },
      messages: {
        total: totalMessages,
        avgPerConversation: totalConversations > 0 
          ? (totalMessages / totalConversations).toFixed(1)
          : '0.0'
      },
      followUps: {
        completed: completedFollowUps,
        pending: pendingFollowUps
      },
      generatedAt: new Date(),
      filters
    };
  } catch (error) {
    logger.error('Error generating performance report:', error);
    throw error;
  }
}

/**
 * Generate conversion report data
 */
export async function generateConversionReport(filters: ReportFilters) {
  try {
    const { gymId, startDate, endDate } = filters;

    const dateWhere: any = {};
    if (startDate && endDate) {
      dateWhere.gte = startDate;
      dateWhere.lte = endDate;
    }

    const baseWhere: any = { 
      isDeleted: false,
      ...(gymId && { gymId }),
      ...(startDate && endDate && { createdAt: dateWhere })
    };

    // Get funnel data
    const statuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'NEGOTIATING', 'CLOSED', 'LOST'];
    const funnel = [];

    for (const status of statuses) {
      const count = await prisma.lead.count({
        where: {
          ...baseWhere,
          status: status as any
        }
      });

      funnel.push({ status, count });
    }

    const totalLeads = funnel.reduce((sum, stage) => sum + stage.count, 0);
    const closedLeads = funnel.find(f => f.status === 'CLOSED')?.count || 0;
    const lostLeads = funnel.find(f => f.status === 'LOST')?.count || 0;

    return {
      funnel,
      metrics: {
        total: totalLeads,
        closed: closedLeads,
        lost: lostLeads,
        conversionRate: totalLeads > 0 ? ((closedLeads / totalLeads) * 100).toFixed(1) : '0.0',
        winRate: (closedLeads + lostLeads) > 0 
          ? ((closedLeads / (closedLeads + lostLeads)) * 100).toFixed(1)
          : '0.0'
      },
      generatedAt: new Date(),
      filters
    };
  } catch (error) {
    logger.error('Error generating conversion report:', error);
    throw error;
  }
}

/**
 * Generate activity report data
 */
export async function generateActivityReport(filters: ReportFilters) {
  try {
    const { gymId, userId, startDate, endDate } = filters;

    const where: any = {};
    if (gymId) where.gymId = gymId;
    if (userId) where.userId = userId;
    if (startDate && endDate) {
      where.createdAt = { gte: startDate, lte: endDate };
    }

    const activities = await prisma.activityLog.findMany({
      where,
      include: {
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
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 1000 // Limit to prevent performance issues
    });

    // Group activities by type
    const byType: Record<string, number> = {};
    activities.forEach(activity => {
      byType[activity.type] = (byType[activity.type] || 0) + 1;
    });

    return {
      activities,
      summary: {
        total: activities.length,
        byType
      },
      generatedAt: new Date(),
      filters
    };
  } catch (error) {
    logger.error('Error generating activity report:', error);
    throw error;
  }
}

/**
 * Get recent export history
 */
export async function getExportHistory(_userId: string, limit: number = 10) {
  try {
    // For now, return mock data
    // In a full implementation, this would query an "exports" table
    const mockHistory = [
      {
        id: '1',
        name: 'Monthly_Performance_Report.csv',
        reportType: 'performance',
        format: 'CSV',
        size: '2.4 MB',
        status: 'completed',
        createdAt: new Date(Date.now() - 86400000 * 5)
      },
      {
        id: '2',
        name: 'Leads_Pipeline.xlsx',
        reportType: 'leads',
        format: 'XLSX',
        size: '1.8 MB',
        status: 'completed',
        createdAt: new Date(Date.now() - 86400000 * 10)
      },
      {
        id: '3',
        name: 'Conversion_Analysis.pdf',
        reportType: 'conversion',
        format: 'PDF',
        size: '3.1 MB',
        status: 'completed',
        createdAt: new Date(Date.now() - 86400000 * 15)
      }
    ];

    return mockHistory.slice(0, limit);
  } catch (error) {
    logger.error('Error getting export history:', error);
    throw error;
  }
}

/**
 * Get export statistics
 */
export async function getExportStatistics(_userId: string) {
  try {
    // Mock statistics
    // In a full implementation, this would calculate from exports table
    return {
      reportsThisMonth: 24,
      totalSize: '45.2 MB',
      mostPopular: 'Performance Report',
      lastExport: new Date(Date.now() - 86400000 * 2)
    };
  } catch (error) {
    logger.error('Error getting export statistics:', error);
    throw error;
  }
}

