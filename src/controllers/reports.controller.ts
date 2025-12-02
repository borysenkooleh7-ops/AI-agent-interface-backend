import { Request, Response } from 'express';
import * as reportsService from '../services/reports.service';
import logger from '../utils/logger';

/**
 * Get report templates
 */
export async function getReportTemplates(_req: Request, res: Response): Promise<void> {
  try {
    const templates = await reportsService.getReportTemplates();

    res.json({
      success: true,
      data: templates
    });
  } catch (error: any) {
    logger.error('Error in getReportTemplates controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve report templates'
    });
  }
}

/**
 * Generate leads report
 */
export async function generateLeadsReport(req: Request, res: Response): Promise<void> {
  try {
    const { gymId, startDate, endDate, format, includeLevel } = req.query;

    const filters: any = {};
    
    if (gymId) filters.gymId = gymId as string;
    if (startDate && endDate) {
      filters.startDate = new Date(startDate as string);
      filters.endDate = new Date(endDate as string);
    }
    if (format) filters.format = format as string;
    if (includeLevel) filters.includeLevel = includeLevel as string;

    const reportData = await reportsService.generateLeadsReport(filters);

    // Convert to CSV format
    let csvContent = 'DuxFit Leads Report\n';
    csvContent += `Generated: ${reportData.generatedAt.toLocaleString()}\n\n`;
    csvContent += 'SUMMARY\n';
    csvContent += `Total Leads: ${reportData.summary.total}\n`;
    csvContent += `Qualified: ${reportData.summary.qualified}\n`;
    csvContent += `Closed: ${reportData.summary.closed}\n`;
    csvContent += `Lost: ${reportData.summary.lost}\n`;
    csvContent += `Conversion Rate: ${reportData.summary.conversionRate}%\n\n`;
    
    csvContent += 'LEADS DATA\n';
    csvContent += 'Name,Email,Phone,Status,Source,Score,Gym,Created At\n';
    reportData.leads.forEach(lead => {
      csvContent += `"${lead.name}","${lead.email || ''}","${lead.phone}","${lead.status}","${lead.source}",${lead.score},"${lead.gym.name}","${lead.createdAt.toISOString()}"\n`;
    });

    res.json({
      success: true,
      data: {
        content: csvContent,
        summary: reportData.summary,
        totalRecords: reportData.leads.length
      },
      message: 'Leads report generated successfully'
    });
  } catch (error: any) {
    logger.error('Error in generateLeadsReport controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate leads report'
    });
  }
}

/**
 * Generate performance report
 */
export async function generatePerformanceReport(req: Request, res: Response): Promise<void> {
  try {
    const { gymId, startDate, endDate } = req.query;

    const filters: any = {};
    
    if (gymId) filters.gymId = gymId as string;
    if (startDate && endDate) {
      filters.startDate = new Date(startDate as string);
      filters.endDate = new Date(endDate as string);
    }

    const reportData = await reportsService.generatePerformanceReport(filters);

    // Convert to CSV format
    let csvContent = 'DuxFit Performance Report\n';
    csvContent += `Generated: ${reportData.generatedAt.toLocaleString()}\n\n`;
    csvContent += 'LEADS METRICS\n';
    csvContent += `Total Leads: ${reportData.leads.total}\n`;
    csvContent += `Closed: ${reportData.leads.closed}\n`;
    csvContent += `Qualified: ${reportData.leads.qualified}\n`;
    csvContent += `Conversion Rate: ${reportData.leads.conversionRate}%\n\n`;
    csvContent += 'CONVERSATION METRICS\n';
    csvContent += `Total Conversations: ${reportData.conversations.total}\n`;
    csvContent += `Active: ${reportData.conversations.active}\n\n`;
    csvContent += 'MESSAGE METRICS\n';
    csvContent += `Total Messages: ${reportData.messages.total}\n`;
    csvContent += `Avg per Conversation: ${reportData.messages.avgPerConversation}\n\n`;
    csvContent += 'FOLLOW-UP METRICS\n';
    csvContent += `Completed: ${reportData.followUps.completed}\n`;
    csvContent += `Pending: ${reportData.followUps.pending}\n`;

    res.json({
      success: true,
      data: {
        content: csvContent,
        metrics: reportData
      },
      message: 'Performance report generated successfully'
    });
  } catch (error: any) {
    logger.error('Error in generatePerformanceReport controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate performance report'
    });
  }
}

