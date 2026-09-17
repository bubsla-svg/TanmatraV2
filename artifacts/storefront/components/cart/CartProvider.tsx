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
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  EMPTY_CART,
  addOrUpdateQty,
  findRemovedLine,
  loadCart,
  saveCart,
  type CartLine,
  type CartState,
} from "@/lib/cartStore";
import { CartRemovedToast } from "@/components/cart/CartRemovedToast";

interface CartContextValue {
  cart: CartState;
  setCart: (next: CartState) => void;
  /** True after the guarded storage read — prevents hydration mismatch. */
  hydrated: boolean;
  /**
   * Whether the cart drawer is open. Lives here, not in MiniCartBar's local
   * state, because more than one island needs to open it: the mini-bar's own
   * "View cart", and the dish drawer's post-add CTA — the dish sheet covers
   * the mini-bar with its overlay, so once a dish was added from there the
   * cart was genuinely unreachable without dismissing the sheet by hand and
   * finding the bar again.
   *
   * Deliberately NOT the URL (MiniCartBar's original note stands — a cart is
   * not shareable state); this is shared *client* state between two islands,
   * which is exactly what this provider is for.
   */
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCartState] = useState<CartState>(EMPTY_CART);
  const [hydrated, setHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  // The last line a write removed, for the "Removed · Undo" toast (audit
  // 2026-09-17: minus at quantity 1 deleted the line with no confirm, no
  // undo and no announcement). `id` re-arms the toast timer per removal.
  const [removed, setRemoved] = useState<{ line: CartLine; id: number } | null>(null);
  // Mirror of the committed cart so setCart can diff against it without a
  // side effect inside a state updater.
  const cartRef = useRef<CartState>(EMPTY_CART);

  // Server render and first client render both show the empty cart; the
  // stored cart applies after mount (guarded read — never throws).
  useEffect(() => {
    const stored = loadCart();
    cartRef.current = stored;
    setCartState(stored);
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
    const gone = findRemovedLine(cartRef.current, next);
    cartRef.current = next;
    setCartState(next);
    saveCart(next);
    if (gone) setRemoved({ line: gone, id: Date.now() });
  }, []);

  const undoRemove = useCallback(() => {
    if (!removed) return;
    const { qty, ...line } = removed.line;
    setRemoved(null);
    // Restore the line at the quantity it had (not +1 on whatever is there).
    const restored = addOrUpdateQty(cartRef.current, line, qty);
    cartRef.current = restored;
    setCartState(restored);
    saveCart(restored);
  }, [removed]);

  return (
    <CartContext.Provider value={{ cart, setCart, hydrated, cartOpen, setCartOpen }}>
      {children}
      {removed && (
        <CartRemovedToast key={removed.id} name={removed.line.name} onUndo={undoRemove} onDone={() => setRemoved(null)} />
      )}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart requires <CartProvider> in the tree");
  return ctx;
}
