import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/api/adapter";
import { PRICE_FONT_SIZE, type PriceSize } from "./logic";

interface PriceProps {
  /** Amount in paise. ACCEPTS SERVER-QUOTED VALUES ONLY — no arithmetic props
   *  (02f §1 component 3): a Price never derives a total, it displays one. */
  paise: number;
  size?: PriceSize;
  /** Render as a struck-through anchor/former price (never a live payable). */
  strike?: boolean;
  className?: string;
  "aria-label"?: string;
}

/**
 * `<Price>` — 02f §1 component 3. INR via `formatPrice` (Intl en-IN grouping,
 * paise only when non-zero), tabular figures so digits never jitter. The single
 * sanctioned way to render a rupee amount on a customer surface.
 */
export function Price({ paise, size = "md", strike = false, className, ...rest }: PriceProps) {
  return (
    <span
      className={cn(strike && "line-through opacity-60", className)}
      style={{
        fontVariantNumeric: "tabular-nums",
        fontSize: PRICE_FONT_SIZE[size],
        fontWeight: size === "display" || size === "lg" ? 600 : 500,
      }}
      aria-label={rest["aria-label"]}
    >
      {formatPrice(paise)}
    </span>
  );
}
