import { PrismaClient } from '@prisma/client';
import { softDeleteMiddleware } from '../middleware/prisma.middleware';

// Prisma Client instance
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
});

// Apply soft delete middleware
prisma.$use(softDeleteMiddleware);

// Handle Prisma Client lifecycle
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;

