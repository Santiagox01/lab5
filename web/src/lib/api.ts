import {
  Book,
  BookCategory,
  BookFormat,
  Order,
  OrderStatus,
  ShippingAddress,
  ShippingMethod,
  User,
} from './types';

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
).replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string | null;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.error || `Error de solicitud (${res.status})`,
      data?.details
    );
  }

  return data as T;
}

export const api = {
  // Auth
  register(payload: { name: string; email: string; password: string }) {
    return request<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: payload,
    });
  },
  login(payload: { email: string; password: string }) {
    return request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: payload,
    });
  },
  logout(token?: string | null) {
    return request<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST',
      token,
    });
  },
  me(token: string) {
    return request<{ user: User }>('/api/auth/me', { token });
  },

  // Catálogo y Stock
  listBooks(params?: {
    category?: string;
    format?: string;
    search?: string;
    available?: boolean;
    inStock?: boolean;
  }) {
    const qs = new URLSearchParams();
    if (params?.category && params.category !== 'Todos') {
      qs.set('category', params.category);
    }
    if (params?.format && params.format !== 'Todos') {
      qs.set('format', params.format);
    }
    if (params?.search?.trim()) {
      qs.set('search', params.search.trim());
    }
    if (params?.available) qs.set('available', 'true');
    if (params?.inStock) qs.set('inStock', 'true');
    const queryStr = qs.toString();
    return request<{ books: Book[] }>(
      `/api/books${queryStr ? `?${queryStr}` : ''}`
    );
  },
  createBook(
    token: string,
    payload: {
      title: string;
      author: string;
      isbn: string;
      description: string;
      category: BookCategory;
      format: BookFormat;
      price: number;
      stock: number;
      available: boolean;
      coverUrl?: string;
      pages?: number;
      language?: string;
      publishedYear?: number;
    }
  ) {
    return request<{ book: Book }>('/api/books', {
      method: 'POST',
      token,
      body: payload,
    });
  },
  updateBook(token: string, id: string, payload: Partial<Book>) {
    return request<{ book: Book }>(`/api/books/${id}`, {
      method: 'PATCH',
      token,
      body: payload,
    });
  },
  adjustStock(
    token: string,
    id: string,
    payload: { stock?: number; delta?: number; available?: boolean }
  ) {
    return request<{ book: Book }>(`/api/books/${id}/stock`, {
      method: 'PATCH',
      token,
      body: payload,
    });
  },
  deleteBook(token: string, id: string) {
    return request<{ deleted: boolean; id: string }>(`/api/books/${id}`, {
      method: 'DELETE',
      token,
    });
  },

  // Pedidos y Envíos
  createOrder(
    token: string,
    payload: {
      items: Array<{ bookId: string; quantity: number }>;
      shippingAddress: ShippingAddress;
      shippingMethod: ShippingMethod;
    }
  ) {
    return request<{ order: Order }>('/api/orders', {
      method: 'POST',
      token,
      body: payload,
    });
  },
  getMyOrders(token: string) {
    return request<{ orders: Order[] }>('/api/orders/me', { token });
  },
  getOrderById(token: string, id: string) {
    return request<{ order: Order }>(`/api/orders/${id}`, { token });
  },
  getAdminOrders(token: string, includeUnpaid = false) {
    return request<{ orders: Order[] }>(
      `/api/orders${includeUnpaid ? '?includeUnpaid=true' : ''}`,
      { token }
    );
  },
  updateOrderStatus(
    token: string,
    id: string,
    payload: { status: OrderStatus; trackingCode?: string }
  ) {
    return request<{ order: Order }>(`/api/orders/${id}/status`, {
      method: 'PATCH',
      token,
      body: payload,
    });
  },

  // PayPal
  createPayPalOrder(token: string, orderId: string) {
    return request<{
      paypalOrderId: string;
      orderId: string;
      orderNumber: string;
      amount: number;
      currency: string;
    }>('/api/payments/paypal/order', {
      method: 'POST',
      token,
      body: { orderId },
    });
  },
  capturePayPalOrder(
    token: string,
    payload: { orderId: string; paypalOrderId: string }
  ) {
    return request<{ idempotent: boolean; order: Order; payment: unknown }>(
      '/api/payments/paypal/capture',
      {
        method: 'POST',
        token,
        body: payload,
      }
    );
  },
  cancelPayPalOrder(
    token: string,
    payload: { orderId: string; paypalOrderId?: string }
  ) {
    return request<{ cancelled: boolean; order: Order }>(
      '/api/payments/paypal/cancel',
      {
        method: 'POST',
        token,
        body: payload,
      }
    );
  },
};
