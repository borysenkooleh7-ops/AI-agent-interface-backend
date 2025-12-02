/**
 * User Service
 * Handles user profile management and operations
 */

import * as bcrypt from 'bcrypt';
import prisma from '../config/database';

/**
 * Get user profile by ID
 */
export async function getUserProfile(userId: string) {
  try {
    const user = await prisma.user.findFirst({
      where: { 
        id: userId,
        isDeleted: false 
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        avatar: true,
        phone: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        gyms: {
          where: {
            gym: {
              isDeleted: false
            }
          },
          include: {
            gym: {
              select: {
                id: true,
                name: true,
                slug: true,
                logo: true,
                status: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Transform gyms data for easier frontend consumption
    const gymsData = user.gyms.map(gymUser => ({
      id: gymUser.gym.id,
      name: gymUser.gym.name,
      slug: gymUser.gym.slug,
      logo: gymUser.gym.logo,
      status: gymUser.gym.status,
      role: gymUser.role,
      joinedAt: gymUser.createdAt
    }));

    return {
      ...user,
      gyms: gymsData
    };
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    throw error;
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  data: {
    name?: string;
    phone?: string;
    avatar?: string;
  }
) {
  try {
    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: { 
        id: userId,
        isDeleted: false 
      }
    });

    if (!existingUser) {
      throw new Error('User not found');
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        phone: data.phone,
        avatar: data.avatar,
        updatedAt: new Date()
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        avatar: true,
        phone: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true
      }
    });

    console.log(`✅ User profile updated: ${updatedUser.email}`);
    return updatedUser;
  } catch (error) {
    console.error('Error in updateUserProfile:', error);
    throw error;
  }
}

/**
 * Change user password
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  try {
    // Get user with password
    const user = await prisma.user.findFirst({
      where: { 
        id: userId,
        isDeleted: false 
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        updatedAt: new Date()
      }
    });

    console.log(`✅ Password changed for user: ${user.email}`);
    return { success: true, message: 'Password changed successfully' };
  } catch (error) {
    console.error('Error in changePassword:', error);
    throw error;
  }
}

/**
 * Get user activity log
 */
export async function getUserActivity(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
  } = {}
) {
  try {
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const activities = await prisma.activityLog.findMany({
      where: {
        userId: userId
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset,
      select: {
        id: true,
        type: true,
        description: true,
        metadata: true,
        createdAt: true,
        lead: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        }
      }
    });

    // Get total count
    const total = await prisma.activityLog.count({
      where: {
        userId: userId
      }
    });

    return {
      activities,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    };
  } catch (error) {
    console.error('Error in getUserActivity:', error);
    throw error;
  }
}

/**
 * Get user statistics
 */
export async function getUserStats(userId: string, gymId?: string) {
  try {
    const user = await prisma.user.findFirst({
      where: { 
        id: userId,
        isDeleted: false 
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Build where clause for leads (based on gym if provided)
    const leadsWhere: any = {
      assignedToId: userId,
      isDeleted: false
    };

    if (gymId) {
      leadsWhere.gymId = gymId;
    }

    // Get lead statistics
    const totalLeads = await prisma.lead.count({
      where: leadsWhere
    });

    const closedLeads = await prisma.lead.count({
      where: {
        ...leadsWhere,
        status: 'CLOSED'
      }
    });

    const activeLeads = await prisma.lead.count({
      where: {
        ...leadsWhere,
        status: {
          in: ['NEW', 'CONTACTED', 'QUALIFIED', 'NEGOTIATING']
        }
      }
    });

    // Get follow-up statistics
    const pendingFollowUps = await prisma.followUp.count({
      where: {
        lead: {
          assignedToId: userId,
          isDeleted: false,
          ...(gymId && { gymId })
        },
        status: 'PENDING'
      }
    });

    const overdueFollowUps = await prisma.followUp.count({
      where: {
        lead: {
          assignedToId: userId,
          isDeleted: false,
          ...(gymId && { gymId })
        },
        status: 'OVERDUE'
      }
    });

    // Get conversation statistics
    const activeConversations = await prisma.conversation.count({
      where: {
        userId: userId,
        status: 'ACTIVE',
        isDeleted: false,
        lead: {
          isDeleted: false,
          ...(gymId && { gymId })
        }
      }
    });

    // Calculate conversion rate
    const conversionRate = totalLeads > 0 
      ? ((closedLeads / totalLeads) * 100).toFixed(2)
      : '0.00';

    return {
      leads: {
        total: totalLeads,
        active: activeLeads,
        closed: closedLeads,
        conversionRate: `${conversionRate}%`
      },
      followUps: {
        pending: pendingFollowUps,
        overdue: overdueFollowUps
      },
      conversations: {
        active: activeConversations
      }
    };
  } catch (error) {
    console.error('Error in getUserStats:', error);
    throw error;
  }
}

/**
 * Upload user avatar
 */
export async function uploadAvatar(userId: string, avatarUrl: string) {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        avatar: avatarUrl,
        updatedAt: new Date()
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true
      }
    });

    console.log(`✅ Avatar updated for user: ${updatedUser.email}`);
    return updatedUser;
  } catch (error) {
    console.error('Error in uploadAvatar:', error);
    throw error;
  }
}

/**
 * Delete user avatar
 */
export async function deleteAvatar(userId: string) {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        avatar: null,
        updatedAt: new Date()
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true
      }
    });

    console.log(`✅ Avatar deleted for user: ${updatedUser.email}`);
    return updatedUser;
  } catch (error) {
    console.error('Error in deleteAvatar:', error);
    throw error;
  }
}

