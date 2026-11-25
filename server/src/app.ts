import http from 'http';
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import { createBooksRouter } from './routes/books';
import { createOrdersRouter } from './routes/orders';
import { createPaymentsRouter } from './routes/payments';
import {
  PayPalGateway,
  SandboxPayPalGateway,
} from './services/paypalService';
import { RealtimeHub } from './socket/io';

export interface AppInstance {
  app: Express;
  httpServer: http.Server;
  realtime: RealtimeHub;
}

export function createApp(options?: {
  paypalGateway?: PayPalGateway;
  allowedOrigins?: string[];
}): AppInstance {
  const app = express();
  const httpServer = http.createServer(app);
  const realtime = new RealtimeHub();
  const allowedOrigins = options?.allowedOrigins || env.clientOrigins;
  const paypalGateway = options?.paypalGateway || new SandboxPayPalGateway();

  realtime.attach(httpServer, allowedOrigins);

  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const normalized = origin.replace(/\/+$/, '');
        if (allowedOrigins.includes(normalized)) {
          return callback(null, true);
        }
        return callback(new Error('Origen CORS no autorizado.'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/health', (_req: Request, res: Response) => {
    const dbConnected = mongoose.connection.readyState === 1;
    res.status(200).json({
      status: 'ok',
      service: 'libroya-api',
      db: dbConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/books', createBooksRouter(realtime));
  app.use('/api/orders', createOrdersRouter(realtime));
  app.use('/api/payments', createPaymentsRouter(paypalGateway, realtime));

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Ruta de API no encontrada.' });
  });

  app.use(errorHandler);

  return { app, httpServer, realtime };
}
