"use client";
// "use client" justification: the cart is interactive client state shared by
// the add buttons, mini-bar, and drawer. All logic lives in the pure, tested
// lib/cartStore core — this file is only the context shell + guarded
// persistence effect.
import {
  createContext,
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

  const setCart = (next: CartState) => {
    setCartState(next);
    saveCart(next);
  };

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
