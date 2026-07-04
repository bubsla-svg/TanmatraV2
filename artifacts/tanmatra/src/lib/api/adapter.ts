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
