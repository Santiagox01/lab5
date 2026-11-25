import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const isTest = nodeEnv === 'test';

const rawOrigins = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
const clientOrigins = rawOrigins
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

export const env = {
  nodeEnv,
  isTest,
  isProd: nodeEnv === 'production',
  port: Number(process.env.PORT) || 4000,
  mongodbUri: process.env.MONGODB_URI || '',
  jwtSecret:
    process.env.JWT_SECRET ||
    (isTest ? 'libroya-vitest-deterministic-secret-key-2026' : ''),
  clientOrigins,
  paypalClientId: process.env.PAYPAL_CLIENT_ID || '',
  paypalClientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
  paypalApiBase: (
    process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com'
  ).replace(/\/+$/, ''),
};

export function assertRuntimeEnv(): void {
  if (!env.mongodbUri) {
    throw new Error('Falta la variable de entorno MONGODB_URI en el backend.');
  }
  if (!env.jwtSecret || env.jwtSecret.length < 16) {
    throw new Error(
      'Falta JWT_SECRET o es demasiado corto (mínimo 16 caracteres).'
    );
  }
}
