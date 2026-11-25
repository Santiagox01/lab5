import { AddressInfo } from 'net';
import bcrypt from 'bcryptjs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { io as ioClient, Socket } from 'socket.io-client';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { createApp, AppInstance } from '../app';
import { Book } from '../models/Book';
import { Order } from '../models/Order';
import { Payment } from '../models/Payment';
import { User } from '../models/User';
import {
  PayPalCaptureOrderResult,
  PayPalCreateOrderInput,
  PayPalCreateOrderResult,
  PayPalGateway,
} from '../services/paypalService';

class MockPayPalGateway implements PayPalGateway {
  public mode: 'SUCCESS' | 'WRONG_AMOUNT' | 'FAIL_CAPTURE' = 'SUCCESS';
  public captureCalls = 0;
  private orders = new Map<string, { orderId: string; total: number }>();
  private seq = 1;

  reset() {
    this.mode = 'SUCCESS';
    this.captureCalls = 0;
    this.orders.clear();
    this.seq = 1;
  }

  async createOrder(
    input: PayPalCreateOrderInput
  ): Promise<PayPalCreateOrderResult> {
    const ppId = `PP-MOCK-${this.seq++}`;
    this.orders.set(ppId, { orderId: input.orderId, total: input.total });
    return { paypalOrderId: ppId, status: 'CREATED' };
  }

  async captureOrder(
    paypalOrderId: string
  ): Promise<PayPalCaptureOrderResult> {
    this.captureCalls += 1;
    if (this.mode === 'FAIL_CAPTURE') {
      throw new Error('Simulación de caída PayPal');
    }

    const stored = this.orders.get(paypalOrderId);
    if (!stored) {
      throw new Error('Orden PayPal mock no encontrada');
    }

    const amountValue =
      this.mode === 'WRONG_AMOUNT' ? 0.01 : stored.total;

    return {
      paypalOrderId,
      status: 'COMPLETED',
      captureId: `CAP-MOCK-${paypalOrderId}`,
      amountValue,
      currencyCode: 'USD',
      customId: stored.orderId,
      payerEmail: 'buyer-sandbox@libroya.com',
    };
  }
}

