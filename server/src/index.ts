import { env, assertRuntimeEnv } from './config/env';
import { connectDB, disconnectDB } from './config/db';
import { createApp } from './app';

async function bootstrap(): Promise<void> {
  assertRuntimeEnv();
  await connectDB(env.mongodbUri);

  const { httpServer, realtime } = createApp();

  httpServer.listen(env.port, '0.0.0.0', () => {
    console.log(
      `LibroYa API + Socket.IO escuchando en http://0.0.0.0:${env.port} (entorno: ${env.nodeEnv})`
    );
  });

  const shutdown = async (signal: string) => {
    console.log(`Recibida señal ${signal}, cerrando servidor LibroYa...`);
    realtime.close();
    httpServer.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  const msg = err instanceof Error ? err.message : 'Error fatal al iniciar';
  console.error('[BOOTSTRAP ERROR]', msg);
  process.exit(1);
});
