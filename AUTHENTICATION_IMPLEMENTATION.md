# 🔐 Authentication Implementation - Complete Code

## ⚠️ Important Note

Due to file system issues, please manually create these files by copying the code below.

---

## 📁 File 1: `src/services/auth.service.ts`

Create this file and paste the following code:

```typescript
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { RegisterDTO, LoginDTO, JWTPayload, AuthResponse, UserResponse } from '../types/auth.types';
import logger from '../utils/logger';

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function sanitizeUser(user: any): UserResponse {
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePasswords(plainPassword: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(plainPassword, hashedPassword);
}

export function generateToken(payload: Record<string, any>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

export async function register(data: RegisterDTO): Promise<AuthResponse> {
  const { email, password, name, role = 'AGENT' } = data;

  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existingUser) {
    throw new Error('Email already registered');
  }

  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      role,
      status: 'ACTIVE',
    },
  });

  logger.info('New user registered: ' + user.email + ' (' + user.role + ')');

  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    user: sanitizeUser(user),
    token,
  };
}

export async function login(data: LoginDTO): Promise<AuthResponse> {
  const { email, password } = data;

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  if (user.status !== 'ACTIVE') {
    throw new Error('Account is inactive or suspended');
  }

  const isPasswordValid = await comparePasswords(password, user.password);

  if (!isPasswordValid) {
    throw new Error('Invalid credentials');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  logger.info('User logged in: ' + user.email);

  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    user: sanitizeUser(user),
    token,
  };
}

export async function getUserById(userId: string): Promise<UserResponse | null> {
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
```

---

## 📁 File 2: `src/middleware/auth.middleware.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import logger from '../utils/logger';

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        message: 'No token provided',
      });
      return;
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401).json({
        success: false,
        message: 'Invalid token format. Use: Bearer <token>',
      });
      return;
    }

    const token = parts[1];
    const payload = authService.verifyToken(token);
    req.user = payload;

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};

export const authorize = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      });
      return;
    }

    next();
  };
};
```

---

## 📁 File 3: `src/middleware/validate.middleware.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

export const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Invalid request data',
        });
      }
    }
  };
};

export const authSchemas = {
  register: z.object({
    email: z.string().email('Invalid email format'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    name: z.string().min(2, 'Name must be at least 2 characters'),
    role: z.enum(['ADMIN', 'MANAGER', 'AGENT']).optional(),
  }),

  login: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  }),
};
```

---

## 📁 File 4: `src/controllers/auth.controller.ts`

```typescript
import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { RegisterDTO, LoginDTO } from '../types/auth.types';
import logger from '../utils/logger';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const data: RegisterDTO = req.body;
    const result = await authService.register(data);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result,
    });
  } catch (error: any) {
    logger.error('Registration error:', error.message);
    const statusCode = error.message.includes('already registered') ? 409 : 400;

    res.status(statusCode).json({
      success: false,
      message: error.message || 'Registration failed',
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const data: LoginDTO = req.body;
    const result = await authService.login(data);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  } catch (error: any) {
    logger.error('Login error:', error.message);

    res.status(401).json({
      success: false,
      message: error.message || 'Login failed',
    });
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    const user = await authService.getUserById(req.user.userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    logger.error('Get user error:', error.message);

    res.status(500).json({
      success: false,
      message: 'Failed to get user data',
    });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('User logged out: ' + (req.user?.email || 'unknown'));

    res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error: any) {
    logger.error('Logout error:', error.message);

    res.status(500).json({
      success: false,
      message: 'Logout failed',
    });
  }
};
```

---

## 📁 File 5: `src/routes/auth.routes.ts`

```typescript
import { Router } from 'express';
import { register, login, getMe, logout } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate, authSchemas } from '../middleware/validate.middleware';

const router = Router();

router.post('/register', validate(authSchemas.register), register);
router.post('/login', validate(authSchemas.login), login);
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);

export default router;
```

---

## 📁 File 6: Update `src/server.ts`

Make sure these lines are present:

```typescript
// At the top with other imports
import authRoutes from './routes/auth.routes';

// In the routes section (before 404 handler)
app.use('/api/auth', authRoutes);
```

---

## 🧪 Testing Commands

After creating all files manually:

### 1. Compile Check
```bash
cd /home/cobi/Documents/DuxFit/backend
npx tsc --noEmit
```

Should show no errors.

### 2. Start Server
```bash
npm run dev
```

Should show the DuxFit banner.

### 3. Test Registration
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@duxfit.com",
    "password": "Admin@123",
    "name": "Admin User",
    "role": "ADMIN"
  }'
```

Expected: `{ "success": true, ... }`

### 4. Test Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@duxfit.com",
    "password": "Admin@123"
  }'
```

Save the token from response!

### 5. Test Protected Route
```bash
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

##  📝 Manual Creation Steps

1. Open Cursor
2. Create each file listed above
3. Copy-paste the complete code for each file
4. Save all files
5. Run `npx tsc --noEmit` to check for errors
6. Run `npm run dev` to start server
7. Test with the curl commands above

---

**All code is ready above. Copy-paste each file manually to avoid file system issues!** 🚀

