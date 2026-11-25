'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { LogIn, Shield } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const loggedUser = await login(email.trim(), password);
      if (loggedUser.role === 'administrador') {
        router.push('/admin');
      } else {
        router.push('/catalogo');
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No fue posible iniciar sesión. Verifica tus datos.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6 py-6">
      <div className="rounded-2xl border border-stone-800 bg-espresso p-6 sm:p-8 shadow-xl">
        <div className="mb-6 space-y-1">
          <h1 className="font-display text-2xl font-semibold text-parchment">
            Iniciar sesión en LibroYa
          </h1>
          <p className="text-sm text-stone-400">
            Accede a tus pedidos, licencias digitales y panel correspondiente a
            tu rol.
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
              htmlFor="login-email"
              className="mb-1.5 block text-xs font-medium text-stone-300"
            >
              Correo electrónico
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="w-full rounded-xl border border-stone-700 bg-obsidian px-3.5 py-2.5 text-sm text-parchment placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="mb-1.5 block text-xs font-medium text-stone-300"
            >
              Contraseña
            </label>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-stone-700 bg-obsidian px-3.5 py-2.5 text-sm text-parchment placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-obsidian transition-colors hover:bg-amber-500 disabled:opacity-50"
          >
            <LogIn className="h-4 w-4" />
            <span>{submitting ? 'Verificando...' : 'Ingresar'}</span>
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-stone-400">
          ¿Aún no tienes cuenta?{' '}
          <Link
            href="/registro"
            className="font-medium text-amber-400 hover:text-amber-300"
          >
            Regístrate como cliente
          </Link>
        </p>
      </div>

      <div className="rounded-2xl border border-stone-800 bg-obsidian/70 p-4 text-xs text-stone-400">
        <div className="flex items-center gap-2 font-medium text-stone-200">
          <Shield className="h-4 w-4 text-amber-400" />
          <span>Cuentas de prueba (entorno académico Sandbox)</span>
        </div>
        <div className="mt-2 space-y-1">
          <p>
            <strong>Cliente:</strong> cliente@libroya.com / Cliente123!
          </p>
          <p>
            <strong>Administrador:</strong> admin@libroya.com / Admin123!
          </p>
        </div>
      </div>
    </div>
  );
}
