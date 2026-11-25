'use client';

import React, { useState } from 'react';
import {
  BOOK_CATEGORIES,
  BOOK_FORMATS,
  Book,
  BookCategory,
  BookFormat,
} from '@/lib/types';
import { Plus, Trash2, AlertTriangle, CheckCircle2, X } from 'lucide-react';

interface CatalogAdminPanelProps {
  books: Book[];
  onAdjustStock: (
    bookId: string,
    payload: { delta?: number; stock?: number; available?: boolean }
  ) => Promise<void>;
  onCreateBook: (payload: {
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
  }) => Promise<void>;
  onDeleteBook: (bookId: string) => Promise<void>;
}

const INITIAL_FORM = {
  title: '',
  author: '',
  isbn: '',
  description: '',
  category: 'Programación' as BookCategory,
  format: 'EPUB' as BookFormat,
  price: '19.90',
  stock: '15',
  pages: '280',
  coverUrl: '/covers/book-01.svg',
};

export function CatalogAdminPanel({
  books,
  onAdjustStock,
  onCreateBook,
  onDeleteBook,
}: CatalogAdminPanelProps) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyBookId, setBusyBookId] = useState<string | null>(null);

  const lowStockCount = books.filter(
    (b) => b.available && b.stock > 0 && b.stock <= 5
  ).length;
  const outOfStockCount = books.filter(
    (b) => !b.available || b.stock === 0
  ).length;

  const handleStockAction = async (
    bookId: string,
    payload: { delta?: number; stock?: number; available?: boolean }
  ) => {
    setBusyBookId(bookId);
    try {
      await onAdjustStock(bookId, payload);
    } finally {
      setBusyBookId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await onCreateBook({
        title: form.title.trim(),
        author: form.author.trim(),
        isbn: form.isbn.trim(),
        description: form.description.trim(),
        category: form.category,
        format: form.format,
        price: Number(form.price),
        stock: Math.floor(Number(form.stock)),
        available: Number(form.stock) > 0,
        coverUrl: form.coverUrl,
        pages: Math.max(1, Math.floor(Number(form.pages))),
        language: 'Español',
        publishedYear: 2026,
      });
      setForm(INITIAL_FORM);
      setShowModal(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'No se pudo crear el libro.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-800 bg-espresso p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-xs text-stone-400">Total títulos</p>
            <p className="text-2xl font-bold text-parchment">{books.length}</p>
          </div>
          <div className="h-8 w-px bg-stone-800" />
          <div>
            <p className="text-xs text-amber-300">Stock bajo (≤ 5)</p>
            <p className="text-2xl font-bold text-amber-400">{lowStockCount}</p>
          </div>
          <div className="h-8 w-px bg-stone-800" />
          <div>
            <p className="text-xs text-rose-300">Agotados</p>
            <p className="text-2xl font-bold text-rose-400">
              {outOfStockCount}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-obsidian transition-colors hover:bg-amber-500"
        >
          <Plus className="h-4 w-4" />
          <span>Nuevo libro</span>
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-stone-800 bg-espresso">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-800 bg-obsidian/60 text-xs uppercase tracking-wider text-stone-400">
            <tr>
              <th className="px-4 py-3.5">Libro</th>
              <th className="px-4 py-3.5">Categoría / Formato</th>
              <th className="px-4 py-3.5">Precio</th>
              <th className="px-4 py-3.5">Stock</th>
              <th className="px-4 py-3.5">Estado</th>
              <th className="px-4 py-3.5 text-right">Acciones rápidas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-800/80">
            {books.map((book) => {
              const isBusy = busyBookId === book.id;
              const isOut = !book.available || book.stock === 0;
              const isLow = !isOut && book.stock <= 5;
              return (
                <tr key={book.id} className="hover:bg-walnut/30">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <img
                        src={book.coverUrl}
                        alt={book.title}
                        className="h-12 w-10 rounded-md object-cover border border-stone-700"
                      />
                      <div>
                        <p className="font-medium text-parchment">
                          {book.title}
                        </p>
                        <p className="text-xs text-stone-400">
                          {book.author} · {book.isbn}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-stone-300">
                    <div>{book.category}</div>
                    <div className="text-stone-400">{book.format}</div>
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-amber-400">
                    ${book.price.toFixed(2)}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isBusy || book.stock <= 0}
                        onClick={() =>
                          handleStockAction(book.id, { delta: -1 })
                        }
                        className="rounded-md border border-stone-700 bg-obsidian px-2 py-0.5 text-xs text-stone-200 hover:border-amber-500 disabled:opacity-40"
                      >
                        -1
                      </button>
                      <span className="min-w-[2.2rem] text-center font-mono font-semibold text-parchment">
                        {book.stock}
                      </span>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          handleStockAction(book.id, { delta: 1 })
                        }
                        className="rounded-md border border-stone-700 bg-obsidian px-2 py-0.5 text-xs text-stone-200 hover:border-amber-500 disabled:opacity-40"
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          handleStockAction(book.id, { delta: 5 })
                        }
                        className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300 hover:bg-amber-500/20 disabled:opacity-40"
                      >
                        +5
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    {isOut ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs text-rose-300 border border-rose-500/30">
                        <AlertTriangle className="h-3 w-3" />
                        Agotado
                      </span>
                    ) : isLow ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs text-amber-300 border border-amber-500/30">
                        <AlertTriangle className="h-3 w-3" />
                        Stock bajo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="h-3 w-3" />
                        Disponible
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          handleStockAction(book.id, {
                            stock: book.stock,
                            available: !book.available,
                          })
                        }
                        className="rounded-lg border border-stone-700 bg-obsidian px-2.5 py-1 text-xs text-stone-300 hover:border-stone-500"
                      >
                        {book.available ? 'Pausar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onDeleteBook(book.id)}
                        className="rounded-lg border border-rose-500/30 bg-rose-950/30 p-1.5 text-rose-300 hover:bg-rose-900/50"
                        title="Eliminar libro"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-stone-700 bg-espresso p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="font-display text-xl font-semibold text-parchment">
                Agregar libro al catálogo
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-walnut hover:text-parchment"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              {formError && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-200">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-stone-300">
                    Título
                  </label>
                  <input
                    required
                    minLength={2}
                    value={form.title}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, title: e.target.value }))
                    }
                    className="w-full rounded-xl border border-stone-700 bg-obsidian px-3 py-2 text-sm text-parchment focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-stone-300">
                    Autor
                  </label>
                  <input
                    required
                    minLength={2}
                    value={form.author}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, author: e.target.value }))
                    }
                    className="w-full rounded-xl border border-stone-700 bg-obsidian px-3 py-2 text-sm text-parchment focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs text-stone-300">
                    ISBN
                  </label>
                  <input
                    required
                    minLength={5}
                    placeholder="978-628-9501-99-1"
                    value={form.isbn}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, isbn: e.target.value }))
                    }
                    className="w-full rounded-xl border border-stone-700 bg-obsidian px-3 py-2 text-sm text-parchment focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-stone-300">
                    Precio (USD)
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.50"
                    value={form.price}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, price: e.target.value }))
                    }
                    className="w-full rounded-xl border border-stone-700 bg-obsidian px-3 py-2 text-sm text-parchment focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-stone-300">
                    Stock inicial
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={form.stock}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, stock: e.target.value }))
                    }
                    className="w-full rounded-xl border border-stone-700 bg-obsidian px-3 py-2 text-sm text-parchment focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-stone-300">
                    Categoría
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        category: e.target.value as BookCategory,
                      }))
                    }
                    className="w-full rounded-xl border border-stone-700 bg-obsidian px-3 py-2 text-sm text-parchment focus:border-amber-500 focus:outline-none"
                  >
                    {BOOK_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-stone-300">
                    Formato
                  </label>
                  <select
                    value={form.format}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        format: e.target.value as BookFormat,
                      }))
                    }
                    className="w-full rounded-xl border border-stone-700 bg-obsidian px-3 py-2 text-sm text-parchment focus:border-amber-500 focus:outline-none"
                  >
                    {BOOK_FORMATS.map((fmt) => (
                      <option key={fmt} value={fmt}>
                        {fmt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-stone-300">
                  Descripción
                </label>
                <textarea
                  required
                  minLength={10}
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  className="w-full rounded-xl border border-stone-700 bg-obsidian px-3 py-2 text-sm text-parchment focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-stone-700 px-4 py-2 text-sm text-stone-300 hover:bg-walnut"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-amber-600 px-5 py-2 text-sm font-semibold text-obsidian hover:bg-amber-500 disabled:opacity-50"
                >
                  {submitting ? 'Guardando...' : 'Guardar libro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
