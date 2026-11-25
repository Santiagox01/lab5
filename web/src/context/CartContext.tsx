'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Book, CartItem } from '@/lib/types';

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  addItem: (book: Book, quantity?: number) => void;
  updateQuantity: (bookId: string, quantity: number) => void;
  removeItem: (bookId: string) => void;
  clearCart: () => void;
  syncBookStock: (bookId: string, stock: number, available: boolean) => void;
}

const CART_STORAGE_KEY = 'libroya_cart_v1';

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
    } catch {
      // Ignorar storage corrupto
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const addItem = useCallback((book: Book, quantity = 1) => {
    if (!book.available || book.stock <= 0) return;
    setItems((prev) => {
      const existing = prev.find((it) => it.book.id === book.id);
      if (existing) {
        const nextQty = Math.min(book.stock, existing.quantity + quantity);
        return prev.map((it) =>
          it.book.id === book.id ? { book, quantity: nextQty } : it
        );
      }
      return [...prev, { book, quantity: Math.min(book.stock, Math.max(1, quantity)) }];
    });
  }, []);

  const updateQuantity = useCallback((bookId: string, quantity: number) => {
    setItems((prev) =>
      prev
        .map((it) => {
          if (it.book.id !== bookId) return it;
          if (quantity <= 0) return null;
          const clamped = Math.min(it.book.stock, Math.floor(quantity));
          return clamped > 0 ? { ...it, quantity: clamped } : null;
        })
        .filter((it): it is CartItem => it !== null)
    );
  }, []);

  const removeItem = useCallback((bookId: string) => {
    setItems((prev) => prev.filter((it) => it.book.id !== bookId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const syncBookStock = useCallback(
    (bookId: string, stock: number, available: boolean) => {
      setItems((prev) =>
        prev.map((it) =>
          it.book.id === bookId
            ? {
                book: { ...it.book, stock, available },
                quantity: stock > 0 ? Math.min(it.quantity, stock) : it.quantity,
              }
            : it
        )
      );
    },
    []
  );

  const totalItems = useMemo(
    () => items.reduce((acc, it) => acc + it.quantity, 0),
    [items]
  );

  const subtotal = useMemo(
    () =>
      Math.round(
        items.reduce((acc, it) => acc + it.book.price * it.quantity, 0) * 100
      ) / 100,
    [items]
  );

  return (
    <CartContext.Provider
      value={{
        items,
        totalItems,
        subtotal,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        syncBookStock,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart debe utilizarse dentro de CartProvider.');
  }
  return ctx;
}
