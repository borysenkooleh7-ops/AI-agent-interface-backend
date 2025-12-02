import { Request, Response } from 'express';
import * as aiPromptService from '../services/aiPrompt.service';

/**
 * Get AI prompt for a gym
 */
export const getAIPrompt = async (req: Request, res: Response): Promise<void> => {
  try {
    const prompt = await aiPromptService.getAIPrompt(req.params.gymId);
    res.status(200).json({ success: true, data: prompt });
  } catch (error: any) {
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

/**
 * Create AI prompt
 */
export const createAIPrompt = async (req: Request, res: Response): Promise<void> => {
  try {
    const createdBy = req.user?.userId || 'system';
    const prompt = await aiPromptService.createAIPrompt(req.body, createdBy);
    res.status(201).json({ success: true, message: 'AI Prompt created successfully', data: prompt });
  } catch (error: any) {
    const statusCode = error.message.includes('already exists') ? 409 : error.message.includes('not found') ? 404 : 400;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

/**
 * Update AI prompt
 */
export const updateAIPrompt = async (req: Request, res: Response): Promise<void> => {
  try {
    const updatedBy = req.user?.userId || 'system';
    const prompt = await aiPromptService.updateAIPrompt(req.params.gymId, req.body, updatedBy);
    res.status(200).json({ success: true, message: 'AI Prompt updated successfully', data: prompt });
  } catch (error: any) {
    const statusCode = error.message.includes('not found') ? 404 : 400;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

/**
 * Delete AI prompt
 */
export const deleteAIPrompt = async (req: Request, res: Response): Promise<void> => {
  try {
    const deletedBy = req.user?.userId || 'system';
    await aiPromptService.deleteAIPrompt(req.params.gymId, deletedBy);
    res.status(200).json({ success: true, message: 'AI Prompt deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get default prompt template
 */
export const getDefaultTemplate = async (_req: Request, res: Response): Promise<void> => {
  try {
    const template = aiPromptService.getDefaultPromptTemplate();
    res.status(200).json({ success: true, data: template });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
