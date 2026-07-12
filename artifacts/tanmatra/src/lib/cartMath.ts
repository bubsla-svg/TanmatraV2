export interface CartItemCalculationInput {
  unitPrice: number; // in paise
  quantity: number;
}

export interface CartTotals {
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
  amountToFreeDelivery: number;
  freeDeliveryProgress: number;
  hasFreeDelivery: boolean;
}

export function calculateCartTotals(items: CartItemCalculationInput[]): CartTotals {
  try {
    const subtotal = items.reduce((sum, item) => {
      const price = Number(item.unitPrice ?? 0);
      const qty = Number(item.quantity ?? 0);
      if (price < 0 || qty < 0) {
        throw new Error("Invalid negative price or quantity detected in cart calculation.");
      }
      return sum + Math.round(price * qty);
    }, 0);

    // Free delivery threshold: 50000 paise (Rs. 500)
    // Delivery fee: 5000 paise (Rs. 50)
    const deliveryFee = subtotal === 0 || subtotal >= 50000 ? 0 : 5000;

    // Statutory GST split: prepared food 5% (no ITC), delivery service 18%.
    // Mirrors the authoritative computeChargePaise in the api-server.
    const foodTax = Math.round(subtotal * 0.05);
    const deliveryTax = Math.round(deliveryFee * 0.18);
    const tax = foodTax + deliveryTax;

    const total = subtotal + deliveryFee + tax;
    const amountToFreeDelivery = Math.max(0, 50000 - subtotal);
    const freeDeliveryProgress = subtotal === 0
      ? 0
      : Math.min(100, (subtotal / 50000) * 100);

    return {
      subtotal,
      tax,
      deliveryFee,
      total,
      amountToFreeDelivery,
      freeDeliveryProgress,
      hasFreeDelivery: deliveryFee === 0 && subtotal > 0,
    };
  } catch (err) {
    // Graceful fallback to prevent crashes on bad data inputs
    console.error("[CART_MATH_ERROR] Failed calculating totals:", err);
    return {
      subtotal: 0,
      tax: 0,
      deliveryFee: 0,
      total: 0,
      amountToFreeDelivery: 50000,
      freeDeliveryProgress: 0,
      hasFreeDelivery: false,
    };
  }
}
