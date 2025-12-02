import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import logger from '../utils/logger';

const prisma = new PrismaClient();

export interface CreateInvitationData {
  email: string;
  gymId: string;
  role: 'ADMIN' | 'MANAGER' | 'AGENT';
  invitedBy: string;
  expiresInDays?: number;
}

export interface InvitationData {
  id: string;
  code: string;
  email: string;
  gymName: string;
  role: string;
  inviterName: string;
  expiresAt: Date;
  usedAt?: Date | null;
}

/**
 * Generate a unique invitation code
 */
function generateInvitationCode(): string {
  return randomBytes(8).toString('hex').toUpperCase();
}

/**
 * Create a new invitation
 */
export async function createInvitation(data: CreateInvitationData): Promise<InvitationData> {
  const { email, gymId, role, invitedBy, expiresInDays = 7 } = data;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  // Check if there's already a pending invitation for this email
  const existingInvitation = await prisma.invitation.findFirst({
    where: {
      email: email.toLowerCase(),
      usedAt: null,
      expiresAt: {
        gt: new Date()
      }
    },
    include: {
      gym: true,
      inviter: true
    }
  });

  if (existingInvitation) {
    throw new Error('Pending invitation already exists for this email');
  }

  // Generate unique code
  let code: string;
  let isUnique = false;
  let attempts = 0;
  
  while (!isUnique && attempts < 10) {
    code = generateInvitationCode();
    const existing = await prisma.invitation.findUnique({
      where: { code }
    });
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new Error('Failed to generate unique invitation code');
  }

  // Calculate expiration date
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  // Create invitation
  const invitation = await prisma.invitation.create({
    data: {
      code: code!,
      email: email.toLowerCase(),
      gymId,
      role,
      invitedBy,
      expiresAt,
    },
    include: {
      gym: true,
      inviter: true
    }
  });

  logger.info(`Invitation created: ${email} -> ${invitation.gym.name} (${role})`);

  return {
    id: invitation.id,
    code: invitation.code,
    email: invitation.email,
    gymName: invitation.gym.name,
    role: invitation.role,
    inviterName: invitation.inviter.name,
    expiresAt: invitation.expiresAt,
    usedAt: invitation.usedAt,
  };
}

/**
 * Validate an invitation code
 */
export async function validateInvitation(code: string): Promise<InvitationData | null> {
  const invitation = await prisma.invitation.findUnique({
    where: { code },
    include: {
      gym: true,
      inviter: true
    }
  });

  if (!invitation) {
    return null;
  }

  // Check if invitation is expired
  if (invitation.expiresAt < new Date()) {
    throw new Error('Invitation has expired');
  }

  // Check if invitation is already used
  if (invitation.usedAt) {
    throw new Error('Invitation has already been used');
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: invitation.email },
  });

  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  return {
    id: invitation.id,
    code: invitation.code,
    email: invitation.email,
    gymName: invitation.gym.name,
    role: invitation.role,
    inviterName: invitation.inviter.name,
    expiresAt: invitation.expiresAt,
    usedAt: invitation.usedAt,
  };
}

/**
 * Accept an invitation and create user
 */
export async function acceptInvitation(
  code: string,
  userData: {
    name: string;
    password: string;
    phone?: string;
  }
): Promise<{ user: any; token: string }> {
  const invitation = await validateInvitation(code);
  
  if (!invitation) {
    throw new Error('Invalid invitation code');
  }

  // Import required modules
  const bcrypt = await import('bcrypt');

  // Hash password
  const hashedPassword = await bcrypt.hash(userData.password, 10);

  // Create user
  const user = await prisma.user.create({
    data: {
      email: invitation.email,
      password: hashedPassword,
      name: userData.name,
      role: invitation.role as any,
      status: 'ACTIVE',
      phone: userData.phone,
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

  // Get the gym ID from the invitation
  const invitationRecord = await prisma.invitation.findUnique({
    where: { id: invitation.id },
    select: { gymId: true }
  });

  if (!invitationRecord) {
    throw new Error('Invitation not found');
  }

  // Assign user to gym
  await prisma.gymUser.create({
    data: {
      userId: user.id,
      gymId: invitationRecord.gymId,
      role: invitation.role as any,
    }
  });

  // Mark invitation as used
  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { usedAt: new Date() }
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

  logger.info(`Invitation accepted: ${user.email} joined ${invitation.gymName}`);

  return { user, token };
}

/**
 * Get invitations for a gym
 */
export async function getGymInvitations(gymId: string): Promise<InvitationData[]> {
  const invitations = await prisma.invitation.findMany({
    where: { 
      gymId,
      isDeleted: false
    },
    include: {
      gym: true,
      inviter: true
    },
    orderBy: { createdAt: 'desc' }
  });

  return invitations.map(invitation => ({
    id: invitation.id,
    code: invitation.code,
    email: invitation.email,
    gymName: invitation.gym.name,
    role: invitation.role,
    inviterName: invitation.inviter.name,
    expiresAt: invitation.expiresAt,
    usedAt: invitation.usedAt,
  }));
}

/**
 * Cancel an invitation
 */
export async function cancelInvitation(invitationId: string, cancelledBy: string): Promise<void> {
  await prisma.invitation.update({
    where: { id: invitationId },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: cancelledBy
    }
  });

  logger.info(`Invitation cancelled: ${invitationId}`);
}

/**
 * Resend invitation (extend expiration)
 */
export async function resendInvitation(invitationId: string, expiresInDays: number = 7): Promise<InvitationData> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const invitation = await prisma.invitation.update({
    where: { id: invitationId },
    data: { expiresAt },
    include: {
      gym: true,
      inviter: true
    }
  });

  logger.info(`Invitation resent: ${invitation.email}`);

  return {
    id: invitation.id,
    code: invitation.code,
    email: invitation.email,
    gymName: invitation.gym.name,
    role: invitation.role,
    inviterName: invitation.inviter.name,
    expiresAt: invitation.expiresAt,
    usedAt: invitation.usedAt,
  };
}
