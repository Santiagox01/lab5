import { io, Socket } from 'socket.io-client';
import { API_URL } from './api';

export interface RealtimeOrderEvent {
  id: string;
  orderNumber: string;
  userId: string;
  status: string;
  paymentStatus: string;
  shippingMethod: string;
  trackingCode: string;
  total: number;
  destinationCity: string;
  updatedAt: string;
}

export interface RealtimeStockEvent {
  bookId: string;
  stock: number;
  available: boolean;
}

export function createLibroYaSocket(token: string): Socket {
  return io(API_URL, {
    auth: { token },
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1200,
    reconnectionDelayMax: 6000,
  });
}
