'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import {
  BOOK_CATEGORIES,
  BOOK_FORMATS,
  Book,
} from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { createLibroYaSocket, RealtimeStockEvent } from '@/lib/socket';
import { BookCard } from '@/components/BookCard';
import { BookDetailModal } from '@/components/BookDetailModal';
import { Search, SlidersHorizontal } from 'lucide-react';

export default function CatalogoPage() {
  const { token } = useAuth();
  const { items, addItem, syncBookStock } = useCart();

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<string>('Todos');
  const [format, setFormat] = useState<string>('Todos');
  const [search, setSearch] = useState<string>('');
  const [onlyAvailable, setOnlyAvailable] = useState<boolean>(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listBooks({
        category,
        format,
        search,
        inStock: onlyAvailable,
      });
      setBooks(res.books);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo cargar el catálogo de libros.'
      );
    } finally {
      setLoading(false);
    }
  }, [category, format, search, onlyAvailable]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchBooks();
    }, 180);
    return () => clearTimeout(timer);
  }, [fetchBooks]);

  // Escucha cambios de stock en vivo cuando hay sesión autenticada
  useEffect(() => {
    if (!token) return;
    const socket = createLibroYaSocket(token);
    socket.on('stock:updated', (updates: RealtimeStockEvent[]) => {
      setBooks((prev) =>
        prev.map((book) => {
          const hit = updates.find((u) => u.bookId === book.id);
          return hit
            ? { ...book, stock: hit.stock, available: hit.available }
            : book;
        })
      );
      for (const upd of updates) {
        syncBookStock(upd.bookId, upd.stock, upd.available);
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [token, syncBookStock]);

  const qtyMap = new Map(items.map((it) => [it.book.id, it.quantity]));

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 border-b border-stone-800 pb-5">
        <h1 className="font-display text-3xl font-semibold text-parchment">
          Catálogo de Libros Electrónicos
        </h1>
        <p className="text-sm text-stone-400">
          Filtra por categoría, formato de lectura o disponibilidad de stock.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-stone-800 bg-espresso p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título, autor o ISBN..."
              className="w-full rounded-xl border border-stone-700 bg-obsidian py-2.5 pl-9 pr-3 text-sm text-parchment placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <select
            aria-label="Filtrar por formato"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="rounded-xl border border-stone-700 bg-obsidian px-3 py-2.5 text-sm text-parchment focus:border-amber-500 focus:outline-none"
          >
            <option value="Todos">Todos los formatos</option>
            {BOOK_FORMATS.map((fmt) => (
              <option key={fmt} value={fmt}>
                {fmt}
              </option>
            ))}
          </select>

          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-stone-700 bg-obsidian px-3 py-2.5 text-sm text-stone-200 hover:border-amber-500/40">
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(e) => setOnlyAvailable(e.target.checked)}
              className="h-4 w-4 accent-amber-500"
            />
            <SlidersHorizontal className="h-3.5 w-3.5 text-amber-400" />
            <span>Solo con stock</span>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {['Todos', ...BOOK_CATEGORIES].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                category === cat
                  ? 'bg-amber-600 text-obsidian font-semibold'
                  : 'border border-stone-700 bg-obsidian text-stone-300 hover:border-amber-500/40 hover:text-parchment'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-96 animate-pulse rounded-2xl border border-stone-800 bg-espresso"
            />
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="rounded-2xl border border-stone-800 bg-espresso p-10 text-center">
          <p className="text-base font-medium text-parchment">
            No encontramos libros con esos criterios.
          </p>
          <button
            type="button"
            onClick={() => {
              setCategory('Todos');
              setFormat('Todos');
              setSearch('');
              setOnlyAvailable(false);
            }}
            className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/20"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              inCartQty={qtyMap.get(book.id) || 0}
              onAdd={(b) => addItem(b, 1)}
              onInspect={(b) => setSelectedBook(b)}
            />
          ))}
        </div>
      )}

      <BookDetailModal
        book={selectedBook}
        inCartQty={selectedBook ? qtyMap.get(selectedBook.id) || 0 : 0}
        onClose={() => setSelectedBook(null)}
        onAdd={(b) => addItem(b, 1)}
      />
    </div>
  );
}
