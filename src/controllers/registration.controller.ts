import { Request, Response } from 'express';
import prisma from '../config/database';
import * as invitationService from '../services/invitation.service';
import logger from '../utils/logger';

/**
 * Validate invitation code
 * POST /api/auth/register/invitation/validate
 */
export const validateInvitation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.body;

    if (!code) {
      res.status(400).json({
        success: false,
        message: 'Invitation code is required',
      });
      return;
    }

    const invitationData = await invitationService.validateInvitation(code);

    if (!invitationData) {
      res.status(404).json({
        success: false,
        message: 'Invalid invitation code',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: invitationData,
    });
  } catch (error: any) {
    logger.error('Invitation validation error:', error.message);

    res.status(400).json({
      success: false,
      message: error.message || 'Failed to validate invitation',
    });
  }
};

/**
 * Accept invitation and create user
 * POST /api/auth/register/invitation/accept
 */
export const acceptInvitation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { invitationCode, name, email, password, phone } = req.body;

    if (!invitationCode || !name || !email || !password) {
      res.status(400).json({
        success: false,
        message: 'Invitation code, name, email, and password are required',
      });
      return;
    }

    const result = await invitationService.acceptInvitation(invitationCode, {
      name,
      password,
      phone,
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: result,
    });
  } catch (error: any) {
    logger.error('Invitation acceptance error:', error.message);

    const statusCode = error.message.includes('already exists') ? 409 : 400;

    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to create account',
    });
  }
};

/**
 * Create registration request (AGENT or MANAGER)
 * POST /api/auth/register/request
 */
export const createRegistrationRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, phone, role, gymId } = req.body;

    if (!name || !email || !password || !role || !gymId) {
      res.status(400).json({
        success: false,
        message: 'Name, email, password, role, and gym ID are required',
      });
      return;
    }

    if (!['AGENT', 'MANAGER'].includes(role)) {
      res.status(400).json({
        success: false,
        message: 'Role must be either AGENT or MANAGER',
      });
      return;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: 'User with this email already exists',
      });
      return;
    }

    // Check if there's already a pending request for this email
    const existingRequest = await prisma.registrationRequest.findFirst({
      where: {
        email: email.toLowerCase(),
        status: 'PENDING',
      },
    });

    if (existingRequest) {
      res.status(409).json({
        success: false,
        message: 'A pending registration request already exists for this email',
      });
      return;
    }

    // Verify gym exists
    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
    });

    if (!gym || gym.isDeleted) {
      res.status(404).json({
        success: false,
        message: 'Gym not found',
      });
      return;
    }

    // Hash password
    const bcrypt = await import('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create registration request
    const request = await prisma.registrationRequest.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        phone,
        role,
        gymId,
        status: 'PENDING',
      },
      include: {
        gym: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    logger.info(`Registration request created: ${request.email} for role ${role} at gym ${gymId}`);

    // Notify approvers about the new registration request
    // MANAGER requests: notify ALL ADMIN users (across all gyms)
    // AGENT requests: notify MANAGER users in the same gym
    const { createNotification } = await import('../services/notification.service');
    const { getSocketInstance } = await import('../utils/socketManager');
    
    try {
      let usersToNotify: Array<{ userId: string; role: string }> = [];

      if (role === 'MANAGER') {
        // For MANAGER requests: notify ALL ADMIN users (across all gyms)
        const adminUsers = await prisma.user.findMany({
          where: {
            role: 'ADMIN',
            status: 'ACTIVE',
            isDeleted: false
          },
          select: {
            id: true,
            role: true
          }
        });
        usersToNotify = adminUsers.map(user => ({ userId: user.id, role: user.role }));
      } else if (role === 'AGENT') {
        // For AGENT requests: notify MANAGER users in the same gym
        const gymManagers = await prisma.gymUser.findMany({
          where: {
            gymId: gymId,
            role: 'MANAGER',
            user: {
              status: 'ACTIVE',
              isDeleted: false
            }
          },
          select: {
            userId: true,
            role: true
          }
        });
        usersToNotify = gymManagers;
      }

      const notificationTitle = `New ${role} Registration Request: ${name}`;
      const notificationMessage = role === 'AGENT'
        ? `A new agent registration request from ${name} (${email}) at ${request.gym.name} requires your approval.`
        : `A new manager registration request from ${name} (${email}) at ${request.gym.name} requires your approval.`;

      for (const user of usersToNotify) {
        try {
          await createNotification({
            userId: user.userId,
            type: 'REGISTRATION_REQUEST_CREATED',
            title: notificationTitle,
            message: notificationMessage,
            data: {
              requestId: request.id,
              requesterEmail: request.email,
              requesterName: request.name,
              role: request.role,
              gymId: request.gymId,
              gymName: request.gym.name
            }
          });

          // Emit Socket.IO notification event
          const io = getSocketInstance();
          if (io) {
            io.to(`user:${user.userId}`).emit('notification', {
              type: 'REGISTRATION_REQUEST_CREATED',
              title: notificationTitle,
              message: notificationMessage,
              data: {
                requestId: request.id,
                requesterEmail: request.email,
                requesterName: request.name,
                role: request.role,
                gymId: request.gymId,
                gymName: request.gym.name
              }
            });
          }
        } catch (error) {
          logger.error(`Failed to notify user ${user.userId} about registration request:`, error);
        }
      }
    } catch (notificationError) {
      logger.error('Failed to create notifications for registration request:', notificationError);
      // Don't fail the request if notification fails
    }

    res.status(201).json({
      success: true,
      message: 'Registration request submitted successfully. Please wait for approval.',
      data: {
        id: request.id,
        email: request.email,
        role: request.role,
        status: request.status,
      },
    });
  } catch (error: any) {
    logger.error('Registration request error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create registration request',
    });
  }
};

