'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { api, ApiError } from '@/lib/api';
import { Order, ORDER_STATUS_META } from '@/lib/types';
import { PayPalCheckout } from '@/components/PayPalCheckout';
import { ArrowLeft, CheckCircle2, MapPin } from 'lucide-react';

export default function CheckoutOrderPage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();
  const { clearCart } = useCart();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!token || !params?.orderId) {
      setLoading(false);
      return;
    }

    api
      .getOrderById(token, params.orderId)
      .then((res) => setOrder(res.order))
      .catch((err) =>
        setError(
          err instanceof ApiError
            ? err.message
            : 'No fue posible cargar los detalles del pedido.'
        )
      )
      .finally(() => setLoading(false));
  }, [authLoading, token, params?.orderId]);

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-stone-800 bg-espresso p-8 text-center text-sm text-stone-400">
        Cargando resumen verificado del pedido...
      </div>
    );
  }

  if (!user || !token) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-stone-800 bg-espresso p-8 text-center space-y-4">
        <h1 className="font-display text-2xl font-semibold text-parchment">
          Inicia sesión para completar el pago
        </h1>
        <Link
          href="/login"
          className="inline-block rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-obsidian hover:bg-amber-500"
        >
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rose-500/40 bg-rose-950/30 p-6 text-center space-y-4">
        <p className="text-sm text-rose-200">
          {error || 'No se encontró el pedido solicitado.'}
        </p>
        <Link
          href="/catalogo"
          className="inline-flex items-center gap-2 rounded-xl border border-stone-700 bg-espresso px-4 py-2 text-xs text-parchment"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Volver al catálogo</span>
        </Link>
      </div>
    );
  }

  const alreadyPaid =
    order.paymentStatus === 'CAPTURED' || order.status !== 'PENDING_PAYMENT';
  const statusMeta = ORDER_STATUS_META[order.status];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 pb-4">
        <div>
          <p className="font-mono text-xs text-amber-400">
            Orden {order.orderNumber}
          </p>
          <h1 className="font-display text-3xl font-semibold text-parchment">
            Checkout Seguro
          </h1>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${statusMeta.badgeClass}`}
        >
          {statusMeta.label}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <section className="space-y-4 rounded-2xl border border-stone-800 bg-espresso p-6 md:col-span-7">
          <h2 className="font-display text-lg font-semibold text-parchment">
            Resumen recalculado por el servidor
          </h2>

          <ul className="divide-y divide-stone-800">
            {order.items.map((item, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-parchment">
                    {item.quantity}× {item.title}
                  </p>
                  <p className="text-xs text-stone-400">
                    {item.author} · {item.format} · ${item.unitPrice.toFixed(2)}{' '}
                    c/u
                  </p>
                </div>
                <span className="font-semibold text-parchment">
                  ${item.subtotal.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>

          <div className="rounded-xl border border-stone-800 bg-obsidian/60 p-3.5 text-xs text-stone-300 space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-parchment">
              <MapPin className="h-3.5 w-3.5 text-amber-400" />
              <span>Entrega: {order.shippingAddress.fullName}</span>
            </div>
            <p>
              {order.shippingAddress.street}, {order.shippingAddress.city} (
              {order.shippingAddress.postalCode}),{' '}
              {order.shippingAddress.country}
            </p>
          </div>

          <div className="space-y-1.5 border-t border-stone-800 pt-3 text-sm">
            <div className="flex justify-between text-stone-400">
              <span>Subtotal</span>
              <span>${order.subtotal.toFixed(2)} USD</span>
            </div>
            <div className="flex justify-between text-stone-400">
              <span>Costo de envío ({order.shippingMethod})</span>
              <span>${order.shippingCost.toFixed(2)} USD</span>
            </div>
            <div className="flex justify-between pt-2 text-lg font-bold text-parchment">
              <span>Total a pagar</span>
              <span className="text-amber-400">
                ${order.total.toFixed(2)} USD
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-stone-800 bg-espresso p-6 md:col-span-5">
          {alreadyPaid ? (
            <div className="space-y-4 text-center py-6">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
              <h2 className="font-display text-xl font-semibold text-parchment">
                Pago confirmado
              </h2>
              <p className="text-xs text-stone-300">
                Este pedido ya fue capturado y enviado al equipo de despacho.
              </p>
              <Link
                href="/pedidos"
                className="inline-block rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-obsidian hover:bg-amber-500"
              >
                Ver mis pedidos
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-semibold text-parchment">
                Pagar con PayPal Sandbox
              </h2>
              <PayPalCheckout
                orderId={order.id}
                token={token}
                totalAmount={order.total}
                onCaptured={(capturedOrder) => {
                  clearCart();
                  router.push(
                    `/pedidos?paid=${encodeURIComponent(capturedOrder.orderNumber)}`
                  );
                }}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
