'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { api, ApiError } from '@/lib/api';
import { SHIPPING_OPTIONS, ShippingMethod } from '@/lib/types';
import {
  Minus,
  Plus,
  Trash2,
  ArrowRight,
  ShoppingBag,
  Truck,
} from 'lucide-react';

export default function CarritoPage() {
  const router = useRouter();
  const { user, token } = useAuth();
  const { items, subtotal, updateQuantity, removeItem } = useCart();

  const [shippingMethod, setShippingMethod] =
    useState<ShippingMethod>('DIGITAL_INSTANT');
  const [fullName, setFullName] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('Colombia');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.name && !fullName) {
      setFullName(user.name);
    }
  }, [user, fullName]);

  const selectedShipping =
    SHIPPING_OPTIONS.find((opt) => opt.id === shippingMethod) ||
    SHIPPING_OPTIONS[0];
  const estimatedTotal =
    Math.round((subtotal + selectedShipping.price) * 100) / 100;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token || !user) {
      router.push('/login');
      return;
    }

    if (items.length === 0) {
      setError('Tu carrito está vacío.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createOrder(token, {
        items: items.map((it) => ({
          bookId: it.book.id,
          quantity: it.quantity,
        })),
        shippingAddress: {
          fullName: fullName.trim(),
          street: street.trim(),
          city: city.trim(),
          postalCode: postalCode.trim(),
          country: country.trim(),
          notes: notes.trim(),
        },
        shippingMethod,
      });

      router.push(`/checkout/${res.order.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No pudimos generar el pedido. Verifica el stock y tu dirección.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-stone-800 bg-espresso p-10 text-center">
        <ShoppingBag className="mx-auto h-10 w-10 text-amber-400" />
        <h1 className="mt-4 font-display text-2xl font-semibold text-parchment">
          Tu carrito está vacío
        </h1>
        <p className="mt-2 text-sm text-stone-400">
          Explora nuestro catálogo para elegir libros electrónicos o paquetes
          con edición impresa.
        </p>
        <Link
          href="/catalogo"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-obsidian hover:bg-amber-500"
        >
          <span>Ir al catálogo</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="border-b border-stone-800 pb-4">
        <h1 className="font-display text-3xl font-semibold text-parchment">
          Carrito y Datos de Envío
        </h1>
        <p className="text-sm text-stone-400">
          Revisa las cantidades y define tu dirección antes de pasar a PayPal
          Sandbox.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <section className="space-y-4 lg:col-span-7">
          {items.map(({ book, quantity }) => (
            <article
              key={book.id}
              className="flex flex-col gap-4 rounded-2xl border border-stone-800 bg-espresso p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-4">
                <img
                  src={book.coverUrl}
                  alt={book.title}
                  className="h-20 w-16 shrink-0 rounded-lg object-cover border border-stone-700"
                />
                <div>
                  <h2 className="font-display text-base font-semibold text-parchment">
                    {book.title}
                  </h2>
                  <p className="text-xs text-stone-400">
                    {book.author} · {book.format}
                  </p>
                  <p className="mt-1 text-xs font-medium text-amber-400">
                    ${book.price.toFixed(2)} c/u · Stock máx: {book.stock}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <div className="inline-flex items-center rounded-xl border border-stone-700 bg-obsidian">
                  <button
                    type="button"
                    aria-label={`Disminuir cantidad de ${book.title}`}
                    onClick={() => updateQuantity(book.id, quantity - 1)}
                    className="p-2 text-stone-300 hover:text-parchment"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-[2.2rem] text-center text-sm font-semibold text-parchment">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    aria-label={`Aumentar cantidad de ${book.title}`}
                    disabled={quantity >= book.stock}
                    onClick={() => updateQuantity(book.id, quantity + 1)}
                    className="p-2 text-stone-300 hover:text-parchment disabled:opacity-30"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                <span className="min-w-[4.5rem] text-right font-semibold text-parchment">
                  ${(book.price * quantity).toFixed(2)}
                </span>

                <button
                  type="button"
                  onClick={() => removeItem(book.id)}
                  className="rounded-lg p-2 text-stone-400 hover:bg-rose-950/40 hover:text-rose-300"
                  title="Quitar del carrito"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}

          <div className="rounded-2xl border border-stone-800 bg-espresso p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-parchment">
              <Truck className="h-4 w-4 text-amber-400" />
              <span>Modalidad de envío y entrega</span>
            </div>

            <div className="space-y-2.5">
              {SHIPPING_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3.5 transition-colors ${
                    shippingMethod === opt.id
                      ? 'border-amber-500/60 bg-amber-500/10'
                      : 'border-stone-800 bg-obsidian/60 hover:border-stone-700'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="radio"
                      name="shippingMethod"
                      value={opt.id}
                      checked={shippingMethod === opt.id}
                      onChange={() => setShippingMethod(opt.id)}
                      className="mt-1 accent-amber-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-parchment">
                        {opt.label}
                      </p>
                      <p className="text-xs text-stone-400">
                        {opt.description}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-amber-400">
                    {opt.price === 0 ? 'Gratis' : `$${opt.price.toFixed(2)}`}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="lg:col-span-5">
          <form
            onSubmit={handleCheckout}
            className="space-y-4 rounded-2xl border border-stone-800 bg-espresso p-6"
          >
            <h2 className="font-display text-xl font-semibold text-parchment">
              Dirección de entrega y facturación
            </h2>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-200"
              >
                {error}
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs text-stone-300">
                Nombre completo del destinatario
              </label>
              <input
                required
                minLength={2}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej. Camila Lectora"
                className="w-full rounded-xl border border-stone-700 bg-obsidian px-3.5 py-2 text-sm text-parchment focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-stone-300">
                Dirección / Calle y número
              </label>
              <input
                required
                minLength={3}
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="Ej. Calle 67 # 53-108, Apto 402"
                className="w-full rounded-xl border border-stone-700 bg-obsidian px-3.5 py-2 text-sm text-parchment focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-stone-300">
                  Ciudad
                </label>
                <input
                  required
                  minLength={2}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Medellín"
                  className="w-full rounded-xl border border-stone-700 bg-obsidian px-3.5 py-2 text-sm text-parchment focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-stone-300">
                  Código postal
                </label>
                <input
                  required
                  minLength={2}
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="050010"
                  className="w-full rounded-xl border border-stone-700 bg-obsidian px-3.5 py-2 text-sm text-parchment focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-stone-300">País</label>
              <input
                required
                minLength={2}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full rounded-xl border border-stone-700 bg-obsidian px-3.5 py-2 text-sm text-parchment focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-stone-300">
                Notas adicionales (opcional)
              </label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Indicaciones de portería o correo de licencia"
                className="w-full rounded-xl border border-stone-700 bg-obsidian px-3.5 py-2 text-sm text-parchment focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="space-y-2 border-t border-stone-800 pt-4 text-sm">
              <div className="flex justify-between text-stone-400">
                <span>Subtotal libros</span>
                <span>${subtotal.toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>Envío ({selectedShipping.label})</span>
                <span>${selectedShipping.price.toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between border-t border-stone-800 pt-2 text-base font-bold text-parchment">
                <span>Total estimado</span>
                <span className="text-amber-400">
                  ${estimatedTotal.toFixed(2)} USD
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-obsidian transition-colors hover:bg-amber-500 disabled:opacity-50"
            >
              <span>
                {!user
                  ? 'Inicia sesión para continuar al pago'
                  : submitting
                    ? 'Validando stock y creando pedido...'
                    : 'Confirmar pedido e ir a PayPal'}
              </span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
