'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { UserPlus } from 'lucide-react';

export default function RegistroPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(name.trim(), email.trim(), password);
      router.push('/catalogo');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No fue posible completar el registro.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md py-6">
      <div className="rounded-2xl border border-stone-800 bg-espresso p-6 sm:p-8 shadow-xl">
        <div className="mb-6 space-y-1">
          <h1 className="font-display text-2xl font-semibold text-parchment">
            Crear cuenta de cliente
          </h1>
          <p className="text-sm text-stone-400">
            Regístrate para comprar libros electrónicos y seguir tus envíos en
            tiempo real.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-sm text-rose-200"
            >
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="reg-name"
              className="mb-1.5 block text-xs font-medium text-stone-300"
            >
              Nombre completo
            </label>
            <input
              id="reg-name"
              type="text"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Laura Gómez"
              className="w-full rounded-xl border border-stone-700 bg-obsidian px-3.5 py-2.5 text-sm text-parchment placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="reg-email"
              className="mb-1.5 block text-xs font-medium text-stone-300"
            >
              Correo electrónico
            </label>
            <input
              id="reg-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="laura@ejemplo.com"
              className="w-full rounded-xl border border-stone-700 bg-obsidian px-3.5 py-2.5 text-sm text-parchment placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="reg-password"
              className="mb-1.5 block text-xs font-medium text-stone-300"
            >
              Contraseña (mínimo 8 caracteres)
            </label>
            <input
              id="reg-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full rounded-xl border border-stone-700 bg-obsidian px-3.5 py-2.5 text-sm text-parchment placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-obsidian transition-colors hover:bg-amber-500 disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            <span>{submitting ? 'Creando cuenta...' : 'Crear cuenta'}</span>
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-stone-400">
          ¿Ya tienes cuenta?{' '}
          <Link
            href="/login"
            className="font-medium text-amber-400 hover:text-amber-300"
          >
            Inicia sesión aquí
          </Link>
        </p>
      </div>
    </div>
  );
}
