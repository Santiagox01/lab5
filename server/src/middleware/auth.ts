import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User, UserRole } from '../models/User';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface JwtPayloadShape {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
}

export function signAuthToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    env.jwtSecret,
    { expiresIn: '7d' }
  );
}

export function verifyAuthToken(token: string): AuthUser {
  const decoded = jwt.verify(token, env.jwtSecret) as JwtPayloadShape;
  if (!decoded || !decoded.sub || !decoded.role) {
    throw new Error('Token inválido');
  }
  return {
    id: String(decoded.sub),
    email: decoded.email,
    name: decoded.name,
    role: decoded.role,
  };
}

export function extractTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  const cookieToken = req.cookies?.libroya_token;
  if (typeof cookieToken === 'string' && cookieToken.trim()) {
    return cookieToken.trim();
  }
  return null;
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractTokenFromRequest(req);
    if (!token) {
      res.status(401).json({ error: 'Autenticación requerida.' });
      return;
    }

    const decoded = verifyAuthToken(token);
    const dbUser = await User.findById(decoded.id);
    if (!dbUser) {
      res.status(401).json({ error: 'Sesión inválida o usuario inexistente.' });
      return;
    }

    req.user = {
      id: String(dbUser._id),
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado.' });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Autenticación requerida.' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'No tienes permisos suficientes para realizar esta acción.',
      });
      return;
    }
    next();
  };
}
