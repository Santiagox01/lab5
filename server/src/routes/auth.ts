import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { env } from '../config/env';
import { User } from '../models/User';
import { authenticate, signAuthToken } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimit';

const registerSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres.').max(100),
  email: z.string().trim().email('Correo electrónico inválido.').toLowerCase(),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres.')
    .max(100),
});

const loginSchema = z.object({
  email: z.string().trim().email('Correo electrónico inválido.').toLowerCase(),
  password: z.string().min(1, 'Debes ingresar tu contraseña.').max(100),
});

function setAuthCookie(res: Response, token: string): void {
  res.cookie('libroya_token', token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export const authRouter = Router();

authRouter.post(
  '/register',
  authRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = registerSchema.parse(req.body);

      const existing = await User.findOne({ email: parsed.email });
      if (existing) {
        res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
        return;
      }

      const passwordHash = await bcrypt.hash(parsed.password, 10);

      // El rol siempre lo asigna el servidor (nunca confiar en el cliente)
      const user = await User.create({
        name: parsed.name,
        email: parsed.email,
        passwordHash,
        role: 'cliente',
      });

      const token = signAuthToken({
        id: String(user._id),
        email: user.email,
        name: user.name,
        role: user.role,
      });

      setAuthCookie(res, token);
      res.status(201).json({
        token,
        user: user.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }
);

authRouter.post(
  '/login',
  authRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = loginSchema.parse(req.body);

      const user = await User.findOne({ email: parsed.email }).select(
        '+passwordHash'
      );

      if (!user) {
        res.status(401).json({ error: 'Credenciales inválidas.' });
        return;
      }

      const validPassword = await bcrypt.compare(
        parsed.password,
        user.passwordHash
      );

      if (!validPassword) {
        res.status(401).json({ error: 'Credenciales inválidas.' });
        return;
      }

      const token = signAuthToken({
        id: String(user._id),
        email: user.email,
        name: user.name,
        role: user.role,
      });

      setAuthCookie(res, token);
      res.status(200).json({
        token,
        user: user.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }
);

authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('libroya_token', {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? 'none' : 'lax',
    path: '/',
  });
  res.status(200).json({ ok: true });
});

authRouter.get(
  '/me',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await User.findById(req.user!.id);
      if (!user) {
        res.status(404).json({ error: 'Usuario no encontrado.' });
        return;
      }
      res.status(200).json({ user: user.toJSON() });
    } catch (error) {
      next(error);
    }
  }
);
