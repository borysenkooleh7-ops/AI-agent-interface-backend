import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { RegisterDTO, LoginDTO } from '../types/auth.types';
import logger from '../utils/logger';

/**
 * Register a new user
 * POST /api/auth/register
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const data: RegisterDTO = req.body;

    const result = await authService.register(data);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result,
    });
  } catch (error: any) {
    logger.error('Registration error:', error.message);

    const statusCode = error.message.includes('already registered') ? 409 : 400;

    res.status(statusCode).json({
      success: false,
      message: error.message || 'Registration failed',
    });
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const data: LoginDTO = req.body;

    const result = await authService.login(data);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  } catch (error: any) {
    logger.error('Login error:', error.message);

    res.status(401).json({
      success: false,
      message: error.message || 'Login failed',
    });
  }
};

/**
 * Get current user
 * GET /api/auth/me
 */
export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    const user = await authService.getUserById(req.user.userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    logger.error('Get user error:', error.message);

    res.status(500).json({
      success: false,
      message: 'Failed to get user data',
    });
  }
};

/**
 * Logout user
 * POST /api/auth/logout
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    // In JWT-based auth, logout is mainly handled on client side
    // Server can maintain a token blacklist if needed

    logger.info(`User logged out: ${req.user?.email}`);

    res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error: any) {
    logger.error('Logout error:', error.message);

    res.status(500).json({
      success: false,
      message: 'Logout failed',
    });
  }
};

