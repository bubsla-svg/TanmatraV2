export function formatPrice(paise: number): string {
  // ₹ with Indian digit grouping; show paise only when non-zero so prices
  // read "₹115" / "₹1,235" instead of "Rs.115.00" (visual noise on every
  // card, cart row, and summary line).
  const rupees = paise / 100;
  const hasPaise = Math.round(paise) % 100 !== 0;
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: hasPaise ? 2 : 0,
  })}`;
}

/**
 * Whole-rupee price for headline ESTIMATE displays (plan cards, "/wk" figures).
 * GST is a percentage, so a plan total is rarely a round hundred paise — showing
 * "₹7,855.31 /wk" on a marketing card reads as broken math. This rounds to the
 * nearest rupee for display only; the exact paise amount is still used at
 * checkout for the actual "total payable" line (use formatPrice there).
 */
export function formatPriceRounded(paise: number): string {
  return formatPrice(Math.round(paise / 100) * 100);
}

export interface MenuComboWithAvailability {
  id: number;
  name: string;
  category: string;
  kitchen: string;
  price: number;
  isAvailable: boolean;
  ingredients: string[];
  imageUrl: string | null;
  rdVerified: boolean;
}
