import prisma from '../config/database';

export interface AdvantagePayload {
  title?: string;
  description?: string | null;
  order?: number;
}

export async function getAdvantagesByGym(gymId: string) {
  return prisma.gymAdvantage.findMany({
    where: { gymId },
    orderBy: [
      { order: 'asc' },
      { createdAt: 'asc' }
    ]
  });
}

export async function getAdvantageById(advantageId: string) {
  return prisma.gymAdvantage.findUnique({
    where: { id: advantageId }
  });
}

export async function createAdvantage(gymId: string, payload: AdvantagePayload) {
  let orderValue = payload.order;

  if (orderValue === undefined || orderValue === null) {
    const count = await prisma.gymAdvantage.count({ where: { gymId } });
    orderValue = count + 1;
  }

  return prisma.gymAdvantage.create({
    data: {
      gymId,
      title: payload.title as string,
      description: payload.description,
      order: orderValue
    }
  });
}

export async function updateAdvantage(advantageId: string, payload: AdvantagePayload) {
  return prisma.gymAdvantage.update({
    where: { id: advantageId },
    data: payload
  });
}

export async function deleteAdvantage(advantageId: string) {
  await prisma.gymAdvantage.delete({
    where: { id: advantageId }
  });
}

