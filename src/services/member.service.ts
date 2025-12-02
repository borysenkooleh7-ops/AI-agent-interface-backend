import prisma from '../config/database';
import logger from '../utils/logger';
import { softDelete } from '../utils/softDelete';

export interface CreateMemberData {
  gymId: string;
  leadId?: string;
  planId?: string;
  fullName: string;
  cpf: string;
  birthDate: Date;
  address?: string;
  zipCode?: string;
  preferredWorkoutTime?: string;
  gymGoal?: string;
  email?: string;
  phone: string;
}

export interface UpdateMemberData {
  planId?: string;
  fullName?: string;
  address?: string;
  zipCode?: string;
  preferredWorkoutTime?: string;
  gymGoal?: string;
  email?: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  planExpirationDate?: Date;
}

export interface MemberFilters {
  gymId?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
  accessibleGymIds?: string[];
}

/**
 * Get all members with filtering
 */
export async function getAllMembers(filters: MemberFilters = {}) {
  try {
    const {
      gymId,
      status,
      search,
      limit = 50,
      offset = 0,
      accessibleGymIds
    } = filters;

    const where: any = { isDeleted: false };

    if (gymId) {
      where.gymId = gymId;
    } else if (accessibleGymIds && accessibleGymIds.length > 0) {
      where.gymId = { in: accessibleGymIds };
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { cpf: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [members, total] = await Promise.all([
      prisma.member.findMany({
        where,
        include: {
          gym: {
            select: {
              id: true,
              name: true
            }
          },
          plan: {
            select: {
              id: true,
              name: true,
              price: true,
              duration: true
            }
          },
          lead: {
            select: {
              id: true,
              name: true,
              phone: true
            }
          },
          approver: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        skip: offset
      }),
      prisma.member.count({ where })
    ]);

    return {
      members,
      total,
      hasMore: offset + limit < total
    };
  } catch (error) {
    logger.error('Error getting all members:', error);
    throw error;
  }
}

/**
 * Get member by ID
 */
export async function getMemberById(memberId: string) {
  try {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        gym: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            email: true
          }
        },
        plan: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            duration: true,
            features: true
          }
        },
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            status: true
          }
        },
        approver: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            type: true,
            description: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!member || member.isDeleted) {
      throw new Error('Member not found');
    }

    return member;
  } catch (error) {
    logger.error('Error getting member by ID:', error);
    throw error;
  }
}

/**
 * Create new member application
 */
export async function createMember(data: CreateMemberData, createdBy?: string) {
  try {
    // Check if member with CPF already exists
    const existingMember = await prisma.member.findUnique({
      where: { cpf: data.cpf }
    });

    if (existingMember && !existingMember.isDeleted) {
      throw new Error('Member with this CPF already exists');
    }

    // Calculate plan expiration date if plan is provided
    let planExpirationDate: Date | undefined;
    if (data.planId) {
      const plan = await prisma.plan.findUnique({
        where: { id: data.planId },
        select: { duration: true }
      });
      if (plan) {
        planExpirationDate = new Date();
        planExpirationDate.setDate(planExpirationDate.getDate() + plan.duration);
      }
    }

    // Create member
    const member = await prisma.member.create({
      data: {
        gymId: data.gymId,
        leadId: data.leadId,
        planId: data.planId,
        fullName: data.fullName,
        cpf: data.cpf,
        birthDate: data.birthDate,
        address: data.address,
        zipCode: data.zipCode,
        preferredWorkoutTime: data.preferredWorkoutTime,
        gymGoal: data.gymGoal,
        email: data.email,
        phone: data.phone,
        status: 'PENDING',
        planExpirationDate
      },
      include: {
        gym: {
          select: {
            id: true,
            name: true
          }
        },
        plan: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        type: 'MEMBER_APPLICATION_CREATED',
        description: `Member application created for ${member.fullName}`,
        userId: createdBy,
        gymId: member.gymId,
        metadata: {
          memberId: member.id,
          cpf: member.cpf
        }
      }
    });

    logger.info(`Member application created: ${member.fullName} (${member.cpf})`);

    return member;
  } catch (error) {
    logger.error('Error creating member:', error);
    throw error;
  }
}

