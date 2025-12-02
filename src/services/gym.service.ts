import prisma from '../config/database';
import { softDelete } from '../utils/softDelete';

export interface CreateGymData {
  name: string;
  slug: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  email?: string;
  logo?: string;
  settings?: any;
}

export interface UpdateGymData {
  name?: string;
  slug?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  email?: string;
  logo?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'TRIAL';
  settings?: any;
}

export interface GymFilters {
  search?: string;
  status?: string;
  showDeleted?: boolean;
  limit?: number;
  offset?: number;
  accessibleGymIds?: string[]; // Gym IDs the requesting user can access
}

/**
 * Get all gyms with filtering
 */
export async function getAllGyms(filters: GymFilters = {}) {
  const {
    search,
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

  // Filter by accessible gyms if provided (for non-admin users)
  if (accessibleGymIds && accessibleGymIds.length > 0) {
    where.id = { in: accessibleGymIds };
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } }
    ];
  }

  if (status && status !== 'all') {
    where.status = status;
  }

  const [gyms, total] = await Promise.all([
    prisma.gym.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        phone: true,
        email: true,
        logo: true,
        status: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
        isDeleted: true,
        _count: {
          select: {
            users: true,
            leads: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    }),
    prisma.gym.count({ where })
  ]);

  return {
    gyms,
    total,
    hasMore: offset + limit < total
  };
}

/**
 * Get gym by ID
 */
export async function getGymById(gymId: string) {
  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    include: {
      aiPrompts: true,
      _count: {
        select: {
          users: true,
          leads: true,
          whatsappAccounts: true
        }
      }
    }
  });

  if (!gym) {
    throw new Error('Gym not found');
  }

  return gym;
}

/**
 * Get gym by slug
 */
export async function getGymBySlug(slug: string) {
  const gym = await prisma.gym.findUnique({
    where: { slug }
  });

  if (!gym) {
    throw new Error('Gym not found');
  }

  return gym;
}

/**
 * Create new gym
 */
export async function createGym(gymData: CreateGymData, createdBy: string) {
  // Check if slug already exists
  const existing = await prisma.gym.findUnique({
    where: { slug: gymData.slug }
  });

  if (existing) {
    throw new Error('Gym with this slug already exists');
  }

  const gym = await prisma.gym.create({
    data: {
      name: gymData.name,
      slug: gymData.slug,
      address: gymData.address,
      city: gymData.city,
      state: gymData.state,
      zipCode: gymData.zipCode,
      phone: gymData.phone,
      email: gymData.email,
      logo: gymData.logo,
      status: 'ACTIVE',
      settings: gymData.settings || {}
    }
  });

  console.log(`✅ Gym created: ${gym.name} by ${createdBy}`);
  return gym;
}

/**
 * Update gym
 */
export async function updateGym(gymId: string, gymData: UpdateGymData, updatedBy: string) {
  const existing = await prisma.gym.findUnique({
    where: { id: gymId }
  });

  if (!existing) {
    throw new Error('Gym not found');
  }

  // Check slug uniqueness if being updated
  if (gymData.slug && gymData.slug !== existing.slug) {
    const slugExists = await prisma.gym.findUnique({
      where: { slug: gymData.slug }
    });

    if (slugExists) {
      throw new Error('Slug already exists');
    }
  }

  const gym = await prisma.gym.update({
    where: { id: gymId },
    data: gymData
  });

  console.log(`✅ Gym updated: ${gym.name} by ${updatedBy}`);
  return gym;
}

/**
 * Delete gym (soft delete)
 */
export async function deleteGym(gymId: string, deletedBy: string) {
  await softDelete(prisma.gym, gymId, deletedBy);
  console.log(`🗑️ Gym soft deleted: ${gymId} by ${deletedBy}`);
}

/**
 * Get gym statistics
 */
export async function getGymStatistics() {
  const [
    totalGyms,
    activeGyms,
    inactiveGyms,
    trialGyms
  ] = await Promise.all([
    prisma.gym.count({ where: { isDeleted: false } }),
    prisma.gym.count({ where: { status: 'ACTIVE', isDeleted: false } }),
    prisma.gym.count({ where: { status: 'INACTIVE', isDeleted: false } }),
    prisma.gym.count({ where: { status: 'TRIAL', isDeleted: false } })
  ]);

  return {
    totalGyms,
    activeGyms,
    inactiveGyms,
    trialGyms
  };
}

/**
 * Update gym settings (JSON field)
 */
export async function updateGymSettings(gymId: string, settings: any, updatedBy: string) {
  const gym = await prisma.gym.update({
    where: { id: gymId },
    data: {
      settings: settings
    }
  });

  console.log(`✅ Gym settings updated: ${gymId} by ${updatedBy}`);
  return gym;
}
