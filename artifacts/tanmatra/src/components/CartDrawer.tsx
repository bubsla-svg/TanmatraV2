import React from "react";
import { CartService, CartItem } from "../services/CartService";
import { SafeImage } from "./SafeImage";
import { PriceDisplay } from "./PriceDisplay";
import { PrimaryCTA } from "./CTA";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckoutClick: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  onCheckoutClick,
}) => {
  const items = CartService.getItems();
  const subtotalPaise = CartService.getSubtotalPaise();
  const addons = CartService.getRecommendedAddons();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-800 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-100">Your Order Cart</h3>
            <p className="text-xs text-slate-400">{items.length} items selected</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-200 min-h-[44px] min-w-[44px] flex items-center justify-center">
            ✕
          </button>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <p className="text-sm font-semibold">Your cart is currently empty</p>
              <p className="text-xs mt-1">Explore our therapeutic menu to add dishes.</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.cartItemId} className="flex gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800 items-center">
                <SafeImage src={item.meal.imageUrl} alt={item.meal.name} aspectRatio="1/1" className="w-16 h-16 shrink-0" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-100 truncate">{item.meal.name}</h4>
                  {item.selectedAccompaniment && (
                    <p className="text-[10px] text-amber-400 font-medium">{item.selectedAccompaniment}</p>
                  )}
                  <PriceDisplay pricePaise={item.meal.pricePaise * item.quantity} size="sm" className="mt-1" />
                </div>
                <button
                  onClick={() => CartService.removeItem(item.cartItemId)}
                  className="text-xs text-rose-400 hover:text-rose-300 p-2"
                >
                  Remove
                </button>
              </div>
            ))
          )}

          {/* CompleteYourMealRail (Mandatory before Checkout CTA) */}
          {items.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3">
                Complete Your Meal
              </h4>
              <div className="space-y-2">
                {addons.map((addon) => (
                  <div key={addon.mealId} className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-3">
                      <SafeImage src={addon.imageUrl} alt={addon.name} aspectRatio="1/1" className="w-10 h-10 rounded-lg shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-slate-200">{addon.name}</p>
                        <PriceDisplay pricePaise={addon.pricePaise} size="sm" />
                      </div>
                    </div>
                    <button
                      onClick={() => CartService.addItem(addon)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs font-bold border border-amber-500/20"
                    >
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer with Single Primary Gold Checkout CTA */}
        {items.length > 0 && (
          <div className="p-6 border-t border-slate-800 bg-slate-950/80 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Subtotal Today</span>
              <PriceDisplay pricePaise={subtotalPaise} size="md" />
            </div>
            
            {/* Single Primary Gold CTA */}
            <PrimaryCTA onClick={onCheckoutClick} className="w-full">
              <span>Proceed to Checkout</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </PrimaryCTA>
          </div>
        )}
      </div>
    </div>
  );
};
