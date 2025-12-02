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
