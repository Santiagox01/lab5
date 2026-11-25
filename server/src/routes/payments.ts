import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Book } from '../models/Book';
import { Order } from '../models/Order';
import { Payment } from '../models/Payment';
import { authenticate } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { PayPalGateway } from '../services/paypalService';
import { RealtimeHub, StockUpdatePayload } from '../socket/io';

const createPayPalOrderSchema = z.object({
  orderId: z.string().trim().min(1, 'orderId es obligatorio.'),
});

const capturePayPalOrderSchema = z.object({
  orderId: z.string().trim().min(1, 'orderId es obligatorio.'),
  paypalOrderId: z.string().trim().min(1, 'paypalOrderId es obligatorio.'),
});

const cancelPayPalOrderSchema = z.object({
  orderId: z.string().trim().min(1, 'orderId es obligatorio.'),
  paypalOrderId: z.string().trim().optional(),
});

export function createPaymentsRouter(
  paypalGateway: PayPalGateway,
  realtime: RealtimeHub
): Router {
  const router = Router();

  // Paso 1: Crear orden de cobro en PayPal con el importe recalculado en DB
  router.post(
    '/paypal/order',
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { orderId } = createPayPalOrderSchema.parse(req.body);
        const order = await Order.findById(orderId);

        if (!order) {
          res.status(404).json({ error: 'Pedido no encontrado.' });
          return;
        }

        if (String(order.userId) !== req.user!.id) {
          res.status(403).json({
            error: 'No puedes iniciar el pago de un pedido de otro usuario.',
          });
          return;
        }

        if (
          order.paymentStatus === 'CAPTURED' ||
          order.status !== 'PENDING_PAYMENT'
        ) {
          res.status(409).json({
            error: 'Este pedido ya fue pagado o no admite nuevos intentos.',
          });
          return;
        }

        // Verificar que todavía haya stock antes de solicitar cobro en PayPal
        for (const item of order.items) {
          const book = await Book.findById(item.bookId);
          if (!book || !book.available || book.stock < item.quantity) {
            res.status(409).json({
              error: `El libro "${item.title}" ya no cuenta con stock suficiente (${book?.stock ?? 0}).`,
            });
            return;
          }
        }

        const ppOrder = await paypalGateway.createOrder({
          orderId: String(order._id),
          orderNumber: order.orderNumber,
          total: order.total,
          currency: 'USD',
        });

        await Payment.create({
          orderId: order._id,
          userId: req.user!.id,
          provider: 'PAYPAL',
          providerOrderId: ppOrder.paypalOrderId,
          amount: order.total,
          currency: 'USD',
          status: 'CREATED',
        });

        order.paypalOrderId = ppOrder.paypalOrderId;
        order.paymentStatus = 'CREATED';
        await order.save();

        res.status(201).json({
          paypalOrderId: ppOrder.paypalOrderId,
          orderId: String(order._id),
          orderNumber: order.orderNumber,
          amount: order.total,
          currency: 'USD',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Paso 2: Capturar orden PayPal, validar importe/propiedad/idempotencia y descontar stock
  router.post(
    '/paypal/capture',
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { orderId, paypalOrderId } = capturePayPalOrderSchema.parse(
          req.body
        );

        const order = await Order.findById(orderId);
        if (!order) {
          res.status(404).json({ error: 'Pedido no encontrado.' });
          return;
        }

        if (String(order.userId) !== req.user!.id) {
          res.status(403).json({
            error: 'No tienes permiso para capturar el pago de otro usuario.',
          });
          return;
        }

        const payment = await Payment.findOne({
          orderId: order._id,
          providerOrderId: paypalOrderId,
        });

        // Idempotencia: si ya fue capturado, devolver estado conocido sin cobrar ni descontar de nuevo
        if (
          order.paymentStatus === 'CAPTURED' ||
          (payment && payment.status === 'CAPTURED')
        ) {
          res.status(200).json({
            idempotent: true,
            order: order.toJSON(),
            payment: payment ? payment.toJSON() : null,
          });
          return;
        }

        if (!payment || order.paypalOrderId !== paypalOrderId) {
          res.status(400).json({
            error: 'La orden de PayPal no coincide con el pedido especificado.',
          });
          return;
        }

        if (order.status !== 'PENDING_PAYMENT') {
          res.status(409).json({
            error: 'El pedido ya no se encuentra pendiente de pago.',
          });
          return;
        }

        // Pre-chequeo de stock antes de ejecutar captura en PayPal
        for (const item of order.items) {
          const book = await Book.findById(item.bookId);
          if (!book || !book.available || book.stock < item.quantity) {
            res.status(409).json({
              error: `Stock agotado o insuficiente para "${item.title}".`,
            });
            return;
          }
        }

        let capture;
        try {
          capture = await paypalGateway.captureOrder(paypalOrderId);
        } catch (err) {
          payment.status = 'FAILED';
          await payment.save();
          order.paymentStatus = 'FAILED';
          await order.save();
          const msg =
            err instanceof Error ? err.message : 'Error comunicando con PayPal';
          res.status(502).json({
            error: `No se pudo confirmar la captura en PayPal: ${msg}`,
          });
          return;
        }

        const amountMatches = Math.abs(capture.amountValue - order.total) < 0.01;
        const currencyMatches = capture.currencyCode === 'USD';
        const customIdMatches =
          !capture.customId || capture.customId === String(order._id);
        const statusCompleted = capture.status === 'COMPLETED';

        if (
          !statusCompleted ||
          !amountMatches ||
          !currencyMatches ||
          !customIdMatches ||
          !capture.captureId
        ) {
          payment.status = 'FAILED';
          await payment.save();
          order.paymentStatus = 'FAILED';
          await order.save();
          res.status(400).json({
            error:
              'La verificación del importe, moneda o estado en PayPal no coincide con el pedido.',
          });
          return;
        }

        // Descuento atómico de stock con rollback si falla en medio del lote
        const decremented: Array<{
          bookId: string;
          quantity: number;
          stock: number;
          available: boolean;
        }> = [];

        for (const item of order.items) {
          const updatedBook = await Book.findOneAndUpdate(
            {
              _id: item.bookId,
              available: true,
              stock: { $gte: item.quantity },
            },
            { $inc: { stock: -item.quantity } },
            { new: true }
          );

          if (!updatedBook) {
            for (const prev of decremented) {
              await Book.findByIdAndUpdate(prev.bookId, {
                $inc: { stock: prev.quantity },
                $set: { available: true },
              });
            }
            throw new HttpError(
              409,
              `Stock insuficiente para "${item.title}" al finalizar la compra.`
            );
          }

          if (updatedBook.stock === 0 && updatedBook.available) {
            updatedBook.available = false;
            await updatedBook.save();
          }

          decremented.push({
            bookId: String(updatedBook._id),
            quantity: item.quantity,
            stock: updatedBook.stock,
            available: updatedBook.available,
          });
        }

        payment.status = 'CAPTURED';
        payment.captureId = capture.captureId;
        if (capture.payerEmail) {
          payment.payerEmail = capture.payerEmail;
        }
        await payment.save();

        order.paymentStatus = 'CAPTURED';
        order.status = 'PAID';
        order.paidAt = new Date();
        await order.save();

        realtime.emitOrderCreated(order);
        const stockUpdates: StockUpdatePayload[] = decremented.map((d) => ({
          bookId: d.bookId,
          stock: d.stock,
          available: d.available,
        }));
        realtime.emitStockUpdated(stockUpdates);

        res.status(200).json({
          idempotent: false,
          order: order.toJSON(),
          payment: payment.toJSON(),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Cancelación controlada (usuario cancela en ventana PayPal; puede reintentar)
  router.post(
    '/paypal/cancel',
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { orderId, paypalOrderId } = cancelPayPalOrderSchema.parse(
          req.body
        );
        const order = await Order.findById(orderId);
        if (!order) {
          res.status(404).json({ error: 'Pedido no encontrado.' });
          return;
        }

        if (String(order.userId) !== req.user!.id) {
          res.status(403).json({
            error: 'No puedes cancelar el pago de otro usuario.',
          });
          return;
        }

        if (order.paymentStatus === 'CAPTURED') {
          res.status(409).json({ error: 'El pedido ya fue capturado.' });
          return;
        }

        const lookupId = paypalOrderId || order.paypalOrderId;
        if (lookupId) {
          await Payment.findOneAndUpdate(
            { orderId: order._id, providerOrderId: lookupId, status: 'CREATED' },
            { $set: { status: 'CANCELLED' } }
          );
        }

        order.paymentStatus = 'CANCELLED';
        await order.save();

        res.status(200).json({
          cancelled: true,
          order: order.toJSON(),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
