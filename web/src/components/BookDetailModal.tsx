'use client';

import React from 'react';
import { Book } from '@/lib/types';
import { X, Plus, BookOpenCheck, Layers, Globe } from 'lucide-react';

interface BookDetailModalProps {
  book: Book | null;
  inCartQty: number;
  onClose: () => void;
  onAdd: (book: Book) => void;
}

export function BookDetailModal({
  book,
  inCartQty,
  onClose,
  onAdd,
}: BookDetailModalProps) {
  if (!book) return null;

  const isOutOfStock = !book.available || book.stock <= 0;
  const reachedMax = !isOutOfStock && inCartQty >= book.stock;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="book-modal-title"
    >
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-stone-700 bg-espresso shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-lg bg-obsidian/80 p-2 text-stone-300 hover:bg-walnut hover:text-parchment"
          aria-label="Cerrar detalles"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-5">
          <div className="bg-obsidian md:col-span-2">
            <img
              src={book.coverUrl}
              alt={book.title}
              className="h-full max-h-80 w-full object-cover md:max-h-full"
            />
          </div>

          <div className="flex flex-col p-6 md:col-span-3">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-md bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-300 border border-amber-500/30">
                {book.category}
              </span>
              <span className="rounded-md bg-walnut px-2.5 py-0.5 text-xs text-stone-200 border border-stone-700">
                {book.format}
              </span>
            </div>

            <h2
              id="book-modal-title"
              className="mt-3 font-display text-2xl font-semibold text-parchment"
            >
              {book.title}
            </h2>
            <p className="mt-1 text-sm text-stone-400">por {book.author}</p>

            <p className="mt-4 text-sm leading-relaxed text-stone-200">
              {book.description}
            </p>

            <dl className="mt-5 grid grid-cols-2 gap-3 rounded-xl border border-stone-800 bg-obsidian/60 p-3.5 text-xs">
              <div className="flex items-center gap-2 text-stone-300">
                <BookOpenCheck className="h-4 w-4 text-amber-400" />
                <span>{book.pages} páginas</span>
              </div>
              <div className="flex items-center gap-2 text-stone-300">
                <Globe className="h-4 w-4 text-amber-400" />
                <span>
                  {book.language} ({book.publishedYear})
                </span>
              </div>
              <div className="flex items-center gap-2 text-stone-300">
                <Layers className="h-4 w-4 text-amber-400" />
                <span>
                  Stock:{' '}
                  <strong className="text-parchment">
                    {isOutOfStock ? 'Agotado' : `${book.stock} disponibles`}
                  </strong>
                </span>
              </div>
              <div className="text-stone-400">ISBN: {book.isbn}</div>
            </dl>

            <div className="mt-6 flex items-center justify-between gap-4 border-t border-stone-800 pt-4">
              <div>
                <p className="text-xs text-stone-400">Precio unitario</p>
                <p className="text-2xl font-bold text-amber-400">
                  ${book.price.toFixed(2)} USD
                </p>
              </div>

              <button
                type="button"
                disabled={isOutOfStock || reachedMax}
                onClick={() => {
                  onAdd(book);
                  onClose();
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
                  isOutOfStock || reachedMax
                    ? 'cursor-not-allowed bg-stone-800 text-stone-500'
                    : 'bg-amber-600 text-obsidian hover:bg-amber-500'
                }`}
              >
                <Plus className="h-4 w-4" />
                <span>
                  {isOutOfStock
                    ? 'Agotado'
                    : reachedMax
                      ? 'Máximo en carrito'
                      : 'Añadir al carrito'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
