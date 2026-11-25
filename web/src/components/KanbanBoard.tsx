'use client';

import React, { useState } from 'react';
import { Order, OrderStatus } from '@/lib/types';
import { ArrowRight, MapPin, Package, Truck } from 'lucide-react';

interface KanbanBoardProps {
  orders: Order[];
  onTransition: (
    orderId: string,
    nextStatus: OrderStatus,
    trackingCode?: string
  ) => Promise<void>;
}

const COLUMNS: Array<{
  status: OrderStatus;
  title: string;
  accent: string;
  nextStatus?: OrderStatus;
  nextLabel?: string;
}> = [
  {
    status: 'PAID',
    title: 'Pendiente',
    accent: 'border-amber-500/40 bg-amber-500/5',
    nextStatus: 'PREPARING',
    nextLabel: 'Pasar a En preparación',
  },
  {
    status: 'PREPARING',
    title: 'En preparación',
    accent: 'border-sky-500/40 bg-sky-500/5',
    nextStatus: 'SHIPPED',
    nextLabel: 'Despachar envío',
  },
  {
    status: 'SHIPPED',
    title: 'Enviado',
    accent: 'border-violet-500/40 bg-violet-500/5',
    nextStatus: 'DELIVERED',
    nextLabel: 'Confirmar entrega',
  },
  {
    status: 'DELIVERED',
    title: 'Entregado',
    accent: 'border-emerald-500/40 bg-emerald-500/5',
  },
];

export function KanbanBoard({ orders, onTransition }: KanbanBoardProps) {
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>(
    {}
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleMove = async (orderId: string, nextStatus: OrderStatus) => {
    setBusyId(orderId);
    try {
      const code = trackingInputs[orderId]?.trim() || undefined;
      await onTransition(orderId, nextStatus, code);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((col) => {
        const columnOrders = orders.filter((o) => o.status === col.status);
        return (
          <section
            key={col.status}
            onDragOver={(e) => e.preventDefault()}
            onDrop={async (e) => {
              e.preventDefault();
              if (!draggedOrderId) return;
              const droppedId = draggedOrderId;
              setDraggedOrderId(null);
              await handleMove(droppedId, col.status);
            }}
            className={`flex min-h-[420px] flex-col rounded-2xl border p-4 ${col.accent}`}
          >
            <header className="mb-3 flex items-center justify-between border-b border-stone-800 pb-2.5">
              <h3 className="font-display text-base font-semibold text-parchment">
                {col.title}
              </h3>
              <span className="rounded-full bg-obsidian px-2.5 py-0.5 text-xs font-semibold text-stone-200 border border-stone-700">
                {columnOrders.length}
              </span>
            </header>

            <div className="flex flex-1 flex-col gap-3">
              {columnOrders.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-stone-800 p-4 text-center text-xs text-stone-500">
                  Sin pedidos en {col.title.toLowerCase()}
                </div>
              ) : (
                columnOrders.map((order) => {
                  const customerName =
                    typeof order.userId === 'object' && order.userId?.name
                      ? order.userId.name
                      : order.shippingAddress.fullName;
                  const isBusy = busyId === order.id;

                  return (
                    <article
                      key={order.id}
                      draggable={!isBusy}
                      onDragStart={() => setDraggedOrderId(order.id)}
                      className="cursor-grab rounded-xl border border-stone-800 bg-espresso p-3.5 shadow-sm transition-colors hover:border-amber-500/40 active:cursor-grabbing"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-amber-400">
                          {order.orderNumber}
                        </span>
                        <span className="text-xs font-semibold text-parchment">
                          ${order.total.toFixed(2)}
                        </span>
                      </div>

                      <p className="mt-1 text-xs font-medium text-stone-200">
                        {customerName}
                      </p>

                      <ul className="mt-2 space-y-1 text-xs text-stone-300">
                        {order.items.map((item, idx) => (
                          <li key={idx} className="flex justify-between gap-2">
                            <span className="truncate">
                              {item.quantity}× {item.title}
                            </span>
                            <span className="shrink-0 text-stone-400">
                              {item.format}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-stone-400">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-stone-500" />
                        <span className="truncate">
                          {order.shippingAddress.street},{' '}
                          {order.shippingAddress.city}
                        </span>
                      </div>

                      {order.trackingCode && (
                        <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-obsidian px-2 py-1 font-mono text-[11px] text-violet-300 border border-violet-500/30">
                          <Truck className="h-3 w-3" />
                          <span>Guía: {order.trackingCode}</span>
                        </div>
                      )}

                      {col.nextStatus === 'SHIPPED' && (
                        <input
                          type="text"
                          placeholder="Código de guía (opcional)"
                          value={trackingInputs[order.id] || ''}
                          onChange={(e) =>
                            setTrackingInputs((prev) => ({
                              ...prev,
                              [order.id]: e.target.value,
                            }))
                          }
                          className="mt-2.5 w-full rounded-lg border border-stone-700 bg-obsidian px-2.5 py-1.5 text-xs text-parchment placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
                        />
                      )}

                      {col.nextStatus && col.nextLabel && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleMove(order.id, col.nextStatus!)}
                          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-walnut px-3 py-1.5 text-xs font-medium text-amber-300 border border-amber-500/30 transition-colors hover:bg-amber-600 hover:text-obsidian disabled:opacity-50"
                        >
                          <Package className="h-3.5 w-3.5" />
                          <span>
                            {isBusy ? 'Actualizando...' : col.nextLabel}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
