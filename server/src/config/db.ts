import mongoose from 'mongoose';

/**
 * Conecta Mongoose a MongoDB sin exponer la URI ni credenciales en los logs.
 */
export async function connectDB(uri: string): Promise<typeof mongoose> {
  if (!uri) {
    throw new Error('No se proporcionó MONGODB_URI para conectar con MongoDB.');
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    const dbName = conn.connection.name || 'libroya';
    console.log(`MongoDB conectado correctamente (base de datos: ${dbName})`);
    return conn;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error desconocido de red';
    throw new Error(
      `No fue posible conectar con MongoDB (verifica Network Access, credenciales y estado del clúster): ${message}`
    );
  }
}

export async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