/**
 * Register as gym owner (create gym + admin user)
 * POST /api/auth/register/gym-owner
 */
export const registerGymOwner = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, phone, gymName } = req.body;

    if (!name || !email || !password || !gymName) {
      res.status(400).json({
        success: false,
        message: 'Name, email, password, and gym name are required',
      });
      return;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: 'User with this email already exists',
      });
      return;
    }

    // Use existing Prisma client

    // Create gym
    const gym = await prisma.gym.create({
      data: {
        name: gymName,
        slug: gymName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        status: 'ACTIVE',
      },
    });

    // Create admin user
    const bcrypt = await import('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        role: 'ADMIN',
        status: 'ACTIVE',
        phone,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        avatar: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
      },
    });

    // Assign user to gym as admin
    await prisma.gymUser.create({
      data: {
        userId: user.id,
        gymId: gym.id,
        role: 'ADMIN',
      },
    });

    // Generate JWT token
    const jwt = await import('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
    
    const token = jwt.sign({
      userId: user.id,
      email: user.email,
      role: user.role,
    } as any, JWT_SECRET, {
      expiresIn: '24h',
    } as any);

    logger.info(`Gym owner registered: ${user.email} -> ${gym.name}`);

    res.status(201).json({
      success: true,
      message: 'Gym and account created successfully',
      data: {
        user,
        token,
        gym: {
          id: gym.id,
          name: gym.name,
          slug: gym.slug,
        },
      },
    });
  } catch (error: any) {
    logger.error('Gym owner registration error:', error.message);

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create gym and account',
    });
  }
};

/**
 * Create invitation (admin only)
 * POST /api/auth/register/invitation/create
 */
export const createInvitation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, gymId, role, expiresInDays } = req.body;

    if (!email || !gymId || !role) {
      res.status(400).json({
        success: false,
        message: 'Email, gym ID, and role are required',
      });
      return;
    }

    const invitationData = await invitationService.createInvitation({
      email,
      gymId,
      role,
      invitedBy: req.user?.userId || '',
      expiresInDays,
    });

    res.status(201).json({
      success: true,
      message: 'Invitation created successfully',
      data: invitationData,
    });
  } catch (error: any) {
    logger.error('Invitation creation error:', error.message);

    const statusCode = error.message.includes('already exists') ? 409 : 400;

    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to create invitation',
    });
  }
};

/**
 * Get gym invitations (admin only)
 * GET /api/auth/register/invitations/:gymId
 */
