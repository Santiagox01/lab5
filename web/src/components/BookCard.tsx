'use client';

import React from 'react';
import { Book } from '@/lib/types';
import { Eye, Plus, Check } from 'lucide-react';

interface BookCardProps {
  book: Book;
  inCartQty: number;
  onAdd: (book: Book) => void;
  onInspect: (book: Book) => void;
}

export function BookCard({
  book,
  inCartQty,
  onAdd,
  onInspect,
}: BookCardProps) {
  const isOutOfStock = !book.available || book.stock <= 0;
  const isLowStock = !isOutOfStock && book.stock <= 5;
  const reachedMax = !isOutOfStock && inCartQty >= book.stock;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-stone-800 bg-espresso transition-all hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-950/20">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-obsidian">
        <img
          src={book.coverUrl}
          alt={`Portada de ${book.title}`}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-x-3 top-3 flex flex-wrap gap-1.5">
          <span className="rounded-md bg-obsidian/85 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-amber-300 backdrop-blur-sm border border-stone-700">
            {book.category}
          </span>
          <span className="rounded-md bg-obsidian/85 px-2 py-0.5 text-[11px] font-medium text-stone-200 backdrop-blur-sm border border-stone-700">
            {book.format}
          </span>
        </div>

        <div className="absolute bottom-3 right-3">
          {isOutOfStock ? (
            <span
              data-testid="stock-badge"
              className="whitespace-nowrap rounded-full bg-rose-950/90 px-2.5 py-0.5 text-xs font-medium text-rose-300 border border-rose-500/40"
            >
              Agotado
            </span>
          ) : isLowStock ? (
            <span
              data-testid="stock-badge"
              className="whitespace-nowrap rounded-full bg-amber-950/90 px-2.5 py-0.5 text-xs font-medium text-amber-300 border border-amber-500/40"
            >
              {`Últimas ${book.stock} uds.`}
            </span>
          ) : (
            <span
              data-testid="stock-badge"
              className="whitespace-nowrap rounded-full bg-emerald-950/90 px-2.5 py-0.5 text-xs font-medium text-emerald-300 border border-emerald-500/40"
            >
              {`Stock: ${book.stock}`}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg font-semibold leading-snug text-parchment line-clamp-2">
            {book.title}
          </h3>
          <span className="shrink-0 text-lg font-semibold text-amber-400">
            ${book.price.toFixed(2)}
          </span>
        </div>

        <p className="mt-1 text-xs font-medium text-stone-400">
          {book.author} · {book.pages} págs.
        </p>

        <p className="mt-2.5 flex-1 text-sm leading-relaxed text-stone-300 line-clamp-3">
          {book.description}
        </p>

        <div className="mt-4 flex items-center gap-2 border-t border-stone-800/80 pt-3.5">
          <button
            type="button"
            onClick={() => onInspect(book)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-700 bg-walnut/60 px-3 py-2 text-xs font-medium text-stone-200 transition-colors hover:border-stone-500 hover:bg-walnut"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Detalles</span>
          </button>

          <button
            type="button"
            disabled={isOutOfStock || reachedMax}
            onClick={() => onAdd(book)}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
              isOutOfStock
                ? 'cursor-not-allowed bg-stone-800 text-stone-500'
                : reachedMax
                  ? 'cursor-not-allowed bg-emerald-900/40 text-emerald-300 border border-emerald-700/40'
                  : 'bg-amber-600 text-obsidian hover:bg-amber-500'
            }`}
          >
            {isOutOfStock ? (
              <span>Sin existencias</span>
            ) : reachedMax ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Máximo en carrito ({inCartQty})</span>
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                <span>
                  {inCartQty > 0
                    ? `Añadir otro (${inCartQty} en carrito)`
                    : 'Añadir al carrito'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
