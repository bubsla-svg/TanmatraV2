"use client";
// "use client" justification: the cart is interactive client state shared by
// the add buttons, mini-bar, and drawer. All logic lives in the pure, tested
// lib/cartStore core — this file is only the context shell + guarded
// persistence effect.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  EMPTY_CART,
  loadCart,
  saveCart,
  type CartState,
} from "@/lib/cartStore";

interface CartContextValue {
  cart: CartState;
  setCart: (next: CartState) => void;
  /** True after the guarded storage read — prevents hydration mismatch. */
  hydrated: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCartState] = useState<CartState>(EMPTY_CART);
  const [hydrated, setHydrated] = useState(false);

  // Server render and first client render both show the empty cart; the
  // stored cart applies after mount (guarded read — never throws).
  useEffect(() => {
    setCartState(loadCart());
    setHydrated(true);
  }, []);

  // Stable identity (`useCallback`, empty deps — it only ever touches the
  // setter and the persistence side effect, neither of which needs to be a
  // dependency). Every screen that reads the cart also gets a fresh `setCart`
  // reference on every cart mutation if this isn't memoized, which cascades:
  // any child that puts `setCart` in a `useCallback`/`useMemo` dependency
  // array (menu add-buttons, the marketplace grid, cart drawer upsells) loses
  // its own memoization the moment ANY line item changes, anywhere.
  const setCart = useCallback((next: CartState) => {
    setCartState(next);
    saveCart(next);
  }, []);

  return (
    <CartContext.Provider value={{ cart, setCart, hydrated }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart requires <CartProvider> in the tree");
  return ctx;
}