export const getGymInvitations = async (req: Request, res: Response): Promise<void> => {
  try {
    const { gymId } = req.params;

    const invitations = await invitationService.getGymInvitations(gymId);

    res.status(200).json({
      success: true,
      data: invitations,
    });
  } catch (error: any) {
    logger.error('Get invitations error:', error.message);

    res.status(500).json({
      success: false,
      message: 'Failed to get invitations',
    });
  }
};

/**
 * Cancel invitation (admin only)
 * DELETE /api/auth/register/invitation/:id
 */
export const cancelInvitation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await invitationService.cancelInvitation(id, req.user?.userId || '');

    res.status(200).json({
      success: true,
      message: 'Invitation cancelled successfully',
    });
  } catch (error: any) {
    logger.error('Cancel invitation error:', error.message);

    res.status(500).json({
      success: false,
      message: 'Failed to cancel invitation',
    });
  }
};

/**
 * Resend invitation (admin only)
 * POST /api/auth/register/invitation/:id/resend
 */
export const resendInvitation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { expiresInDays } = req.body;

    const invitationData = await invitationService.resendInvitation(id, expiresInDays);

    res.status(200).json({
      success: true,
      message: 'Invitation resent successfully',
      data: invitationData,
    });
  } catch (error: any) {
    logger.error('Resend invitation error:', error.message);

    res.status(500).json({
      success: false,
      message: 'Failed to resend invitation',
    });
  }
};

/**
 * Get all registration requests
 * GET /api/auth/register/requests
 */
export const getRegistrationRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, gymId } = req.query;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const where: any = {};

    if (status && status !== 'all') {
      where.status = status;
    }

    if (gymId) {
      where.gymId = gymId;
    } else if (userRole !== 'ADMIN') {
      // Non-admins can only see requests for their gyms
      const userGyms = await prisma.gymUser.findMany({
        where: { userId },
        select: { gymId: true },
      });
      const gymIds = userGyms.map(ug => ug.gymId);
      if (gymIds.length > 0) {
        where.gymId = { in: gymIds };
      } else {
        // User has no gyms, return empty
        res.status(200).json({ success: true, data: { requests: [], total: 0 } });
        return;
      }
    }

    const [requests, total] = await Promise.all([
      prisma.registrationRequest.findMany({
        where,
        include: {
          gym: {
            select: {
              id: true,
              name: true,
            },
          },
          approver: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          rejecter: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.registrationRequest.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        requests,
        total,
      },
    });
  } catch (error: any) {
    logger.error('Get registration requests error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get registration requests',
    });
  }
};

/**
 * Approve registration request
 * POST /api/auth/register/requests/:id/approve
 */
