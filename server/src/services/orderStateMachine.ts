import { OrderStatus, ShippingMethod } from '../models/Order';

export const ADMIN_ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: [],
  PAID: ['PREPARING'],
  PREPARING: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Pendiente de pago',
  PAID: 'Pendiente',
  PREPARING: 'En preparación',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

export const SHIPPING_PRICES: Record<ShippingMethod, number> = {
  DIGITAL_INSTANT: 0,
  STANDARD: 4.99,
  EXPRESS: 9.99,
};

export const SHIPPING_LABELS: Record<ShippingMethod, string> = {
  DIGITAL_INSTANT: 'Entrega digital instantánea',
  STANDARD: 'Envío estándar (edición + kit lector)',
  EXPRESS: 'Envío express prioritario',
};

export function canAdminTransition(from: OrderStatus, to: OrderStatus): boolean {
  const allowed = ADMIN_ALLOWED_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export function generateTrackingCode(): string {
  const randomDigits = Math.floor(100000 + Math.random() * 900000);
  return `LY-ENV-${randomDigits}`;
}

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
