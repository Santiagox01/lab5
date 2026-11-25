'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpen,
  ShoppingBag,
  PackageCheck,
  LayoutDashboard,
  LogOut,
  LogIn,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, loading } = useAuth();
  const { totalItems } = useCart();

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const linkClass = (href: string) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      pathname === href || pathname.startsWith(`${href}/`)
        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
        : 'text-stone-300 hover:text-parchment hover:bg-walnut/80'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-stone-800/90 bg-obsidian/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-parchment transition-opacity hover:opacity-90"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
            <BookOpen className="h-5 w-5" />
          </span>
          <div>
            <span className="font-display text-xl font-semibold tracking-tight text-parchment">
              LibroYa
            </span>
            <span className="ml-2 hidden rounded-md bg-walnut px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-amber-300 sm:inline-block">
              eBooks & Envíos
            </span>
          </div>
        </Link>

        <nav className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Link href="/catalogo" className={linkClass('/catalogo')}>
            <BookOpen className="h-4 w-4" />
            <span>Catálogo</span>
          </Link>

          <Link href="/carrito" className={linkClass('/carrito')}>
            <ShoppingBag className="h-4 w-4" />
            <span>Carrito ({totalItems})</span>
          </Link>

          {!loading && user && (
            <Link href="/pedidos" className={linkClass('/pedidos')}>
              <PackageCheck className="h-4 w-4" />
              <span>Mis pedidos</span>
            </Link>
          )}

          {!loading && user?.role === 'administrador' && (
            <Link href="/admin" className={linkClass('/admin')}>
              <LayoutDashboard className="h-4 w-4" />
              <span>Gestión y Envíos</span>
            </Link>
          )}

          {!loading && !user && (
            <>
              <Link href="/login" className={linkClass('/login')}>
                <LogIn className="h-4 w-4" />
                <span>Iniciar sesión</span>
              </Link>
              <Link
                href="/registro"
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-1.5 text-sm font-medium text-obsidian transition-colors hover:bg-amber-500"
              >
                <UserPlus className="h-4 w-4" />
                <span>Crear cuenta</span>
              </Link>
            </>
          )}

          {!loading && user && (
            <div className="ml-1 flex items-center gap-2 border-l border-stone-800 pl-3">
              <div className="hidden text-right sm:block">
                <p className="text-xs font-medium text-parchment leading-tight">
                  {user.name}
                </p>
                <p className="text-[11px] uppercase tracking-wider text-amber-400">
                  {user.role}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-700 bg-espresso px-2.5 py-1.5 text-xs font-medium text-stone-300 transition-colors hover:border-rose-500/50 hover:text-rose-300"
                title="Cerrar sesión"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Salir</span>
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