export const approveRegistrationRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Check permissions: MANAGER can approve AGENT, ADMIN can approve MANAGER
    const request = await prisma.registrationRequest.findUnique({
      where: { id },
      include: {
        gym: true,
      },
    });

    if (!request) {
      res.status(404).json({ success: false, message: 'Registration request not found' });
      return;
    }

    if (request.status !== 'PENDING') {
      res.status(400).json({
        success: false,
        message: `Registration request is already ${request.status.toLowerCase()}`,
      });
      return;
    }

    // Check permissions
    if (request.role === 'MANAGER' && userRole !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Only admins can approve manager registration requests',
      });
      return;
    }

    if (request.role === 'AGENT' && !['ADMIN', 'MANAGER'].includes(userRole)) {
      res.status(403).json({
        success: false,
        message: 'Only admins or managers can approve agent registration requests',
      });
      return;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: request.email },
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: 'User with this email already exists',
      });
      return;
    }

    // Create user from registration request
    const user = await prisma.user.create({
      data: {
        email: request.email,
        password: request.password, // Already hashed
        name: request.name,
        role: request.role,
        phone: request.phone,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        phone: true,
        createdAt: true,
      },
    });

    // Assign user to gym
    await prisma.gymUser.create({
      data: {
        userId: user.id,
        gymId: request.gymId,
        role: request.role,
      },
    });

    // Handle "one manager per gym" rule if role is MANAGER
    if (request.role === 'MANAGER') {
      // Find other active managers for this gym
      const otherManagers = await prisma.gymUser.findMany({
        where: {
          gymId: request.gymId,
          role: 'MANAGER',
          userId: { not: user.id },
          user: {
            status: 'ACTIVE',
            isDeleted: false,
          },
        },
        include: {
          user: true,
        },
      });

      // Mark gym as inactive if there are other managers
      if (otherManagers.length > 0) {
        await prisma.gym.update({
          where: { id: request.gymId },
          data: { status: 'INACTIVE' },
        });
      }
    }

    // Update registration request
    await prisma.registrationRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });

    // Create notification for the newly created user
    const { createNotification } = await import('../services/notification.service');
    try {
      await createNotification({
        userId: user.id,
        type: 'REGISTRATION_REQUEST_APPROVED',
        title: 'Registration Approved',
        message: `Your registration request has been approved. You can now sign in with your email and password.`,
        data: {
          requestId: id,
          role: request.role,
          gymId: request.gymId,
          gymName: request.gym.name
        }
      });

      // Emit Socket.IO event
      const { getSocketInstance } = await import('../utils/socketManager');
      const io = getSocketInstance();
      if (io) {
        io.to(`user:${user.id}`).emit('notification', {
          type: 'REGISTRATION_REQUEST_APPROVED',
          title: 'Registration Approved',
          message: `Your registration request has been approved. You can now sign in with your email and password.`,
          data: {
            requestId: id,
            role: request.role,
            gymId: request.gymId
          }
        });
      }
    } catch (notificationError) {
      logger.error('Failed to create notification for approved registration:', notificationError);
      // Don't fail the request if notification fails
    }

    logger.info(`Registration request approved: ${request.email} by ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Registration request approved and user created successfully',
      data: {
        user,
        requestId: id,
      },
    });
  } catch (error: any) {
    logger.error('Approve registration request error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to approve registration request',
    });
  }
};

/**
 * Reject registration request
 * POST /api/auth/register/requests/:id/reject
 */
export const rejectRegistrationRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const request = await prisma.registrationRequest.findUnique({
      where: { id },
    });

    if (!request) {
      res.status(404).json({ success: false, message: 'Registration request not found' });
      return;
    }

    if (request.status !== 'PENDING') {
      res.status(400).json({
        success: false,
        message: `Registration request is already ${request.status.toLowerCase()}`,
      });
      return;
    }

    // Check permissions
    if (request.role === 'MANAGER' && userRole !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Only admins can reject manager registration requests',
      });
      return;
    }

    if (request.role === 'AGENT' && !['ADMIN', 'MANAGER'].includes(userRole)) {
      res.status(403).json({
        success: false,
        message: 'Only admins or managers can reject agent registration requests',
      });
      return;
    }

    // Update registration request
    await prisma.registrationRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedBy: userId,
        rejectedAt: new Date(),
        rejectionReason: rejectionReason || null,
      },
    });

    // Note: We cannot create a notification for the requester because they don't have a user account yet
    // They will see the rejection message when they try to log in (handled in login controller)
    // However, we can notify the approver's team about the rejection
    const { createNotification } = await import('../services/notification.service');
    try {
      // Notify other admins/managers in the same gym
      const gymUsers = await prisma.gymUser.findMany({
        where: {
          gymId: request.gymId,
          userId: { not: userId }, // Don't notify the person who rejected
          role: { in: ['ADMIN', 'MANAGER'] }
        },
        select: { userId: true }
      });

      for (const gymUser of gymUsers) {
        try {
          await createNotification({
            userId: gymUser.userId,
            type: 'REGISTRATION_REQUEST_REJECTED',
            title: `Registration Request Rejected: ${request.name}`,
            message: `A ${request.role.toLowerCase()} registration request from ${request.email} has been rejected.`,
            data: {
              requestId: id,
              requesterEmail: request.email,
              requesterName: request.name,
              role: request.role,
              gymId: request.gymId,
              rejectionReason: rejectionReason
            }
          });
        } catch (error) {
          logger.error(`Failed to notify user ${gymUser.userId} about registration rejection:`, error);
        }
      }
    } catch (notificationError) {
      logger.error('Failed to create notifications for rejected registration:', notificationError);
      // Don't fail the request if notification fails
    }

    logger.info(`Registration request rejected: ${request.email} by ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Registration request rejected successfully',
      data: {
        requestId: id,
      },
    });
  } catch (error: any) {
    logger.error('Reject registration request error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to reject registration request',
    });
  }
};
