import type { Metadata } from 'next';
import { Fraunces, DM_Sans } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { Navbar } from '@/components/Navbar';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'LibroYa — Librería Digital, Catálogo y Envíos en Tiempo Real',
  description:
    'Comercio electrónico de libros electrónicos con gestión de catálogo, control de stock, pagos verificados con PayPal Sandbox y seguimiento de envíos vía WebSockets.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${fraunces.variable} ${dmSans.variable}`}>
      <body className="flex min-h-screen flex-col bg-obsidian text-parchment antialiased">
        <AuthProvider>
          <CartProvider>
            <Navbar />
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
              {children}
            </main>
            <footer className="border-t border-stone-800/80 bg-obsidian/90 py-6 text-center text-xs text-stone-500">
              LibroYa · Plataforma Full-Stack de Libros Electrónicos, Stock y
              Envíos en Tiempo Real
            </footer>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
