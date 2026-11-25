'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api, ApiError } from '@/lib/api';
import { Order, ORDER_STATUS_META, OrderStatus } from '@/lib/types';
import { createLibroYaSocket } from '@/lib/socket';
import {
  CheckCircle2,
  Download,
  Radio,
  RefreshCw,
  Truck,
  WifiOff,
} from 'lucide-react';

const FLOW_STEPS: OrderStatus[] = ['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED'];

function PedidosContent() {
  const searchParams = useSearchParams();
  const paidOrderNumber = searchParams.get('paid');
  const { user, token, loading: authLoading } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.getMyOrders(token);
      setOrders(res.orders);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo cargar tu historial de pedidos.'
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      setLoading(false);
      return;
    }

    void loadOrders();

    const socket = createLibroYaSocket(token);
    socket.on('connect', () => {
      setSocketConnected(true);
      // Resincronización REST automática tras reconexión
      void loadOrders();
    });
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('connect_error', () => setSocketConnected(false));

    const handleRealtimeUpdate = () => {
      void loadOrders();
    };
    socket.on('order:updated', handleRealtimeUpdate);
    socket.on('order:statusChanged', handleRealtimeUpdate);

    return () => {
      socket.disconnect();
    };
  }, [authLoading, token, loadOrders]);

  const downloadLicense = (order: Order) => {
    const content = [
      'LICENCIA DIGITAL VERIFICADA — LIBROYA',
      `Pedido: ${order.orderNumber}`,
      `Fecha de pago: ${order.paidAt ? new Date(order.paidAt).toLocaleString('es-CO') : 'Confirmado'}`,
      `Titular: ${order.shippingAddress.fullName}`,
      '',
      'Títulos incluidos:',
      ...order.items.map(
        (it) =>
          `- ${it.title} (${it.author}) | Formato: ${it.format} | Cantidad: ${it.quantity}`
      ),
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `licencia-${order.orderNumber}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading || loading) {
    return (
      <div className="rounded-2xl border border-stone-800 bg-espresso p-8 text-center text-sm text-stone-400">
        Cargando historial y canal de seguimiento en vivo...
      </div>
    );
  }

  if (!user || !token) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-stone-800 bg-espresso p-8 text-center space-y-4">
        <h1 className="font-display text-2xl font-semibold text-parchment">
          Mis pedidos y licencias
        </h1>
        <p className="text-sm text-stone-400">
          Inicia sesión para ver tus compras y el progreso en tiempo real de tus
          envíos.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-obsidian hover:bg-amber-500"
        >
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-800 pb-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-parchment">
            Mis pedidos y envíos
          </h1>
          <p className="text-sm text-stone-400">
            Seguimiento en tiempo real de tus libros electrónicos y entregas.
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
            onClick={() => void loadOrders()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-700 bg-espresso px-3 py-1.5 text-xs text-stone-200 hover:border-amber-500/50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Actualizar</span>
          </button>
        </div>
      </header>

      {paidOrderNumber && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-950/35 p-4 text-sm text-emerald-200">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <span>
            ¡Pedido <strong>{paidOrderNumber}</strong> confirmado y pagado con
            PayPal Sandbox! Ya está disponible en logística y licencias.
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-stone-800 bg-espresso p-10 text-center space-y-4">
          <p className="text-base text-stone-300">
            Todavía no has realizado ningún pedido.
          </p>
          <Link
            href="/catalogo"
            className="inline-block rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-obsidian hover:bg-amber-500"
          >
            Explorar catálogo
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const meta = ORDER_STATUS_META[order.status];
            const currentStepIdx = FLOW_STEPS.indexOf(order.status);
            const isPaid = order.paymentStatus === 'CAPTURED';

            return (
              <article
                key={order.id}
                className="rounded-2xl border border-stone-800 bg-espresso p-5 sm:p-6 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-sm font-semibold text-amber-400">
                        {order.orderNumber}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.badgeClass}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-stone-400">
                      {new Date(order.createdAt).toLocaleString('es-CO')} ·{' '}
                      {order.shippingAddress.street},{' '}
                      {order.shippingAddress.city}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-bold text-parchment">
                      ${order.total.toFixed(2)} USD
                    </p>
                    {order.trackingCode && (
                      <p className="inline-flex items-center gap-1 text-xs font-mono text-violet-300">
                        <Truck className="h-3.5 w-3.5" />
                        Guía: {order.trackingCode}
                      </p>
                    )}
                  </div>
                </div>

                {isPaid && currentStepIdx >= 0 && (
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {FLOW_STEPS.map((step, idx) => {
                      const active = idx <= currentStepIdx;
                      return (
                        <div key={step} className="space-y-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              active ? 'bg-amber-500' : 'bg-stone-800'
                            }`}
                          />
                          <p
                            className={`text-[11px] font-medium ${
                              active ? 'text-amber-300' : 'text-stone-500'
                            }`}
                          >
                            {ORDER_STATUS_META[step].label}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                <ul className="space-y-1.5 text-sm text-stone-200">
                  {order.items.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between gap-2"
                    >
                      <span>
                        {item.quantity}× {item.title}{' '}
                        <span className="text-xs text-stone-400">
                          ({item.format})
                        </span>
                      </span>
                      <span className="text-stone-300">
                        ${item.subtotal.toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-stone-800/80 pt-3">
                  {order.status === 'PENDING_PAYMENT' && (
                    <Link
                      href={`/checkout/${order.id}`}
                      className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-obsidian hover:bg-amber-500"
                    >
                      Completar pago en PayPal
                    </Link>
                  )}

                  {isPaid && (
                    <button
                      type="button"
                      onClick={() => downloadLicense(order)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Descargar certificado de licencia</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PedidosPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-stone-800 bg-espresso p-8 text-center text-sm text-stone-400">
          Cargando historial...
        </div>
      }
    >
      <PedidosContent />
    </Suspense>
  );
}
