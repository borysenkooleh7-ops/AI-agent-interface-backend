#!/bin/bash

echo "Creating authentication files..."

# Remove existing files
rm -f src/services/auth.service.ts
rm -f src/controllers/auth.controller.ts  
rm -f src/middleware/auth.middleware.ts
rm -f src/types/auth.types.ts
rm -f src/middleware/validate.middleware.ts
rm -f src/routes/auth.routes.ts

# Create auth.types.ts
cat > src/types/auth.types.ts << 'TYPES'
export interface RegisterDTO {
  email: string;
  password: string;
  name: string;
  role?: 'ADMIN' | 'MANAGER' | 'AGENT';
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  avatar?: string | null;
  phone?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  user: UserResponse;
  token: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}
TYPES

echo "Created auth.types.ts"

# Success
echo "Authentication files created successfully!"
ls -lh src/types/auth.types.ts

