export type UserRole = 'cliente' | 'administrador';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: string;
}

export type BookCategory =
  | 'Programación'
  | 'Inteligencia Artificial'
  | 'Arquitectura'
  | 'Ciencia Ficción'
  | 'Negocios'
  | 'Diseño';

export type BookFormat =
  | 'EPUB'
  | 'PDF'
  | 'Audiolibro'
  | 'Edición Impresa + eBook';

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  description: string;
  category: BookCategory;
  format: BookFormat;
  price: number;
  stock: number;
  available: boolean;
  coverUrl: string;
  pages: number;
  language: string;
  publishedYear: number;
  createdAt?: string;
}

export interface CartItem {
  book: Book;
  quantity: number;
}

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PREPARING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export type OrderPaymentStatus =
  | 'PENDING'
  | 'CREATED'
  | 'APPROVED'
  | 'CAPTURED'
  | 'FAILED'
  | 'CANCELLED';

export type ShippingMethod = 'DIGITAL_INSTANT' | 'STANDARD' | 'EXPRESS';

export interface ShippingAddress {
  fullName: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  notes?: string;
}

export interface OrderItem {
  bookId: string;
  title: string;
  author: string;
  format: string;
  coverUrl: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string | { id?: string; _id?: string; name: string; email: string };
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  shippingMethod: ShippingMethod;
  shippingCost: number;
  trackingCode: string;
  subtotal: number;
  total: number;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  paypalOrderId?: string;
  paidAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const BOOK_CATEGORIES: BookCategory[] = [
  'Programación',
  'Inteligencia Artificial',
  'Arquitectura',
  'Ciencia Ficción',
  'Negocios',
  'Diseño',
];

export const BOOK_FORMATS: BookFormat[] = [
  'EPUB',
  'PDF',
  'Audiolibro',
  'Edición Impresa + eBook',
];

export const SHIPPING_OPTIONS: Array<{
  id: ShippingMethod;
  label: string;
  description: string;
  price: number;
}> = [
  {
    id: 'DIGITAL_INSTANT',
    label: 'Entrega Digital Instantánea',
    description: 'Descarga directa de eBook / licencia en tu historial tras el pago.',
    price: 0,
  },
  {
    id: 'STANDARD',
    label: 'Envío Estándar (3–5 días hábiles)',
    description: 'Incluye licencia digital inmediata + despacho físico certificado.',
    price: 4.99,
  },
  {
    id: 'EXPRESS',
    label: 'Envío Express Prioritario (24–48 h)',
    description: 'Licencia digital inmediata + mensajería prioritaria con seguimiento.',
    price: 9.99,
  },
];

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; badgeClass: string }
> = {
  PENDING_PAYMENT: {
    label: 'Pendiente de pago',
    badgeClass: 'bg-stone-700/70 text-stone-200 border-stone-600',
  },
  PAID: {
    label: 'Pendiente',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  PREPARING: {
    label: 'En preparación',
    badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  },
  SHIPPED: {
    label: 'Enviado',
    badgeClass: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  },
  DELIVERED: {
    label: 'Entregado',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  CANCELLED: {
    label: 'Cancelado',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  },
};
