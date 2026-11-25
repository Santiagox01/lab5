'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Book } from '@/lib/types';
import { useCart } from '@/context/CartContext';
import { BookCard } from '@/components/BookCard';
import { BookDetailModal } from '@/components/BookDetailModal';
import {
  ArrowRight,
  ShieldCheck,
  Radio,
  Boxes,
  Sparkles,
} from 'lucide-react';

export default function HomePage() {
  const [featuredBooks, setFeaturedBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const { items, addItem } = useCart();

  useEffect(() => {
    api
      .listBooks({ available: true })
      .then((res) => setFeaturedBooks(res.books.slice(0, 3)))
      .catch(() => setFeaturedBooks([]))
      .finally(() => setLoading(false));
  }, []);

  const qtyMap = new Map(items.map((it) => [it.book.id, it.quantity]));

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl border border-stone-800 bg-gradient-to-br from-espresso via-obsidian to-walnut/70 p-8 sm:p-12">
        <div className="max-w-2xl space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-medium text-amber-300">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Ediciones digitales, stock en vivo y despachos trazables</span>
          </div>

          <h1 className="font-display text-4xl font-semibold leading-tight text-parchment sm:text-5xl">
            Tu biblioteca técnica y literaria, con entregas y stock en tiempo
            real.
          </h1>

          <p className="text-base leading-relaxed text-stone-300">
            Explora libros electrónicos en EPUB, PDF, Audiolibro y paquetes con
            edición impresa. Recibe licencias inmediatas tras pago verificado en
            PayPal Sandbox y sigue cada etapa de envío desde nuestra plataforma.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/catalogo"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-obsidian transition-colors hover:bg-amber-500"
            >
              <span>Explorar catálogo</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-stone-700 bg-espresso px-5 py-3 text-sm font-medium text-parchment transition-colors hover:border-amber-500/50 hover:bg-walnut"
            >
              <span>Iniciar sesión</span>
            </Link>
            <Link
              href="/registro"
              className="inline-flex items-center gap-2 rounded-xl border border-stone-800 bg-obsidian/70 px-5 py-3 text-sm font-medium text-stone-300 transition-colors hover:text-parchment"
            >
              <span>Crear cuenta de cliente</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-stone-800 bg-espresso p-5">
          <Boxes className="h-5 w-5 text-amber-400" />
          <h2 className="mt-3 font-display text-lg font-semibold text-parchment">
            Control real de inventario
          </h2>
          <p className="mt-1.5 text-sm text-stone-400">
            Validación atómica de existencias antes y durante la captura del
            pago, sin sobreventa.
          </p>
        </div>

        <div className="rounded-2xl border border-stone-800 bg-espresso p-5">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          <h2 className="mt-3 font-display text-lg font-semibold text-parchment">
            Pagos verificados en backend
          </h2>
          <p className="mt-1.5 text-sm text-stone-400">
            Precios recalculados en servidor y captura idempotente integrada con
            PayPal Sandbox.
          </p>
        </div>

        <div className="rounded-2xl border border-stone-800 bg-espresso p-5">
          <Radio className="h-5 w-5 text-sky-400" />
          <h2 className="mt-3 font-display text-lg font-semibold text-parchment">
            Seguimiento vía WebSockets
          </h2>
          <p className="mt-1.5 text-sm text-stone-400">
            Actualización instantánea entre el panel Kanban logístico y el
            historial del comprador.
          </p>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold text-parchment">
              Títulos destacados
            </h2>
            <p className="text-sm text-stone-400">
              Selección disponible para compra inmediata.
            </p>
          </div>
          <Link
            href="/catalogo"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-400 hover:text-amber-300"
          >
            <span>Ver todo el catálogo</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-96 animate-pulse rounded-2xl border border-stone-800 bg-espresso"
              />
            ))}
          </div>
        ) : featuredBooks.length === 0 ? (
          <div className="rounded-2xl border border-stone-800 bg-espresso p-8 text-center text-sm text-stone-400">
            Aún no hay títulos cargados en el catálogo. Verifica que el backend
            esté activo.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {featuredBooks.map((book) => (
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
      </section>

      <BookDetailModal
        book={selectedBook}
        inCartQty={selectedBook ? qtyMap.get(selectedBook.id) || 0 : 0}
        onClose={() => setSelectedBook(null)}
        onAdd={(b) => addItem(b, 1)}
      />
    </div>
  );
}
