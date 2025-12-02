/**
 * Password Reset Controller
 * Handles HTTP requests for password reset functionality
 */

import { Request, Response } from 'express';
import * as passwordResetService from '../services/passwordReset.service';
import * as emailService from '../services/email.service';

/**
 * Request password reset
 * POST /api/auth/forgot-password
 */
export async function requestPasswordReset(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body;

    // Check for rate limiting (prevent spam)
    const hasRecentRequest = await passwordResetService.hasRecentResetRequest(email);
    
    if (hasRecentRequest) {
      res.status(429).json({
        success: false,
        message: 'A password reset email was recently sent. Please check your inbox or try again in 5 minutes.',
      });
      return;
    }

    // Request password reset
    const result = await passwordResetService.requestPasswordReset(email);

    // If user exists, send email
    if (result.token && result.user) {
      await emailService.sendPasswordResetEmail(
        result.user.email,
        result.user.name,
        result.token
      );
    }

    // Always return success (security: don't reveal if email exists)
    res.status(200).json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
    });

  } catch (error) {
    console.error('Error in requestPasswordReset:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while processing your request. Please try again later.',
    });
  }
}

/**
 * Verify reset token
 * POST /api/auth/reset-password/verify
 */
export async function verifyResetToken(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.body;

    const result = await passwordResetService.verifyResetToken(token);

    if (!result.valid) {
      res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Token is valid',
      email: result.email,
    });

  } catch (error) {
    console.error('Error in verifyResetToken:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while verifying the token',
    });
  }
}

/**
 * Reset password with token
 * POST /api/auth/reset-password
 */
export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { token, newPassword } = req.body;

    const result = await passwordResetService.resetPassword(token, newPassword);

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: result.message,
      });
      return;
    }

    // Get user info to send confirmation email
    const verification = await passwordResetService.verifyResetToken(token);
    if (verification.email) {
      // Note: This will fail since token is already used, but we can get email from result
      // For now, we'll skip the confirmation email or implement a different approach
    }

    res.status(200).json({
      success: true,
      message: result.message,
    });

  } catch (error) {
    console.error('Error in resetPassword:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while resetting your password',
    });
  }
}

/**
 * Test email configuration (development only)
 * GET /api/auth/test-email
 */
export async function testEmailConfig(_req: Request, res: Response): Promise<void> {
  try {
    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
      res.status(403).json({
        success: false,
        message: 'This endpoint is only available in development mode',
      });
      return;
    }

    const isConfigured = await emailService.testEmailConfiguration();

    res.status(200).json({
      success: true,
      configured: isConfigured,
      message: isConfigured 
        ? 'Email service is properly configured' 
        : 'Email service is in development mode (console logging)',
    });

  } catch (error) {
    console.error('Error in testEmailConfig:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing email configuration',
    });
  }
}