describe('LibroYa API, PayPal, Stock y WebSockets (Suite Integral)', () => {
  let mongod: MongoMemoryServer;
  let instance: AppInstance;
  let baseUrl: string;
  const mockPayPal = new MockPayPalGateway();

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    instance = createApp({
      paypalGateway: mockPayPal,
      allowedOrigins: ['http://localhost:3000'],
    });

    await new Promise<void>((resolve) => {
      instance.httpServer.listen(0, '127.0.0.1', () => {
        const addr = instance.httpServer.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    instance.realtime.close();
    await new Promise<void>((resolve) => instance.httpServer.close(() => resolve()));
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    mockPayPal.reset();
    await Promise.all([
      User.deleteMany({}),
      Book.deleteMany({}),
      Order.deleteMany({}),
      Payment.deleteMany({}),
    ]);
  });

  async function seedUsersAndBooks() {
    const admin = await User.create({
      name: 'Admin Editorial',
      email: 'admin@libroya.com',
      passwordHash: await bcrypt.hash('Admin123!', 10),
      role: 'administrador',
    });

    const clientA = await User.create({
      name: 'Cliente Uno',
      email: 'uno@libroya.com',
      passwordHash: await bcrypt.hash('Cliente123!', 10),
      role: 'cliente',
    });

    const clientB = await User.create({
      name: 'Cliente Dos',
      email: 'dos@libroya.com',
      passwordHash: await bcrypt.hash('Cliente123!', 10),
      role: 'cliente',
    });

    const loginAdmin = await request(instance.app)
      .post('/api/auth/login')
      .send({ email: 'admin@libroya.com', password: 'Admin123!' });
    const loginA = await request(instance.app)
      .post('/api/auth/login')
      .send({ email: 'uno@libroya.com', password: 'Cliente123!' });
    const loginB = await request(instance.app)
      .post('/api/auth/login')
      .send({ email: 'dos@libroya.com', password: 'Cliente123!' });

    const bookInStock = await Book.create({
      title: 'Arquitectura Limpia en TypeScript',
      author: 'Mateo Valdivia',
      isbn: '978-0001-1',
      description: 'Libro técnico de arquitectura full-stack.',
      category: 'Arquitectura',
      format: 'EPUB',
      price: 20.0,
      stock: 5,
      available: true,
      coverUrl: '/covers/book-01.svg',
      pages: 320,
      language: 'Español',
      publishedYear: 2026,
    });

    const bookOutOfStock = await Book.create({
      title: 'Edición Limitada Agotada',
      author: 'Daniela Echeverri',
      isbn: '978-0001-2',
      description: 'Edición especial actualmente sin unidades.',
      category: 'Ciencia Ficción',
      format: 'PDF',
      price: 35.0,
      stock: 0,
      available: false,
      coverUrl: '/covers/book-10.svg',
      pages: 280,
      language: 'Español',
      publishedYear: 2025,
    });

    return {
      admin,
      clientA,
      clientB,
      adminToken: loginAdmin.body.token as string,
      tokenA: loginA.body.token as string,
      tokenB: loginB.body.token as string,
      bookInStock,
      bookOutOfStock,
    };
  }

  it('1. GET /health y catálogo público sin sesión con filtros', async () => {
    await seedUsersAndBooks();

    const health = await request(instance.app).get('/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('ok');
    expect(health.body.db).toBe('connected');
    expect(JSON.stringify(health.body)).not.toContain('mongodb');

    const catalog = await request(instance.app).get('/api/books');
    expect(catalog.status).toBe(200);
    expect(catalog.body.books).toHaveLength(2);

    const filtered = await request(instance.app).get(
      '/api/books?category=Arquitectura&inStock=true'
    );
    expect(filtered.status).toBe(200);
    expect(filtered.body.books).toHaveLength(1);
    expect(filtered.body.books[0].title).toContain('Arquitectura');
  });

  it('2. Registro fuerza rol cliente, hashea contraseña y oculta passwordHash', async () => {
    const res = await request(instance.app).post('/api/auth/register').send({
      name: 'Nuevo Lector',
      email: 'lector@libroya.com',
      password: 'PasswordSeguro123',
      role: 'administrador', // Intento de escalada de privilegios
    });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('cliente');
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.token).toBeTruthy();

    const dbUser = await User.findOne({ email: 'lector@libroya.com' }).select(
      '+passwordHash'
    );
    expect(dbUser).not.toBeNull();
    expect(dbUser!.passwordHash).not.toBe('PasswordSeguro123');
    expect(dbUser!.role).toBe('cliente');

    const badLogin = await request(instance.app)
      .post('/api/auth/login')
      .send({ email: 'lector@libroya.com', password: 'ClaveIncorrecta' });
    expect(badLogin.status).toBe(401);
    expect(badLogin.body.error).toBe('Credenciales inválidas.');
  });

  it('3. Rutas protegidas rechazan anónimos (401) y cliente no puede usar panel admin (403)', async () => {
    const { tokenA, bookInStock } = await seedUsersAndBooks();

    const anonOrders = await request(instance.app).get('/api/orders/me');
    expect(anonOrders.status).toBe(401);

    const clientAdminList = await request(instance.app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(clientAdminList.status).toBe(403);

    const clientCreateBook = await request(instance.app)
      .post('/api/books')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Libro No Autorizado',
        author: 'Alguien',
        isbn: '999-999',
        description: 'Descripción de prueba suficientemente larga.',
        category: 'Programación',
        format: 'EPUB',
        price: 10,
        stock: 5,
      });
    expect(clientCreateBook.status).toBe(403);

    const clientAdjustStock = await request(instance.app)
      .patch(`/api/books/${bookInStock.id}/stock`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ delta: 10 });
    expect(clientAdjustStock.status).toBe(403);
  });

  it('4. Recálculo de precio en servidor y rechazo de datos/stock inválidos', async () => {
    const { tokenA, bookInStock, bookOutOfStock } = await seedUsersAndBooks();

    // Intento de alterar precio/total desde cliente
    const orderRes = await request(instance.app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [{ bookId: bookInStock.id, quantity: 2 }],
        shippingMethod: 'STANDARD',
        shippingAddress: {
          fullName: 'Cliente Uno',
          street: 'Calle 10 # 20-30',
          city: 'Medellín',
          postalCode: '050021',
          country: 'Colombia',
        },
        unitPrice: 0.01,
        subtotal: 0.02,
        total: 0.02,
        status: 'PAID',
      });

    expect(orderRes.status).toBe(201);
    expect(orderRes.body.order.subtotal).toBe(40); // 2 * $20.00
    expect(orderRes.body.order.shippingCost).toBe(4.99);
    expect(orderRes.body.order.total).toBe(44.99);
    expect(orderRes.body.order.status).toBe('PENDING_PAYMENT');

    // Cantidad negativa y dirección vacía -> 400
    const badQty = await request(instance.app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [{ bookId: bookInStock.id, quantity: -1 }],
        shippingMethod: 'DIGITAL_INSTANT',
        shippingAddress: {
          fullName: 'A',
          street: '',
          city: '',
          postalCode: '',
          country: '',
        },
      });
    expect(badQty.status).toBe(400);

    // Excede stock disponible -> 409
    const overStock = await request(instance.app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [{ bookId: bookInStock.id, quantity: 99 }],
        shippingMethod: 'DIGITAL_INSTANT',
        shippingAddress: {
          fullName: 'Cliente Uno',
          street: 'Calle 10 # 20-30',
          city: 'Medellín',
          postalCode: '050021',
          country: 'Colombia',
        },
      });
    expect(overStock.status).toBe(409);

    // Libro agotado -> 409
    const outStock = await request(instance.app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [{ bookId: bookOutOfStock.id, quantity: 1 }],
        shippingMethod: 'DIGITAL_INSTANT',
        shippingAddress: {
          fullName: 'Cliente Uno',
          street: 'Calle 10 # 20-30',
          city: 'Medellín',
          postalCode: '050021',
          country: 'Colombia',
        },
      });
    expect(outStock.status).toBe(409);
  });

  it('5. Aislamiento por propiedad: Cliente B no puede ver ni pagar pedido de Cliente A', async () => {
    const { tokenA, tokenB, bookInStock } = await seedUsersAndBooks();

    const createRes = await request(instance.app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [{ bookId: bookInStock.id, quantity: 1 }],
        shippingMethod: 'DIGITAL_INSTANT',
        shippingAddress: {
          fullName: 'Cliente Uno',
          street: 'Av Siempre Viva 123',
          city: 'Bogotá',
          postalCode: '110111',
          country: 'Colombia',
        },
      });
    const orderId = createRes.body.order.id as string;

    const readByB = await request(instance.app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(readByB.status).toBe(403);

    const payByB = await request(instance.app)
      .post('/api/payments/paypal/order')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ orderId });
    expect(payByB.status).toBe(403);

    const histB = await request(instance.app)
      .get('/api/orders/me')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(histB.status).toBe(200);
    expect(histB.body.orders).toHaveLength(0);
  });

  it('6. PayPal: captura verificada descuenta stock, es idempotente y rechaza discrepancias/cancelación', async () => {
    const { tokenA, bookInStock } = await seedUsersAndBooks();

    const orderRes = await request(instance.app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [{ bookId: bookInStock.id, quantity: 2 }],
        shippingMethod: 'DIGITAL_INSTANT',
        shippingAddress: {
          fullName: 'Cliente Uno',
          street: 'Calle 10 # 20-30',
          city: 'Medellín',
          postalCode: '050021',
          country: 'Colombia',
        },
      });
    const orderId = orderRes.body.order.id as string;

    // 1) Probar cancelación controlada -> sigue PENDING_PAYMENT y stock intacto
    const ppOrder1 = await request(instance.app)
      .post('/api/payments/paypal/order')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ orderId });
    expect(ppOrder1.status).toBe(201);

    const cancelRes = await request(instance.app)
      .post('/api/payments/paypal/cancel')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ orderId, paypalOrderId: ppOrder1.body.paypalOrderId });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.order.status).toBe('PENDING_PAYMENT');

    // 2) Probar discrepancia de monto devuelta por PayPal -> 400, sin marcar pagado
    const ppOrder2 = await request(instance.app)
      .post('/api/payments/paypal/order')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ orderId });
    expect(ppOrder2.status).toBe(201);

    mockPayPal.mode = 'WRONG_AMOUNT';
    const mismatchRes = await request(instance.app)
      .post('/api/payments/paypal/capture')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ orderId, paypalOrderId: ppOrder2.body.paypalOrderId });
    expect(mismatchRes.status).toBe(400);

    const unchangedBook = await Book.findById(bookInStock.id);
    expect(unchangedBook!.stock).toBe(5);

    // 3) Reintentar con PayPal válido -> captura y descuenta 2 unidades de stock
    mockPayPal.mode = 'SUCCESS';
    mockPayPal.captureCalls = 0;

    const ppOrder3 = await request(instance.app)
      .post('/api/payments/paypal/order')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ orderId });
    expect(ppOrder3.status).toBe(201);

    const captureOk = await request(instance.app)
      .post('/api/payments/paypal/capture')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ orderId, paypalOrderId: ppOrder3.body.paypalOrderId });

    expect(captureOk.status).toBe(200);
    expect(captureOk.body.idempotent).toBe(false);
    expect(captureOk.body.order.status).toBe('PAID');
    expect(captureOk.body.order.paymentStatus).toBe('CAPTURED');

    const updatedBook = await Book.findById(bookInStock.id);
    expect(updatedBook!.stock).toBe(3);

    // 4) Repetir captura -> idempotente, NO vuelve a llamar a PayPal ni descuenta stock
    const captureRepeat = await request(instance.app)
      .post('/api/payments/paypal/capture')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ orderId, paypalOrderId: ppOrder3.body.paypalOrderId });

    expect(captureRepeat.status).toBe(200);
    expect(captureRepeat.body.idempotent).toBe(true);
    expect(mockPayPal.captureCalls).toBe(1);

    const bookAfterRepeat = await Book.findById(bookInStock.id);
    expect(bookAfterRepeat!.stock).toBe(3);
  });

  it('7. Máquina de estados Kanban y gestión de stock por administrador', async () => {
    const { adminToken, tokenA, bookInStock } = await seedUsersAndBooks();

    const orderRes = await request(instance.app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [{ bookId: bookInStock.id, quantity: 1 }],
        shippingMethod: 'EXPRESS',
        shippingAddress: {
          fullName: 'Cliente Uno',
          street: 'Calle 10 # 20-30',
          city: 'Medellín',
          postalCode: '050021',
          country: 'Colombia',
        },
      });
    const orderId = orderRes.body.order.id as string;

    // No se puede mover pedido sin pagar
    const moveUnpaid = await request(instance.app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PREPARING' });
    expect(moveUnpaid.status).toBe(400);

    // Pagar orden
    const pp = await request(instance.app)
      .post('/api/payments/paypal/order')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ orderId });
    await request(instance.app)
      .post('/api/payments/paypal/capture')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ orderId, paypalOrderId: pp.body.paypalOrderId });

    // No se puede saltar de PAID a DELIVERED
    const illegalJump = await request(instance.app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'DELIVERED' });
    expect(illegalJump.status).toBe(400);

    // Flujo válido: PAID -> PREPARING -> SHIPPED -> DELIVERED
    const s1 = await request(instance.app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PREPARING' });
    expect(s1.status).toBe(200);
    expect(s1.body.order.status).toBe('PREPARING');

    const s2 = await request(instance.app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'SHIPPED' });
    expect(s2.status).toBe(200);
    expect(s2.body.order.status).toBe('SHIPPED');
    expect(s2.body.order.trackingCode).toMatch(/^LY-ENV-/);

    const s3 = await request(instance.app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'DELIVERED' });
    expect(s3.status).toBe(200);
    expect(s3.body.order.status).toBe('DELIVERED');

    // Ajuste de stock por admin
    const negStock = await request(instance.app)
      .patch(`/api/books/${bookInStock.id}/stock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ delta: -50 });
    expect(negStock.status).toBe(400);

    const plusStock = await request(instance.app)
      .patch(`/api/books/${bookInStock.id}/stock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ delta: 6 });
    expect(plusStock.status).toBe(200);
    expect(plusStock.body.book.stock).toBe(10); // 5 - 1 comprado + 6
  });

  it('8. WebSockets autenticados: notificación en vivo al Admin y solo al Cliente dueño', async () => {
    const { adminToken, tokenA, tokenB, bookInStock } =
      await seedUsersAndBooks();

    // Sin token debe rechazar handshake
    await expect(
      new Promise((resolve, reject) => {
        const unauthSocket = ioClient(baseUrl, {
          transports: ['websocket'],
          reconnection: false,
        });
        unauthSocket.on('connect', () => {
          unauthSocket.disconnect();
          reject(new Error('No debió conectar sin JWT'));
        });
        unauthSocket.on('connect_error', (err) => {
          unauthSocket.disconnect();
          resolve(err.message);
        });
      })
    ).resolves.toBeTruthy();

    const adminSocket: Socket = ioClient(baseUrl, {
      auth: { token: adminToken },
      transports: ['websocket'],
    });
    const clientASocket: Socket = ioClient(baseUrl, {
      auth: { token: tokenA },
      transports: ['websocket'],
    });
    const clientBSocket: Socket = ioClient(baseUrl, {
      auth: { token: tokenB },
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise<void>((r) => adminSocket.on('connect', () => r())),
      new Promise<void>((r) => clientASocket.on('connect', () => r())),
      new Promise<void>((r) => clientBSocket.on('connect', () => r())),
    ]);

    const adminCreatedEvents: Array<{ orderNumber: string }> = [];
    const clientAUpdatedEvents: Array<{ status: string }> = [];
    const clientBLeakEvents: unknown[] = [];

    adminSocket.on('order:created', (payload) =>
      adminCreatedEvents.push(payload)
    );
    clientASocket.on('order:updated', (payload) =>
      clientAUpdatedEvents.push(payload)
    );
    clientASocket.on('order:statusChanged', (payload) =>
      clientAUpdatedEvents.push(payload)
    );
    clientBSocket.on('order:created', (p) => clientBLeakEvents.push(p));
    clientBSocket.on('order:updated', (p) => clientBLeakEvents.push(p));
    clientBSocket.on('order:statusChanged', (p) => clientBLeakEvents.push(p));

    const orderRes = await request(instance.app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [{ bookId: bookInStock.id, quantity: 1 }],
        shippingMethod: 'DIGITAL_INSTANT',
        shippingAddress: {
          fullName: 'Cliente Uno',
          street: 'Calle 10 # 20-30',
          city: 'Medellín',
          postalCode: '050021',
          country: 'Colombia',
        },
      });
    const orderId = orderRes.body.order.id as string;

    const pp = await request(instance.app)
      .post('/api/payments/paypal/order')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ orderId });

    await request(instance.app)
      .post('/api/payments/paypal/capture')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ orderId, paypalOrderId: pp.body.paypalOrderId });

    await new Promise((r) => setTimeout(r, 150));

    expect(adminCreatedEvents.length).toBeGreaterThanOrEqual(1);
    expect(clientAUpdatedEvents.some((e) => e.status === 'PAID')).toBe(true);
    expect(clientBLeakEvents).toHaveLength(0);

    // Admin cambia estado y Cliente A lo recibe en tiempo real
    await request(instance.app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PREPARING' });

    await new Promise((r) => setTimeout(r, 150));

    expect(
      clientAUpdatedEvents.some((e) => e.status === 'PREPARING')
    ).toBe(true);
    expect(clientBLeakEvents).toHaveLength(0);

    adminSocket.disconnect();
    clientASocket.disconnect();
    clientBSocket.disconnect();
  });
});
