import prisma from '../config/database';
import bcrypt from 'bcrypt';
import { softDelete } from '../utils/softDelete';

export interface CreateUserData {
  email: string;
  password: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'AGENT';
  phone?: string;
  gymIds?: string[]; // Array of gym IDs to assign user to
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  role?: 'ADMIN' | 'MANAGER' | 'AGENT';
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  phone?: string;
  gymIds?: string[]; // Array of gym IDs to assign user to (replaces existing assignments)
}

export interface UserFilters {
  search?: string;
  role?: string;
  status?: string;
  showDeleted?: boolean;
  limit?: number;
  offset?: number;
  accessibleGymIds?: string[]; // Gym IDs the requesting user can access
}

/**
 * Get all users with filtering and pagination
 * Filters by accessible gyms if provided (non-admin users)
 */
export async function getAllUsers(filters: UserFilters) {
  const {
    search,
    role,
    status,
    showDeleted = false,
    limit = 50,
    offset = 0,
    accessibleGymIds
  } = filters;

  const where: any = {};

  if (!showDeleted) {
    where.isDeleted = false;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } }
    ];
  }

  if (role && role !== 'all') {
    where.role = role;
  }

  if (status && status !== 'all') {
    where.status = status;
  }

  // Filter by accessible gyms if provided (for non-admin users)
  if (accessibleGymIds && accessibleGymIds.length > 0) {
    where.gyms = {
      some: {
        gymId: { in: accessibleGymIds }
      }
    };
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
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
        isDeleted: true,
        gyms: {
          select: {
            gymId: true,
            gym: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    }),
    prisma.user.count({ where })
  ]);

  return {
    users,
    total,
    hasMore: offset + limit < total
  };
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
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
      isDeleted: true,
      gyms: {
        select: {
          gymId: true,
          gym: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    }
  });

  if (!user) {
    throw new Error('User not found');
  }

  return user;
}

/**
 * Create a new user
 * For managers: Only one manager per gym, mark old gym as inactive if manager already exists
 */
export async function createUser(userData: CreateUserData, createdBy: string) {
  // Only allow MANAGER role creation from admin panel
  if (userData.role !== 'MANAGER') {
    throw new Error('Only MANAGER role can be created from user management page');
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: userData.email }
  });

  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  // Validate gymIds - should only have one gym for manager
  if (!userData.gymIds || userData.gymIds.length === 0) {
    throw new Error('Gym ID is required for manager');
  }

  if (userData.gymIds.length > 1) {
    throw new Error('Manager can only be assigned to one gym');
  }

  const gymId = userData.gymIds[0];

  // Check if there's already a manager for this gym
  const existingManager = await prisma.gymUser.findFirst({
    where: {
      gymId,
      role: 'MANAGER',
      user: {
        isDeleted: false,
        status: 'ACTIVE'
      }
    },
    include: {
      user: {
        include: {
          gyms: {
            where: {
              role: 'MANAGER'
            }
          }
        }
      }
    }
  });

  // If manager exists, find all their gyms and mark them as inactive
  if (existingManager && existingManager.user) {
    const managerGyms = await prisma.gymUser.findMany({
      where: {
        userId: existingManager.user.id,
        role: 'MANAGER'
      },
      include: {
        gym: true
      }
    });

    // Mark all gyms where this manager is assigned as inactive
    for (const gymUser of managerGyms) {
      if (gymUser.gym && gymUser.gym.status === 'ACTIVE') {
        await prisma.gym.update({
          where: { id: gymUser.gym.id },
          data: { status: 'INACTIVE' }
        });
        console.log(`⚠️  Marked gym ${gymUser.gym.id} (${gymUser.gym.name}) as INACTIVE - manager replaced`);
      }
    }
  }

  const hashedPassword = await bcrypt.hash(userData.password, 10);

  const user = await prisma.user.create({
    data: {
      email: userData.email,
      password: hashedPassword,
      name: userData.name,
      role: userData.role,
      status: 'ACTIVE',
      phone: userData.phone
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
      updatedAt: true
    }
  });

  // Validate that gym exists
  const gym = await prisma.gym.findUnique({
    where: {
      id: gymId,
      isDeleted: false
    },
    select: { id: true }
  });

  if (!gym) {
    throw new Error('Gym not found or has been deleted');
  }

  // Create gym-user association
  await prisma.gymUser.create({
    data: {
      userId: user.id,
      gymId,
      role: userData.role
    }
  });

  console.log(`✅ Manager created: ${user.email} for gym ${gymId} by ${createdBy}`);
  return user;
}

