import prisma from '../config/database';

export interface CreatePlanData {
  gymId: string;
  name: string;
  description?: string;
  price: number;
  duration: number; // Duration in days
  features?: any;
  active?: boolean;
}

export interface UpdatePlanData {
  name?: string;
  description?: string;
  price?: number;
  duration?: number;
  features?: any;
  active?: boolean;
}

export interface PlanFilters {
  gymId?: string;
  active?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
  accessibleGymIds?: string[];
}

/**
 * Get all plans with filtering
 */
export async function getAllPlans(filters: PlanFilters = {}) {
  const {
    gymId,
    active,
    search,
    limit = 50,
    offset = 0,
    accessibleGymIds
  } = filters;

  const where: any = {};

  // Filter by accessible gyms if provided
  if (accessibleGymIds && accessibleGymIds.length > 0) {
    where.gymId = { in: accessibleGymIds };
  }

  if (gymId) {
    where.gymId = gymId;
  }

  if (active !== undefined) {
    where.active = active;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } }
    ];
  }

  const [plans, total] = await Promise.all([
    prisma.plan.findMany({
      where,
      include: {
        gym: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    }),
    prisma.plan.count({ where })
  ]);

  return {
    plans,
    total,
    hasMore: offset + limit < total
  };
}

/**
 * Get plan by ID
 */
export async function getPlanById(planId: string) {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      gym: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      }
    }
  });

  if (!plan) {
    throw new Error('Plan not found');
  }

  return plan;
}

/**
 * Get plans by gym ID
 */
export async function getPlansByGymId(gymId: string) {
  const plans = await prisma.plan.findMany({
    where: { gymId },
    orderBy: { createdAt: 'desc' }
  });

  return plans;
}

/**
 * Create new plan
 */
export async function createPlan(planData: CreatePlanData, createdBy: string) {
  // Verify gym exists
  const gym = await prisma.gym.findUnique({
    where: { id: planData.gymId }
  });

  if (!gym) {
    throw new Error('Gym not found');
  }

  const plan = await prisma.plan.create({
    data: {
      gymId: planData.gymId,
      name: planData.name,
      description: planData.description,
      price: planData.price,
      duration: planData.duration,
      features: planData.features || [],
      active: planData.active !== undefined ? planData.active : true
    },
    include: {
      gym: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      }
    }
  });

  console.log(`✅ Plan created: ${plan.name} for gym ${gym.name} by ${createdBy}`);
  return plan;
}

/**
 * Update plan
 */
export async function updatePlan(planId: string, planData: UpdatePlanData, updatedBy: string) {
  const existing = await prisma.plan.findUnique({
    where: { id: planId }
  });

  if (!existing) {
    throw new Error('Plan not found');
  }

  const plan = await prisma.plan.update({
    where: { id: planId },
    data: planData,
    include: {
      gym: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      }
    }
  });

  console.log(`✅ Plan updated: ${plan.name} by ${updatedBy}`);
  return plan;
}

/**
 * Delete plan
 */
export async function deletePlan(planId: string, deletedBy: string) {
  const plan = await prisma.plan.findUnique({
    where: { id: planId }
  });

  if (!plan) {
    throw new Error('Plan not found');
  }

  await prisma.plan.delete({
    where: { id: planId }
  });

  console.log(`🗑️ Plan deleted: ${plan.name} by ${deletedBy}`);
}

