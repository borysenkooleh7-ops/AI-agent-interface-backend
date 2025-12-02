import prisma from '../config/database';

/**
 * Get list of gym IDs that a user can access
 * - ADMINs can access all gyms
 * - Other users can only access gyms they're assigned to
 */
export async function getUserAccessibleGymIds(userId: string, userRole: string): Promise<string[]> {
  if (userRole === 'ADMIN') {
    // Admins can access all gyms
    const allGyms = await prisma.gym.findMany({
      where: { isDeleted: false },
      select: { id: true }
    });
    return allGyms.map(gym => gym.id);
  }

  // Other users can only access assigned gyms
  const userGyms = await prisma.gymUser.findMany({
    where: { userId },
    select: { gymId: true }
  });

  return userGyms.map(ug => ug.gymId);
}

/**
 * Check if user has access to a specific gym
 */
export async function hasGymAccess(userId: string, userRole: string, gymId: string): Promise<boolean> {
  if (userRole === 'ADMIN') {
    // Check if gym exists and is not deleted
    const gym = await prisma.gym.findFirst({
      where: { id: gymId, isDeleted: false }
    });
    return !!gym;
  }

  // Check if user is assigned to this gym
  const userGym = await prisma.gymUser.findFirst({
    where: { userId, gymId }
  });

  return !!userGym;
}