/**
 * Update user
 */
export async function updateUser(userId: string, userData: UpdateUserData, updatedBy: string) {
  const existingUser = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!existingUser) {
    throw new Error('User not found');
  }

  if (userData.email && userData.email !== existingUser.email) {
    const emailExists = await prisma.user.findUnique({
      where: { email: userData.email }
    });

    if (emailExists) {
      throw new Error('Email already exists');
    }
  }

  // Extract gymIds from userData before updating user (since it's not a user field)
  const gymIds = userData.gymIds;
  const { gymIds: _, ...updateData } = userData;

  const user = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      avatar: true,
      phone: true,
      createdAt: true,
      updatedAt: true
    }
  });

  // Handle gym assignments if provided
  if (gymIds !== undefined) {
    // Delete all existing gym-user associations
    await prisma.gymUser.deleteMany({
      where: { userId }
    });

    // Create new gym-user associations if gymIds array is not empty
    if (gymIds.length > 0) {
      // Validate that all gyms exist
      const gyms = await prisma.gym.findMany({
        where: {
          id: { in: gymIds },
          isDeleted: false
        },
        select: { id: true }
      });

      if (gyms.length !== gymIds.length) {
        throw new Error('One or more gym IDs are invalid');
      }

      // Create gym-user associations with updated role
      await prisma.gymUser.createMany({
        data: gymIds.map(gymId => ({
          userId,
          gymId,
          role: userData.role || existingUser.role
        })),
        skipDuplicates: true
      });

      console.log(`✅ User assigned to ${gyms.length} gym(s)`);
    } else {
      console.log(`✅ All gym assignments removed for user ${userId}`);
    }
  }

  console.log(`✅ User updated: ${user.email} by ${updatedBy}`);
  return user;
}

/**
 * Delete user (soft delete)
 */
export async function deleteUser(userId: string, deletedBy: string) {
  await softDelete(prisma.user, userId, deletedBy);
  console.log(`🗑️ User soft deleted: ${userId} by ${deletedBy}`);
}

/**
 * Bulk update user status
 */
export async function bulkUpdateUserStatus(userIds: string[], status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED', updatedBy: string) {
  await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: { status, updatedAt: new Date() }
  });

  console.log(`✅ Bulk status update: ${userIds.length} users updated to ${status} by ${updatedBy}`);
}

/**
 * Bulk delete users (soft delete)
 */
export async function bulkDeleteUsers(userIds: string[], deletedBy: string) {
  await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy
    }
  });

  console.log(`🗑️ Bulk delete: ${userIds.length} users soft deleted by ${deletedBy}`);
}

/**
 * Get user statistics
 */
export async function getUserStatistics() {
  const [
    totalUsers,
    activeUsers,
    inactiveUsers,
    suspendedUsers,
    adminUsers,
    managerUsers,
    agentUsers
  ] = await Promise.all([
    prisma.user.count({ where: { isDeleted: false } }),
    prisma.user.count({ where: { status: 'ACTIVE', isDeleted: false } }),
    prisma.user.count({ where: { status: 'INACTIVE', isDeleted: false } }),
    prisma.user.count({ where: { status: 'SUSPENDED', isDeleted: false } }),
    prisma.user.count({ where: { role: 'ADMIN', isDeleted: false } }),
    prisma.user.count({ where: { role: 'MANAGER', isDeleted: false } }),
    prisma.user.count({ where: { role: 'AGENT', isDeleted: false } })
  ]);

  return {
    totalUsers,
    activeUsers,
    inactiveUsers,
    suspendedUsers,
    adminUsers,
    managerUsers,
    agentUsers,
    activePercentage: totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0
  };
}
