import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { Book } from '../models/Book';
import { Order, OrderStatus } from '../models/Order';
import { authenticate, requireRole } from '../middleware/auth';
import {
  canAdminTransition,
  generateTrackingCode,
  ORDER_STATUS_LABELS,
  roundCurrency,
  SHIPPING_PRICES,
} from '../services/orderStateMachine';
import { RealtimeHub } from '../socket/io';

const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        bookId: z.string().trim().min(1, 'Identificador de libro requerido.'),
        quantity: z
          .number()
          .int('La cantidad debe ser entera.')
          .min(1, 'La cantidad mínima es 1.')
          .max(99, 'La cantidad máxima por título es 99.'),
      })
    )
    .min(1, 'El carrito no puede estar vacío.')
    .max(30),
  shippingAddress: z.object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Nombre completo requerido.')
      .max(120),
    street: z
      .string()
      .trim()
      .min(3, 'La dirección de entrega es obligatoria.')
      .max(200),
    city: z.string().trim().min(2, 'La ciudad es obligatoria.').max(100),
    postalCode: z
      .string()
      .trim()
      .min(2, 'El código postal es obligatorio.')
      .max(30),
    country: z.string().trim().min(2, 'El país es obligatorio.').max(80),
    notes: z.string().trim().max(300).optional().default(''),
  }),
  shippingMethod: z
    .enum(['DIGITAL_INSTANT', 'STANDARD', 'EXPRESS'])
    .default('DIGITAL_INSTANT'),
});

const updateOrderStatusSchema = z.object({
  status: z.enum([
    'PENDING_PAYMENT',
    'PAID',
    'PREPARING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
  ]),
  trackingCode: z.string().trim().max(60).optional(),
});

function buildOrderNumber(): string {
  const year = new Date().getFullYear();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `LY-${year}-${suffix}`;
}

export function createOrdersRouter(realtime: RealtimeHub): Router {
  const router = Router();

  // Crear pedido pendiente de pago (recalcula importes en servidor y valida stock)
  router.post(
    '/',
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = createOrderSchema.parse(req.body);

        // Consolidar cantidades si el cliente envió el mismo libro en dos líneas
        const quantityByBook = new Map<string, number>();
        for (const item of parsed.items) {
          quantityByBook.set(
            item.bookId,
            (quantityByBook.get(item.bookId) || 0) + item.quantity
          );
        }

        const uniqueIds = Array.from(quantityByBook.keys());
        const books = await Book.find({ _id: { $in: uniqueIds } });
        const booksMap = new Map(books.map((b) => [String(b._id), b]));

        const verifiedItems = [];
        let subtotal = 0;

        for (const [bookId, quantity] of quantityByBook.entries()) {
          const book = booksMap.get(bookId);
          if (!book) {
            res.status(404).json({
              error: `Uno de los libros seleccionados (${bookId}) no existe.`,
            });
            return;
          }

          if (!book.available || book.stock < quantity) {
            res.status(409).json({
              error: `Stock insuficiente para "${book.title}". Disponible: ${book.available ? book.stock : 0}.`,
            });
            return;
          }

          const unitPrice = roundCurrency(book.price);
          const itemSubtotal = roundCurrency(unitPrice * quantity);
          subtotal = roundCurrency(subtotal + itemSubtotal);

          verifiedItems.push({
            bookId: book._id,
            title: book.title,
            author: book.author,
            format: book.format,
            coverUrl: book.coverUrl,
            unitPrice,
            quantity,
            subtotal: itemSubtotal,
          });
        }

        const shippingCost = SHIPPING_PRICES[parsed.shippingMethod];
        const total = roundCurrency(subtotal + shippingCost);

        const order = await Order.create({
          orderNumber: buildOrderNumber(),
          userId: req.user!.id,
          items: verifiedItems,
          shippingAddress: parsed.shippingAddress,
          shippingMethod: parsed.shippingMethod,
          shippingCost,
          subtotal,
          total,
          status: 'PENDING_PAYMENT',
          paymentStatus: 'PENDING',
        });

        res.status(201).json({ order: order.toJSON() });
      } catch (error) {
        next(error);
      }
    }
  );

  // Historial del cliente autenticado (solo sus propios pedidos)
  router.get(
    '/me',
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const orders = await Order.find({ userId: req.user!.id }).sort({
          createdAt: -1,
        });
        res.status(200).json({ orders: orders.map((o) => o.toJSON()) });
      } catch (error) {
        next(error);
      }
    }
  );

  // Tablero general de envíos para administrador
  router.get(
    '/',
    authenticate,
    requireRole('administrador'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const includeUnpaid = req.query.includeUnpaid === 'true';
        const filter = includeUnpaid
          ? {}
          : { status: { $nin: ['PENDING_PAYMENT', 'CANCELLED'] } };

        const orders = await Order.find(filter)
          .populate('userId', 'name email')
          .sort({ createdAt: -1 });

        res.status(200).json({ orders: orders.map((o) => o.toJSON()) });
      } catch (error) {
        next(error);
      }
    }
  );

  // Detalle de pedido (propietario o administrador)
  router.get(
    '/:id',
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const order = await Order.findById(req.params.id);
        if (!order) {
          res.status(404).json({ error: 'Pedido no encontrado.' });
          return;
        }

        const isOwner = String(order.userId) === req.user!.id;
        const isAdmin = req.user!.role === 'administrador';
        if (!isOwner && !isAdmin) {
          res.status(403).json({
            error: 'No tienes permiso para consultar este pedido.',
          });
          return;
        }

        res.status(200).json({ order: order.toJSON() });
      } catch (error) {
        next(error);
      }
    }
  );

  // Transición de estado de envío en Kanban (solo administrador con máquina de estados)
  router.patch(
    '/:id/status',
    authenticate,
    requireRole('administrador'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = updateOrderStatusSchema.parse(req.body);
        const order = await Order.findById(req.params.id);

        if (!order) {
          res.status(404).json({ error: 'Pedido no encontrado.' });
          return;
        }

        const nextStatus = parsed.status as OrderStatus;
        if (!canAdminTransition(order.status, nextStatus)) {
          res.status(400).json({
            error: `Transición de estado no permitida: de "${ORDER_STATUS_LABELS[order.status]}" (${order.status}) a "${ORDER_STATUS_LABELS[nextStatus]}" (${nextStatus}).`,
          });
          return;
        }

        order.status = nextStatus;

        if (nextStatus === 'SHIPPED') {
          order.trackingCode =
            parsed.trackingCode?.trim() ||
            order.trackingCode ||
            generateTrackingCode();
          order.shippedAt = new Date();
        } else if (nextStatus === 'DELIVERED') {
          order.deliveredAt = new Date();
        }

        await order.save();
        realtime.emitOrderStatusChanged(order);

        res.status(200).json({ order: order.toJSON() });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