/**
 * Generate conversion report
 */
export async function generateConversionReport(req: Request, res: Response): Promise<void> {
  try {
    const { gymId, startDate, endDate } = req.query;

    const filters: any = {};
    
    if (gymId) filters.gymId = gymId as string;
    if (startDate && endDate) {
      filters.startDate = new Date(startDate as string);
      filters.endDate = new Date(endDate as string);
    }

    const reportData = await reportsService.generateConversionReport(filters);

    // Convert to CSV format
    let csvContent = 'DuxFit Conversion Report\n';
    csvContent += `Generated: ${reportData.generatedAt.toLocaleString()}\n\n`;
    csvContent += 'CONVERSION METRICS\n';
    csvContent += `Total Leads: ${reportData.metrics.total}\n`;
    csvContent += `Closed: ${reportData.metrics.closed}\n`;
    csvContent += `Lost: ${reportData.metrics.lost}\n`;
    csvContent += `Conversion Rate: ${reportData.metrics.conversionRate}%\n`;
    csvContent += `Win Rate: ${reportData.metrics.winRate}%\n\n`;
    csvContent += 'FUNNEL BREAKDOWN\n';
    csvContent += 'Status,Count\n';
    reportData.funnel.forEach(stage => {
      csvContent += `${stage.status},${stage.count}\n`;
    });

    res.json({
      success: true,
      data: {
        content: csvContent,
        metrics: reportData.metrics,
        funnel: reportData.funnel
      },
      message: 'Conversion report generated successfully'
    });
  } catch (error: any) {
    logger.error('Error in generateConversionReport controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate conversion report'
    });
  }
}

/**
 * Generate activity report
 */
export async function generateActivityReport(req: Request, res: Response): Promise<void> {
  try {
    const { gymId, startDate, endDate } = req.query;

    const filters: any = {};
    
    if (gymId) filters.gymId = gymId as string;
    if (startDate && endDate) {
      filters.startDate = new Date(startDate as string);
      filters.endDate = new Date(endDate as string);
    }

    const reportData = await reportsService.generateActivityReport(filters);

    // Convert to CSV format
    let csvContent = 'DuxFit Activity Report\n';
    csvContent += `Generated: ${reportData.generatedAt.toLocaleString()}\n\n`;
    csvContent += 'SUMMARY\n';
    csvContent += `Total Activities: ${reportData.summary.total}\n\n`;
    csvContent += 'BY TYPE\n';
    Object.entries(reportData.summary.byType).forEach(([type, count]) => {
      csvContent += `${type}: ${count}\n`;
    });
    csvContent += '\nACTIVITIES\n';
    csvContent += 'Type,Description,User,Lead,Created At\n';
    reportData.activities.forEach(activity => {
      csvContent += `"${activity.type}","${activity.description}","${activity.user?.name || 'System'}","${activity.lead?.name || 'N/A'}","${activity.createdAt.toISOString()}"\n`;
    });

    res.json({
      success: true,
      data: {
        content: csvContent,
        summary: reportData.summary,
        totalRecords: reportData.activities.length
      },
      message: 'Activity report generated successfully'
    });
  } catch (error: any) {
    logger.error('Error in generateActivityReport controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate activity report'
    });
  }
}

/**
 * Get export history
 */
export async function getExportHistory(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const { limit } = req.query;

    const history = await reportsService.getExportHistory(
      userId,
      limit ? parseInt(limit as string) : 10
    );

    res.json({
      success: true,
      data: history
    });
  } catch (error: any) {
    logger.error('Error in getExportHistory controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve export history'
    });
  }
}

/**
 * Get export statistics
 */
export async function getExportStatistics(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.userId;

    const statistics = await reportsService.getExportStatistics(userId);

    res.json({
      success: true,
      data: statistics
    });
  } catch (error: any) {
    logger.error('Error in getExportStatistics controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve export statistics'
    });
  }
}

