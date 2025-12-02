import { Request, Response } from 'express';
import * as visitService from '../services/propertyVisit.service';
import * as agencyAccess from '../utils/gymAccess';

/**
 * Obtener todas las visitas
 */
export const getAllVisits = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'No autorizado' });
      return;
    }

    const accessibleAgencyIds = await agencyAccess.getUserAccessibleGymIds(userId, userRole);

    const filters = {
      agencyId: req.query.agencyId as string || (accessibleAgencyIds.length === 1 ? accessibleAgencyIds[0] : undefined),
      propertyId: req.query.propertyId as string,
      leadId: req.query.leadId as string,
      agentId: req.query.agentId as string,
      status: req.query.status as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0
    };

    const result = await visitService.getAllVisits(filters);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Obtener visita por ID
 */
export const getVisitById = async (req: Request, res: Response): Promise<void> => {
  try {
    const visitId = req.params.id;
    const visit = await visitService.getVisitById(visitId);
    res.status(200).json({ success: true, data: visit });
  } catch (error: any) {
    const statusCode = error.message === 'Visita no encontrada' ? 404 : 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

/**
 * Crear visita
 */
export const createVisit = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const { agencyId } = req.body;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'No autorizado' });
      return;
    }

    const hasAccess = await agencyAccess.hasGymAccess(userId, userRole, agencyId);
    if (!hasAccess) {
      res.status(403).json({ success: false, message: 'Acceso denegado a esta agencia' });
      return;
    }

    const visit = await visitService.createVisit(req.body, userId);
    res.status(201).json({ success: true, message: 'Visita programada correctamente', data: visit });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Actualizar visita
 */
export const updateVisit = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const visitId = req.params.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'No autorizado' });
      return;
    }

    const visit = await visitService.updateVisit(visitId, req.body, userId);
    res.status(200).json({ success: true, message: 'Visita actualizada correctamente', data: visit });
  } catch (error: any) {
    const statusCode = error.message === 'Visita no encontrada' ? 404 : 400;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

/**
 * Confirmar visita
 */
export const confirmVisit = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const visitId = req.params.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'No autorizado' });
      return;
    }

    const visit = await visitService.confirmVisit(visitId, userId);
    res.status(200).json({ success: true, message: 'Visita confirmada correctamente', data: visit });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Completar visita
 */
export const completeVisit = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const visitId = req.params.id;
    const { feedback, rating } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, message: 'No autorizado' });
      return;
    }

    const visit = await visitService.completeVisit(visitId, feedback, rating, userId);
    res.status(200).json({ success: true, message: 'Visita completada correctamente', data: visit });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Cancelar visita
 */
export const cancelVisit = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const visitId = req.params.id;
    const { reason } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, message: 'No autorizado' });
      return;
    }

    const visit = await visitService.cancelVisit(visitId, reason, userId);
    res.status(200).json({ success: true, message: 'Visita cancelada correctamente', data: visit });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Marcar no show
 */
export const markNoShow = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const visitId = req.params.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'No autorizado' });
      return;
    }

    const visit = await visitService.markNoShow(visitId, userId);
    res.status(200).json({ success: true, message: 'Visita marcada como no show', data: visit });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Reprogramar visita
 */
export const rescheduleVisit = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const visitId = req.params.id;
    const { newDate } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, message: 'No autorizado' });
      return;
    }

    if (!newDate) {
      res.status(400).json({ success: false, message: 'Se requiere newDate' });
      return;
    }

    const visit = await visitService.rescheduleVisit(visitId, new Date(newDate), userId);
    res.status(200).json({ success: true, message: 'Visita reprogramada correctamente', data: visit });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Enviar recordatorio
 */
export const sendReminder = async (req: Request, res: Response): Promise<void> => {
  try {
    const visitId = req.params.id;
    const result = await visitService.sendVisitReminder(visitId);
    res.status(200).json({ success: true, message: 'Recordatorio enviado', data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Obtener visitas de hoy
 */
export const getTodayVisits = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const agencyId = req.params.agencyId || req.query.agencyId as string;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'No autorizado' });
      return;
    }

    if (!agencyId) {
      res.status(400).json({ success: false, message: 'Se requiere agencyId' });
      return;
    }

    const hasAccess = await agencyAccess.hasGymAccess(userId, userRole, agencyId);
    if (!hasAccess) {
      res.status(403).json({ success: false, message: 'Acceso denegado' });
      return;
    }

    const visits = await visitService.getTodayVisits(agencyId);
    res.status(200).json({ success: true, data: visits });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Obtener próximas visitas
 */
export const getUpcomingVisits = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const agencyId = req.params.agencyId || req.query.agencyId as string;
    const days = parseInt(req.query.days as string) || 7;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'No autorizado' });
      return;
    }

    if (!agencyId) {
      res.status(400).json({ success: false, message: 'Se requiere agencyId' });
      return;
    }

    const hasAccess = await agencyAccess.hasGymAccess(userId, userRole, agencyId);
    if (!hasAccess) {
      res.status(403).json({ success: false, message: 'Acceso denegado' });
      return;
    }

    const visits = await visitService.getUpcomingVisits(agencyId, days);
    res.status(200).json({ success: true, data: visits });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Obtener estadísticas de visitas
 */
export const getVisitStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const agencyId = req.params.agencyId || req.query.agencyId as string;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'No autorizado' });
      return;
    }

    if (!agencyId) {
      res.status(400).json({ success: false, message: 'Se requiere agencyId' });
      return;
    }

    const hasAccess = await agencyAccess.hasGymAccess(userId, userRole, agencyId);
    if (!hasAccess) {
      res.status(403).json({ success: false, message: 'Acceso denegado' });
      return;
    }

    const statistics = await visitService.getVisitStatistics(agencyId, startDate, endDate);
    res.status(200).json({ success: true, data: statistics });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Obtener disponibilidad de agente
 */
export const getAgentAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const agentId = req.params.agentId;
    const date = req.query.date ? new Date(req.query.date as string) : new Date();

    const availability = await visitService.getAgentAvailability(agentId, date);
    res.status(200).json({ success: true, data: availability });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
