import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { RegisterDTO, LoginDTO, JWTPayload } from '../types/auth.types';
import logger from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '24h';

/**
 * Register a new user
 */
export async function register(data: RegisterDTO) {
  const { email, password, name, role = 'AGENT' } = data;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error('User with this email is already registered');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      role,
      status: 'ACTIVE',
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

  // Generate JWT token
  const token = generateToken(user);

  logger.info(`New user registered: ${user.email}`);

  return { user, token };
}

/**
 * Login user
 */
export async function login(data: LoginDTO) {
  const { email, password } = data;

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
  });

  // If user doesn't exist, check registration requests
  if (!user) {
    const registrationRequest = await prisma.registrationRequest.findFirst({
      where: {
        email: email.toLowerCase(),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (registrationRequest) {
      // Verify password to ensure it's the correct user
      const isPasswordValid = await bcrypt.compare(password, registrationRequest.password);
      
      if (isPasswordValid) {
        if (registrationRequest.status === 'PENDING') {
          throw new Error('REGISTRATION_PENDING');
        } else if (registrationRequest.status === 'REJECTED') {
          throw new Error('REGISTRATION_REJECTED');
        }
      }
    }
    
    // If no registration request or password doesn't match, throw invalid credentials
    throw new Error('Invalid email or password');
  }

  // Check if user is active
  if (user.status !== 'ACTIVE') {
    throw new Error('Account is inactive. Please contact support.');
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new Error('Invalid email or password');
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  // Generate JWT token
  const token = generateToken(user);

  // Return user without password
  const { password: _, ...userWithoutPassword } = user;

  logger.info(`User logged in: ${user.email}`);

  return { user: userWithoutPassword, token };
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
    },
  });

  return user;
}

/**
 * Generate JWT token
 */
function generateToken(user: any): string {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRATION,
  } as jwt.SignOptions);

  return token;
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

