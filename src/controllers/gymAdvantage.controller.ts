import { Request, Response } from 'express';
import * as gymAdvantageService from '../services/gymAdvantage.service';
import * as gymAccess from '../utils/gymAccess';

export const listAdvantages = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const gymId = req.params.gymId;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const hasAccess = await gymAccess.hasGymAccess(userId, userRole, gymId);
    if (!hasAccess) {
      res.status(403).json({ success: false, message: 'Access denied to this gym' });
      return;
    }

    const advantages = await gymAdvantageService.getAdvantagesByGym(gymId);
    res.status(200).json({ success: true, data: advantages });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createAdvantage = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const gymId = req.params.gymId;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const hasAccess = await gymAccess.hasGymAccess(userId, userRole, gymId);
    if (!hasAccess) {
      res.status(403).json({ success: false, message: 'Access denied to this gym' });
      return;
    }

    const advantage = await gymAdvantageService.createAdvantage(gymId, {
      title: req.body.title,
      description: req.body.description,
      order: req.body.order
    });

    res.status(201).json({ success: true, message: 'Advantage created successfully', data: advantage });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const updateAdvantage = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const gymId = req.params.gymId;
    const advantageId = req.params.advantageId;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const advantage = await gymAdvantageService.getAdvantageById(advantageId);
    if (!advantage || advantage.gymId !== gymId) {
      res.status(404).json({ success: false, message: 'Advantage not found' });
      return;
    }

    const hasAccess = await gymAccess.hasGymAccess(userId, userRole, gymId);
    if (!hasAccess) {
      res.status(403).json({ success: false, message: 'Access denied to this gym' });
      return;
    }

    const updated = await gymAdvantageService.updateAdvantage(advantageId, req.body);
    res.status(200).json({ success: true, message: 'Advantage updated successfully', data: updated });
  } catch (error: any) {
    const status = error.message === 'Advantage not found' ? 404 : 400;
    res.status(status).json({ success: false, message: error.message });
  }
};

export const deleteAdvantage = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const gymId = req.params.gymId;
    const advantageId = req.params.advantageId;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const advantage = await gymAdvantageService.getAdvantageById(advantageId);
    if (!advantage || advantage.gymId !== gymId) {
      res.status(404).json({ success: false, message: 'Advantage not found' });
      return;
    }

    const hasAccess = await gymAccess.hasGymAccess(userId, userRole, gymId);
    if (!hasAccess) {
      res.status(403).json({ success: false, message: 'Access denied to this gym' });
      return;
    }

    await gymAdvantageService.deleteAdvantage(advantageId);
    res.status(200).json({ success: true, message: 'Advantage deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

