import { Request, Response } from 'express';
import * as voiceflowService from '../services/voiceflow.service';
import * as agencyAccess from '../utils/gymAccess';

/**
 * Webhook principal de Voiceflow
 * Este endpoint es llamado por Voiceflow para cada interacción
 */
export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId, agencyId, phone, request } = req.body;

    if (!sessionId || !agencyId) {
      res.status(400).json({
        success: false,
        message: 'Se requiere sessionId y agencyId'
      });
      return;
    }

    const result = await voiceflowService.handleVoiceSession({
      sessionId,
      agencyId,
      phone,
      request
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Error en webhook de Voiceflow:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Iniciar nueva sesión de voz
 */
export const startSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { agencyId, phone } = req.body;

    if (!agencyId) {
      res.status(400).json({
        success: false,
        message: 'Se requiere agencyId'
      });
      return;
    }

    // Generar sessionId único
    const sessionId = `vf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const result = await voiceflowService.handleVoiceSession({
      sessionId,
      agencyId,
      phone,
      request: { type: 'launch' }
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Enviar mensaje de texto a sesión
 */
export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const { text, agencyId } = req.body;

    if (!text) {
      res.status(400).json({
        success: false,
        message: 'Se requiere text'
      });
      return;
    }

    const result = await voiceflowService.handleVoiceSession({
      sessionId,
      agencyId,
      request: {
        type: 'text',
        payload: { text }
      }
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Enviar intent a sesión
 */
export const sendIntent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const { intent, entities, agencyId } = req.body;

    if (!intent) {
      res.status(400).json({
        success: false,
        message: 'Se requiere intent'
      });
      return;
    }

    const result = await voiceflowService.handleVoiceSession({
      sessionId,
      agencyId,
      request: {
        type: 'intent',
        payload: { intent, entities }
      }
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Finalizar sesión
 */
export const endSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const { agencyId } = req.body;

    const result = await voiceflowService.handleVoiceSession({
      sessionId,
      agencyId,
      request: { type: 'end' }
    });

    res.status(200).json({
      success: true,
      message: 'Sesión finalizada',
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Obtener sesión por ID
 */
export const getSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const session = await voiceflowService.getSession(sessionId);

    if (!session) {
      res.status(404).json({
        success: false,
        message: 'Sesión no encontrada'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: session
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Obtener sesiones de una agencia
 */
export const getAgencySessions = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const agencyId = req.params.agencyId;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'No autorizado' });
      return;
    }

    const hasAccess = await agencyAccess.hasGymAccess(userId, userRole, agencyId);
    if (!hasAccess) {
      res.status(403).json({ success: false, message: 'Acceso denegado' });
      return;
    }

    const sessions = await voiceflowService.getAgencySessions(agencyId, limit);

    res.status(200).json({
      success: true,
      data: sessions
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Obtener estadísticas de sesiones de voz
 */
export const getVoiceStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const agencyId = req.params.agencyId;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'No autorizado' });
      return;
    }

    const hasAccess = await agencyAccess.hasGymAccess(userId, userRole, agencyId);
    if (!hasAccess) {
      res.status(403).json({ success: false, message: 'Acceso denegado' });
      return;
    }

    const statistics = await voiceflowService.getVoiceStatistics(agencyId, startDate, endDate);

    res.status(200).json({
      success: true,
      data: statistics
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Webhook de verificación para Voiceflow
 */
export const verifyWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    // Voiceflow puede enviar un GET para verificar el webhook
    const challenge = req.query.challenge || req.query['hub.challenge'];

    if (challenge) {
      res.status(200).send(challenge);
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Webhook de Voiceflow activo',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