/**
 * Update member
 */
export async function updateMember(memberId: string, data: UpdateMemberData, updatedBy: string) {
  try {
    const existingMember = await prisma.member.findUnique({
      where: { id: memberId }
    });

    if (!existingMember || existingMember.isDeleted) {
      throw new Error('Member not found');
    }

    // If plan is being updated, recalculate expiration date
    let planExpirationDate = data.planExpirationDate;
    if (data.planId && data.planId !== existingMember.planId) {
      const plan = await prisma.plan.findUnique({
        where: { id: data.planId },
        select: { duration: true }
      });
      if (plan) {
        planExpirationDate = new Date();
        planExpirationDate.setDate(planExpirationDate.getDate() + plan.duration);
      }
    }

    const updatedMember = await prisma.member.update({
      where: { id: memberId },
      data: {
        ...data,
        planExpirationDate,
        updatedAt: new Date()
      },
      include: {
        gym: {
          select: {
            id: true,
            name: true
          }
        },
        plan: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        type: 'MEMBER_UPDATED',
        description: `Member ${updatedMember.fullName} was updated`,
        userId: updatedBy,
        gymId: updatedMember.gymId,
        metadata: {
          memberId: updatedMember.id,
          changes: data as any
        } as any
      }
    });

    logger.info(`Member updated: ${updatedMember.fullName} by ${updatedBy}`);

    return updatedMember;
  } catch (error) {
    logger.error('Error updating member:', error);
    throw error;
  }
}

/**
 * Approve member application
 */
export async function approveMember(memberId: string, approvedBy: string) {
  try {
    const member = await prisma.member.findUnique({
      where: { id: memberId }
    });

    if (!member || member.isDeleted) {
      throw new Error('Member not found');
    }

    if (member.status !== 'PENDING') {
      throw new Error(`Member application is already ${member.status}`);
    }

    const approvedMember = await prisma.member.update({
      where: { id: memberId },
      data: {
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date()
      },
      include: {
        gym: {
          select: {
            id: true,
            name: true
          }
        },
        plan: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        type: 'MEMBER_APPLICATION_APPROVED',
        description: `Member application approved for ${approvedMember.fullName}`,
        userId: approvedBy,
        gymId: approvedMember.gymId,
        metadata: {
          memberId: approvedMember.id
        }
      }
    });

    // Notify all admins and managers for this gym
    const { notifyMemberApplicationApproved } = await import('./notification.service');
    const gymUsers = await prisma.gymUser.findMany({
      where: {
        gymId: approvedMember.gymId,
        role: { in: ['ADMIN', 'MANAGER'] }
      },
      select: { userId: true }
    });

    for (const gymUser of gymUsers) {
      try {
        await notifyMemberApplicationApproved(gymUser.userId, {
          id: approvedMember.id,
          fullName: approvedMember.fullName,
          gymId: approvedMember.gymId,
          planId: approvedMember.planId
        });
      } catch (error) {
        logger.error(`Failed to notify user ${gymUser.userId} about member approval:`, error);
      }
    }

    // Emit Socket.IO event
    const { getSocketInstance } = await import('../utils/socketManager');
    const io = getSocketInstance();
    if (io) {
      for (const gymUser of gymUsers) {
        io.to(`user:${gymUser.userId}`).emit('notification', {
          type: 'MEMBER_APPLICATION_APPROVED',
          title: `Member application approved: ${approvedMember.fullName}`,
          message: `The member application for ${approvedMember.fullName} has been approved`,
          data: {
            memberId: approvedMember.id,
            memberName: approvedMember.fullName,
            gymId: approvedMember.gymId
          }
        });
      }
    }

    logger.info(`Member application approved: ${approvedMember.fullName} by ${approvedBy}`);

    return approvedMember;
  } catch (error) {
    logger.error('Error approving member:', error);
    throw error;
  }
}

/**
 * Reject member application
 */
