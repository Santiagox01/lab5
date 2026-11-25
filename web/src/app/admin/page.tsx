'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api, ApiError } from '@/lib/api';
import {
  Book,
  BookCategory,
  BookFormat,
  Order,
  OrderStatus,
} from '@/lib/types';
import { createLibroYaSocket, RealtimeStockEvent } from '@/lib/socket';
import { KanbanBoard } from '@/components/KanbanBoard';
import { CatalogAdminPanel } from '@/components/CatalogAdminPanel';
import {
  Boxes,
  Kanban,
  Radio,
  ShieldAlert,
  WifiOff,
  RefreshCw,
} from 'lucide-react';

export default function AdminPage() {
  const { user, token, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<'shipments' | 'catalog'>(
    'shipments'
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  const loadAll = useCallback(async () => {
    if (!token || user?.role !== 'administrador') return;
    try {
      const [ordersRes, booksRes] = await Promise.all([
        api.getAdminOrders(token),
        api.listBooks(),
      ]);
      setOrders(ordersRes.orders);
      setBooks(booksRes.books);
      setBannerError(null);
    } catch (err) {
      setBannerError(
        err instanceof ApiError
          ? err.message
          : 'Error al cargar datos de gestión.'
      );
    } finally {
      setLoadingData(false);
    }
  }, [token, user?.role]);

  useEffect(() => {
    if (authLoading) return;
    if (!token || user?.role !== 'administrador') {
      setLoadingData(false);
      return;
    }

    void loadAll();

    const socket = createLibroYaSocket(token);
    socket.on('connect', () => {
      setSocketConnected(true);
      void loadAll();
    });
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('connect_error', () => setSocketConnected(false));

    socket.on('order:created', () => {
      void api.getAdminOrders(token).then((res) => setOrders(res.orders));
    });
    socket.on('order:statusChanged', () => {
      void api.getAdminOrders(token).then((res) => setOrders(res.orders));
    });
    socket.on('stock:updated', (updates: RealtimeStockEvent[]) => {
      setBooks((prev) =>
        prev.map((b) => {
          const hit = updates.find((u) => u.bookId === b.id);
          return hit ? { ...b, stock: hit.stock, available: hit.available } : b;
        })
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [authLoading, token, user?.role, loadAll]);

  const handleTransition = async (
    orderId: string,
    nextStatus: OrderStatus,
    trackingCode?: string
  ) => {
    if (!token) return;
    setBannerError(null);
    try {
      const res = await api.updateOrderStatus(token, orderId, {
        status: nextStatus,
        trackingCode,
      });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...res.order } : o))
      );
    } catch (err) {
      setBannerError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo cambiar el estado del pedido.'
      );
    }
  };

  const handleAdjustStock = async (
    bookId: string,
    payload: { delta?: number; stock?: number; available?: boolean }
  ) => {
    if (!token) return;
    setBannerError(null);
    try {
      const res = await api.adjustStock(token, bookId, payload);
      setBooks((prev) => prev.map((b) => (b.id === bookId ? res.book : b)));
    } catch (err) {
      setBannerError(
        err instanceof ApiError ? err.message : 'No se pudo ajustar el stock.'
      );
    }
  };

  const handleCreateBook = async (payload: {
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
  }) => {
    if (!token) return;
    const res = await api.createBook(token, payload);
    setBooks((prev) => [...prev, res.book]);
  };

  const handleDeleteBook = async (bookId: string) => {
    if (!token) return;
    setBannerError(null);
    try {
      await api.deleteBook(token, bookId);
      setBooks((prev) => prev.filter((b) => b.id !== bookId));
    } catch (err) {
      setBannerError(
        err instanceof ApiError ? err.message : 'No se pudo eliminar el libro.'
      );
    }
  };

  if (authLoading || loadingData) {
    return (
      <div className="rounded-2xl border border-stone-800 bg-espresso p-8 text-center text-sm text-stone-400">
        Cargando consola de gestión y envíos...
      </div>
    );
  }

  if (!user || user.role !== 'administrador') {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rose-500/40 bg-rose-950/30 p-8 text-center space-y-4">
        <ShieldAlert className="mx-auto h-10 w-10 text-rose-400" />
        <h1 className="font-display text-2xl font-semibold text-parchment">
          Acceso denegado (403)
        </h1>
        <p className="text-sm text-stone-300">
          El tablero de gestión de envíos y control de inventario está
          restringido exclusivamente a usuarios con rol{' '}
          <strong>administrador</strong>.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Link
            href="/catalogo"
            className="rounded-xl border border-stone-700 bg-espresso px-4 py-2 text-xs font-medium text-parchment"
          >
            Volver al catálogo
          </Link>
          {!user && (
            <Link
              href="/login"
              className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-obsidian"
            >
              Iniciar sesión
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-800 pb-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-parchment">
            Gestión de Envíos y Catálogo
          </h1>
          <p className="text-sm text-stone-400">
            Arrastra pedidos entre etapas válidas o administra el stock en
            tiempo real.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
              socketConnected
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                : 'border-amber-500/40 bg-amber-500/15 text-amber-300'
            }`}
          >
            {socketConnected ? (
              <>
                <Radio className="h-3.5 w-3.5 animate-pulse" />
                <span>En vivo</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5" />
                <span>Reconectando...</span>
              </>
            )}
          </span>

          <button
            type="button"
            onClick={() => void loadAll()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-700 bg-espresso px-3 py-1.5 text-xs text-stone-200 hover:border-amber-500/50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Sincronizar</span>
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('shipments')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'shipments'
              ? 'bg-amber-600 text-obsidian font-semibold'
              : 'border border-stone-800 bg-espresso text-stone-300 hover:text-parchment'
          }`}
        >
          <Kanban className="h-4 w-4" />
          <span>Tablero Kanban de Envíos ({orders.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'catalog'
              ? 'bg-amber-600 text-obsidian font-semibold'
              : 'border border-stone-800 bg-espresso text-stone-300 hover:text-parchment'
          }`}
        >
          <Boxes className="h-4 w-4" />
          <span>Catálogo y Stock ({books.length})</span>
        </button>
      </div>

      {bannerError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-3.5 text-sm text-rose-200"
        >
          {bannerError}
        </div>
      )}

      {activeTab === 'shipments' ? (
        <KanbanBoard orders={orders} onTransition={handleTransition} />
      ) : (
        <CatalogAdminPanel
          books={books}
          onAdjustStock={handleAdjustStock}
          onCreateBook={handleCreateBook}
          onDeleteBook={handleDeleteBook}
        />
      )}
    </div>
  );
}
