import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Dish } from '@/lib/catalog';
import { formatPrice } from '@/lib/catalog';

export interface CartLine {
  id: string;
  name: string;
  price: number;
  quantity: number;
  slug?: string;
  kind: 'dish' | 'plan';
}

interface StorefrontContextValue {
  favorites: string[];
  cart: CartLine[];
  cartCount: number;
  cartTotal: number;
  notice: string | null;
  toggleFavorite: (slug: string) => void;
  addToCart: (dish: Dish) => void;
  addPlan: (id: string, name: string, price: number) => void;
  changeQuantity: (id: string, delta: number) => void;
  removeFromCart: (id: string) => void;
  showNotice: (message: string) => void;
}

const StorefrontContext = createContext<StorefrontContextValue | null>(null);

export function StorefrontProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setFavorites(JSON.parse(localStorage.getItem('tanmatra-favorites') ?? '[]'));
      setCart(JSON.parse(localStorage.getItem('tanmatra-cart') ?? '[]'));
    } catch {
      setFavorites([]);
      setCart([]);
    } finally { setHydrated(true); }
  }, []);
  useEffect(() => { if (hydrated) localStorage.setItem('tanmatra-favorites', JSON.stringify(favorites)); }, [favorites, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem('tanmatra-cart', JSON.stringify(cart)); }, [cart, hydrated]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const value = useMemo<StorefrontContextValue>(() => ({
    favorites,
    cart,
    cartCount: cart.reduce((total, line) => total + line.quantity, 0),
    cartTotal: cart.reduce((total, line) => total + line.price * line.quantity, 0),
    notice,
    toggleFavorite: (slug) => setFavorites((current) => current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]),
    addToCart: (dish) => {
      setCart((current) => {
        const id = `dish-${dish.id}`;
        const found = current.find((line) => line.id === id);
        return found ? current.map((line) => line.id === id ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { id, name: dish.name, price: dish.price, quantity: 1, slug: dish.slug, kind: 'dish' }];
      });
      setNotice(`${dish.name} added · ${formatPrice(dish.price)}`);
    },
    addPlan: (id, name, price) => {
      setCart((current) => current.some((line) => line.id === id) ? current : [...current, { id, name, price, quantity: 1, kind: 'plan' }]);
      setNotice(`${name} is ready in your bag`);
    },
    changeQuantity: (id, delta) => setCart((current) => current.map((line) => line.id === id ? { ...line, quantity: Math.max(0, line.quantity + delta) } : line).filter((line) => line.quantity > 0)),
    removeFromCart: (id) => setCart((current) => current.filter((line) => line.id !== id)),
    showNotice: (message) => setNotice(message),
  }), [cart, favorites, notice]);

  return <StorefrontContext.Provider value={value}>{children}</StorefrontContext.Provider>;
}

export function useStorefront() {
  const context = useContext(StorefrontContext);
  if (!context) throw new Error('useStorefront must be used inside StorefrontProvider');
  return context;
}