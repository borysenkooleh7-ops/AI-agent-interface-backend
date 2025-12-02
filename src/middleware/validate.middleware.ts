import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

/**
 * Validation middleware factory
 */
export const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Invalid request data',
        });
      }
    }
  };
};

/**
 * Validation schemas for authentication
 */
export const authSchemas = {
  register: z.object({
    email: z.string().email('Invalid email format'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    name: z.string().min(2, 'Name must be at least 2 characters'),
    role: z.enum(['ADMIN', 'MANAGER', 'AGENT']).optional(),
  }),

  login: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  }),
};

/**
 * Validation schemas for registration
 */
export const registrationSchemas = {
  validateInvitation: z.object({
    code: z.string().min(8, 'Invitation code must be at least 8 characters'),
  }),

  acceptInvitation: z.object({
    invitationCode: z.string().min(8, 'Invitation code is required'),
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email format'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    phone: z.string().optional(),
  }),

  createRegistrationRequest: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email format'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    phone: z.string().optional(),
    role: z.enum(['AGENT', 'MANAGER'], { required_error: 'Role is required' }),
    gymId: z.string().min(1, 'Gym ID is required'),
  }),

  registerGymOwner: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email format'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    phone: z.string().optional(),
    gymName: z.string().min(2, 'Gym name must be at least 2 characters'),
  }),

  createInvitation: z.object({
    email: z.string().email('Invalid email format'),
    gymId: z.string().min(1, 'Gym ID is required'),
    role: z.enum(['ADMIN', 'MANAGER', 'AGENT']),
    expiresInDays: z.number().min(1).max(30).optional(),
  }),

  resendInvitation: z.object({
    expiresInDays: z.number().min(1).max(30).optional(),
  }),
};

/**
 * Validation schemas for password reset
 */
export const passwordResetSchemas = {
  requestReset: z.object({
    email: z.string().email('Invalid email format'),
  }),

  verifyToken: z.object({
    token: z.string().min(32, 'Invalid reset token'),
  }),

  resetPassword: z.object({
    token: z.string().min(32, 'Invalid reset token'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  }),
};

/**
 * Validation schemas for user profile
 */
export const userProfileSchemas = {
  updateProfile: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    phone: z.string().min(10, 'Phone must be at least 10 characters').optional(),
    avatar: z.string().url('Avatar must be a valid URL').optional(),
  }),

  changePassword: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  }),

  uploadAvatar: z.object({
    avatarUrl: z.string().url('Avatar URL must be a valid URL'),
  }),
};