export async function rejectMember(memberId: string, rejectedBy: string) {
  try {
    const member = await prisma.member.findUnique({
      where: { id: memberId }
    });

    if (!member || member.isDeleted) {
      throw new Error('Member not found');
    }

    if (member.status !== 'PENDING') {
      throw new Error(`Member application is already ${member.status}`);
    }

    const rejectedMember = await prisma.member.update({
      where: { id: memberId },
      data: {
        status: 'REJECTED',
        approvedBy: rejectedBy,
        approvedAt: new Date()
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

    // Log activity
    await prisma.activityLog.create({
      data: {
        type: 'MEMBER_APPLICATION_REJECTED',
        description: `Member application rejected for ${rejectedMember.fullName}`,
        userId: rejectedBy,
        gymId: rejectedMember.gymId,
        metadata: {
          memberId: rejectedMember.id
        }
      }
    });

    // Notify all admins and managers for this gym
    const { notifyMemberApplicationRejected } = await import('./notification.service');
    const gymUsers = await prisma.gymUser.findMany({
      where: {
        gymId: rejectedMember.gymId,
        role: { in: ['ADMIN', 'MANAGER'] }
      },
      select: { userId: true }
    });

    for (const gymUser of gymUsers) {
      try {
        await notifyMemberApplicationRejected(gymUser.userId, {
          id: rejectedMember.id,
          fullName: rejectedMember.fullName,
          gymId: rejectedMember.gymId
        });
      } catch (error) {
        logger.error(`Failed to notify user ${gymUser.userId} about member rejection:`, error);
      }
    }

    // Emit Socket.IO event
    const { getSocketInstance } = await import('../utils/socketManager');
    const io = getSocketInstance();
    if (io) {
      for (const gymUser of gymUsers) {
        io.to(`user:${gymUser.userId}`).emit('notification', {
          type: 'MEMBER_APPLICATION_REJECTED',
          title: `Member application rejected: ${rejectedMember.fullName}`,
          message: `The member application for ${rejectedMember.fullName} has been rejected`,
          data: {
            memberId: rejectedMember.id,
            memberName: rejectedMember.fullName,
            gymId: rejectedMember.gymId
          }
        });
      }
    }

    logger.info(`Member application rejected: ${rejectedMember.fullName} by ${rejectedBy}`);

    return rejectedMember;
  } catch (error) {
    logger.error('Error rejecting member:', error);
    throw error;
  }
}

/**
 * Delete member (soft delete)
 */
export async function deleteMember(memberId: string, deletedBy: string) {
  try {
    await softDelete(prisma.member, memberId, deletedBy);

    // Log activity
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { fullName: true, gymId: true }
    });

    if (member) {
      await prisma.activityLog.create({
        data: {
          type: 'MEMBER_DELETED',
          description: `Member ${member.fullName} was deleted`,
          userId: deletedBy,
          gymId: member.gymId,
          metadata: {
            memberId
          }
        }
      });
    }

    logger.info(`Member soft deleted: ${memberId} by ${deletedBy}`);
  } catch (error) {
    logger.error('Error deleting member:', error);
    throw error;
  }
}

/**
 * Get member statistics
 */
export async function getMemberStatistics(gymId?: string) {
  try {
    const where: any = { isDeleted: false };
    if (gymId) where.gymId = gymId;

    const [
      total,
      pending,
      approved,
      rejected,
      active,
      inactive,
      expired
    ] = await Promise.all([
      prisma.member.count({ where }),
      prisma.member.count({ where: { ...where, status: 'PENDING' } }),
      prisma.member.count({ where: { ...where, status: 'APPROVED' } }),
      prisma.member.count({ where: { ...where, status: 'REJECTED' } }),
      prisma.member.count({ where: { ...where, status: 'ACTIVE' } }),
      prisma.member.count({ where: { ...where, status: 'INACTIVE' } }),
      prisma.member.count({ where: { ...where, status: 'EXPIRED' } })
    ]);

    return {
      total,
      pending,
      approved,
      rejected,
      active,
      inactive,
      expired
    };
  } catch (error) {
    logger.error('Error getting member statistics:', error);
    throw error;
  }
}

