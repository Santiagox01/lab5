import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  Book,
  BOOK_CATEGORIES,
  BOOK_FORMATS,
} from '../models/Book';
import { authenticate, requireRole } from '../middleware/auth';
import { RealtimeHub } from '../socket/io';

const createBookSchema = z.object({
  title: z.string().trim().min(2).max(180),
  author: z.string().trim().min(2).max(140),
  isbn: z.string().trim().min(5).max(32),
  description: z.string().trim().min(10).max(2000),
  category: z.enum(BOOK_CATEGORIES),
  format: z.enum(BOOK_FORMATS).default('EPUB'),
  price: z.number().positive('El precio debe ser mayor que 0.'),
  stock: z
    .number()
    .int('El stock debe ser entero.')
    .min(0, 'El stock no puede ser negativo.'),
  available: z.boolean().optional().default(true),
  coverUrl: z.string().trim().min(1).default('/covers/book-01.svg'),
  pages: z.number().int().min(1).default(240),
  language: z.string().trim().min(2).max(40).default('Español'),
  publishedYear: z.number().int().min(1950).max(2100).default(2026),
});

const updateBookSchema = createBookSchema.partial();

const stockAdjustSchema = z
  .object({
    stock: z.number().int('El stock debe ser entero.').min(0).optional(),
    delta: z.number().int('El ajuste debe ser entero.').optional(),
    available: z.boolean().optional(),
  })
  .refine(
    (data) => data.stock !== undefined || data.delta !== undefined,
    'Debes indicar stock absoluto o delta de ajuste.'
  );

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function createBooksRouter(realtime: RealtimeHub): Router {
  const router = Router();

  // Catálogo público con filtros
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category, format, search, available, inStock } = req.query;
      const filter: Record<string, unknown> = {};

      if (typeof category === 'string' && category && category !== 'Todos') {
        filter.category = category;
      }
      if (typeof format === 'string' && format && format !== 'Todos') {
        filter.format = format;
      }
      if (available === 'true') {
        filter.available = true;
      } else if (available === 'false') {
        filter.available = false;
      }
      if (inStock === 'true') {
        filter.stock = { $gt: 0 };
        filter.available = true;
      }
      if (typeof search === 'string' && search.trim()) {
        const safeRegex = new RegExp(escapeRegex(search.trim()), 'i');
        filter.$or = [
          { title: safeRegex },
          { author: safeRegex },
          { description: safeRegex },
          { isbn: safeRegex },
        ];
      }

      const books = await Book.find(filter).sort({ createdAt: 1, title: 1 });
      res.status(200).json({ books: books.map((b) => b.toJSON()) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const book = await Book.findById(req.params.id);
      if (!book) {
        res.status(404).json({ error: 'Libro no encontrado.' });
        return;
      }
      res.status(200).json({ book: book.toJSON() });
    } catch (error) {
      next(error);
    }
  });

  // Crear libro (solo administrador)
  router.post(
    '/',
    authenticate,
    requireRole('administrador'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = createBookSchema.parse(req.body);
        const effectiveAvailable =
          parsed.stock === 0 ? false : parsed.available;

        const book = await Book.create({
          ...parsed,
          available: effectiveAvailable,
        });

        res.status(201).json({ book: book.toJSON() });
      } catch (error) {
        next(error);
      }
    }
  );

  // Actualizar libro (solo administrador)
  router.patch(
    '/:id',
    authenticate,
    requireRole('administrador'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = updateBookSchema.parse(req.body);
        const book = await Book.findById(req.params.id);
        if (!book) {
          res.status(404).json({ error: 'Libro no encontrado.' });
          return;
        }

        Object.assign(book, parsed);
        if (book.stock === 0 && parsed.available === undefined) {
          book.available = false;
        }
        await book.save();

        realtime.emitStockUpdated([
          {
            bookId: String(book._id),
            stock: book.stock,
            available: book.available,
          },
        ]);

        res.status(200).json({ book: book.toJSON() });
      } catch (error) {
        next(error);
      }
    }
  );

  // Ajuste de stock en tiempo real (solo administrador)
  router.patch(
    '/:id/stock',
    authenticate,
    requireRole('administrador'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = stockAdjustSchema.parse(req.body);
        const existing = await Book.findById(req.params.id);
        if (!existing) {
          res.status(404).json({ error: 'Libro no encontrado.' });
          return;
        }

        const nextStock =
          parsed.stock !== undefined
            ? parsed.stock
            : existing.stock + (parsed.delta ?? 0);

        if (nextStock < 0) {
          res.status(400).json({
            error: 'El ajuste dejaría el stock por debajo de cero.',
          });
          return;
        }

        const nextAvailable =
          parsed.available !== undefined
            ? parsed.available
            : nextStock > 0
              ? true
              : false;

        existing.stock = nextStock;
        existing.available = nextAvailable;
        await existing.save();

        realtime.emitStockUpdated([
          {
            bookId: String(existing._id),
            stock: existing.stock,
            available: existing.available,
          },
        ]);

        res.status(200).json({ book: existing.toJSON() });
      } catch (error) {
        next(error);
      }
    }
  );

  // Eliminar libro (solo administrador)
  router.delete(
    '/:id',
    authenticate,
    requireRole('administrador'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const deleted = await Book.findByIdAndDelete(req.params.id);
        if (!deleted) {
          res.status(404).json({ error: 'Libro no encontrado.' });
          return;
        }
        res.status(200).json({ deleted: true, id: String(deleted._id) });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
