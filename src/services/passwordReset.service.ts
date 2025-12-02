/**
 * Password Reset Service
 * Handles password reset request, token verification, and password update
 */

import crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import prisma from '../config/database';

/**
 * Request a password reset
 * Generates a secure token and stores it in the database
 * 
 * @param email - User's email address
 * @returns Object with success status and reset token (for email)
 */
export async function requestPasswordReset(email: string): Promise<{ 
  success: boolean; 
  token?: string;
  user?: { id: string; email: string; name: string };
}> {
  try {
    // Find user by email (exclude soft-deleted users)
    const user = await prisma.user.findFirst({
      where: { 
        email: email.toLowerCase().trim(),
        isDeleted: false 
      },
      select: {
        id: true,
        email: true,
        name: true,
        status: true
      }
    });

    // Security: Always return success to prevent email enumeration
    // Don't reveal if email exists or not
    if (!user) {
      console.log(`Password reset requested for non-existent email: ${email}`);
      return { success: true };
    }

    // Don't allow password reset for suspended accounts
    if (user.status === 'SUSPENDED') {
      console.log(`Password reset requested for suspended account: ${email}`);
      return { success: true }; // Still return success for security
    }

    // Generate secure random token (32 bytes = 64 hex characters)
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Hash the token before storing (defense in depth)
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Set expiry time (1 hour from now)
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

    // Store hashed token and expiry in database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: hashedToken,
        resetTokenExpiry: resetTokenExpiry
      }
    });

    console.log(`Password reset token generated for user: ${user.email}`);

    // Return the plain token (to be sent via email)
    // and user info (for email personalization)
    return { 
      success: true, 
      token: resetToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    };

  } catch (error) {
    console.error('Error in requestPasswordReset:', error);
    throw new Error('Failed to process password reset request');
  }
}

/**
 * Verify a password reset token
 * Checks if token exists and hasn't expired
 * 
 * @param token - The plain reset token from the email link
 * @returns Object with user email if valid
 */
export async function verifyResetToken(token: string): Promise<{ 
  valid: boolean; 
  email?: string;
  userId?: string;
}> {
  try {
    // Hash the provided token to match against stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with this token that hasn't expired
    const user = await prisma.user.findFirst({
      where: {
        resetToken: hashedToken,
        resetTokenExpiry: {
          gt: new Date() // Token expiry is greater than current time
        },
        isDeleted: false
      },
      select: {
        id: true,
        email: true,
        status: true
      }
    });

    if (!user) {
      console.log('Invalid or expired reset token provided');
      return { valid: false };
    }

    // Don't allow password reset for suspended accounts
    if (user.status === 'SUSPENDED') {
      console.log(`Password reset attempted for suspended account: ${user.email}`);
      return { valid: false };
    }

    return { 
      valid: true, 
      email: user.email,
      userId: user.id
    };

  } catch (error) {
    console.error('Error in verifyResetToken:', error);
    return { valid: false };
  }
}

/**
 * Reset user password with a valid token
 * 
 * @param token - The plain reset token
 * @param newPassword - The new password to set
 * @returns Success status
 */
export async function resetPassword(
  token: string, 
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  try {
    // First verify the token
    const verification = await verifyResetToken(token);
    
    if (!verification.valid || !verification.userId) {
      return { 
        success: false, 
        message: 'Invalid or expired reset token' 
      };
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password and clear reset token fields
    await prisma.user.update({
      where: { id: verification.userId },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
        updatedAt: new Date()
      }
    });

    console.log(`Password successfully reset for user: ${verification.email}`);

    return { 
      success: true, 
      message: 'Password has been reset successfully' 
    };

  } catch (error) {
    console.error('Error in resetPassword:', error);
    throw new Error('Failed to reset password');
  }
}

/**
 * Clear expired reset tokens (cleanup function)
 * Can be run as a scheduled job
 */
export async function clearExpiredResetTokens(): Promise<number> {
  try {
    const result = await prisma.user.updateMany({
      where: {
        resetTokenExpiry: {
          lt: new Date() // Expiry is less than current time
        },
        resetToken: {
          not: null
        }
      },
      data: {
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    console.log(`Cleared ${result.count} expired reset tokens`);
    return result.count;

  } catch (error) {
    console.error('Error in clearExpiredResetTokens:', error);
    return 0;
  }
}

/**
 * Check if user has recently requested a password reset
 * Helps prevent reset token spam
 * 
 * @param email - User's email
 * @returns boolean indicating if recent request exists
 */
export async function hasRecentResetRequest(email: string): Promise<boolean> {
  try {
    const user = await prisma.user.findFirst({
      where: { 
        email: email.toLowerCase().trim(),
        resetTokenExpiry: {
          gt: new Date() // Has a valid (non-expired) token
        },
        isDeleted: false
      },
      select: {
        resetTokenExpiry: true
      }
    });

    if (!user || !user.resetTokenExpiry) {
      return false;
    }

    // Check if token was created in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const tokenAge = new Date(user.resetTokenExpiry.getTime() - 60 * 60 * 1000); // Token creation time
    
    return tokenAge > fiveMinutesAgo;

  } catch (error) {
    console.error('Error in hasRecentResetRequest:', error);
    return false;
  }
}
