import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAuthToken, AuthUser } from '../middleware/auth';
import { IOrder } from '../models/Order';

export interface SocketOrderSummary {
  id: string;
  orderNumber: string;
  userId: string;
  status: string;
  paymentStatus: string;
  shippingMethod: string;
  trackingCode: string;
  total: number;
  items: Array<{
    bookId: string;
    title: string;
    format: string;
    quantity: number;
    unitPrice: number;
  }>;
  destinationCity: string;
  paidAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  updatedAt: Date;
}

export interface StockUpdatePayload {
  bookId: string;
  stock: number;
  available: boolean;
}

function parseCookieHeader(
  cookieHeader: string | undefined,
  name: string
): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const [k, ...rest] = pair.trim().split('=');
    if (k === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

function toOrderSummary(order: IOrder): SocketOrderSummary {
  return {
    id: String(order._id),
    orderNumber: order.orderNumber,
    userId: String(order.userId),
    status: order.status,
    paymentStatus: order.paymentStatus,
    shippingMethod: order.shippingMethod,
    trackingCode: order.trackingCode || '',
    total: order.total,
    items: order.items.map((it) => ({
      bookId: String(it.bookId),
      title: it.title,
      format: it.format,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
    })),
    // Solo ciudad/país para evitar difundir dirección completa innecesariamente
    destinationCity: `${order.shippingAddress.city}, ${order.shippingAddress.country}`,
    paidAt: order.paidAt,
    shippedAt: order.shippedAt,
    deliveredAt: order.deliveredAt,
    updatedAt: order.updatedAt,
  };
}

export class RealtimeHub {
  private io: SocketIOServer | null = null;

  attach(httpServer: HttpServer, allowedOrigins: string[]): SocketIOServer {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: (origin, callback) => {
          if (!origin) return callback(null, true);
          const normalized = origin.replace(/\/+$/, '');
          if (allowedOrigins.includes(normalized)) {
            return callback(null, true);
          }
          return callback(new Error('Origen WebSocket no permitido'));
        },
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.io.use((socket: Socket, next) => {
      try {
        const authToken =
          typeof socket.handshake.auth?.token === 'string'
            ? socket.handshake.auth.token
            : null;
        const headerToken =
          typeof socket.handshake.headers.authorization === 'string' &&
          socket.handshake.headers.authorization.startsWith('Bearer ')
            ? socket.handshake.headers.authorization.slice(7).trim()
            : null;
        const cookieToken = parseCookieHeader(
          socket.handshake.headers.cookie,
          'libroya_token'
        );

        const token = authToken || headerToken || cookieToken;
        if (!token) {
          return next(new Error('Autenticación WebSocket requerida'));
        }

        const user = verifyAuthToken(token);
        socket.data.user = user;
        return next();
      } catch {
        return next(new Error('Token WebSocket inválido o expirado'));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      const user = socket.data.user as AuthUser | undefined;
      if (!user) {
        socket.disconnect(true);
        return;
      }

      // Salas decididas exclusivamente por el servidor según identidad y rol
      socket.join(`user:${user.id}`);
      if (user.role === 'administrador') {
        socket.join('admin:shipments');
      }

      socket.emit('connection:ready', {
        userId: user.id,
        role: user.role,
      });
    });

    return this.io;
  }

  emitOrderCreated(order: IOrder): void {
    if (!this.io) return;
    const summary = toOrderSummary(order);
    this.io.to('admin:shipments').emit('order:created', summary);
    this.io.to(`user:${summary.userId}`).emit('order:updated', summary);
  }

  emitOrderStatusChanged(order: IOrder): void {
    if (!this.io) return;
    const summary = toOrderSummary(order);
    this.io.to('admin:shipments').emit('order:statusChanged', summary);
    this.io.to(`user:${summary.userId}`).emit('order:statusChanged', summary);
    this.io.to(`user:${summary.userId}`).emit('order:updated', summary);
  }

  emitStockUpdated(updates: StockUpdatePayload[]): void {
    if (!this.io || updates.length === 0) return;
    this.io.emit('stock:updated', updates);
  }

  close(): void {
    if (this.io) {
      this.io.close();
      this.io = null;
    }
  }
}
