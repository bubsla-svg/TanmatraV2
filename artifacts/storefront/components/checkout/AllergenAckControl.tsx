"use client";
import type { RefObject } from "react";
import type { FlaggedCartAllergens } from "@/lib/allergenAck";

/**
 * A2 / D-19 audit G1: surfaced BEFORE submit — previously the same server
 * gate (checkoutSafety.ts assessAllergenAck) only fired as a 422 after
 * Continue to payment, so every allergen-cart guest ate one failed submit.
 * Named from the same predicate the server uses
 * (allergens.length>0 || contraindications.length>0), so the dishes and
 * allergens listed here are exactly what the server will check.
 */
export function AllergenAckControl({
  flagged,
  checked,
  onCheckedChange,
  touched,
  inputRef,
}: {
  flagged: FlaggedCartAllergens;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  touched: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-line bg-surface-raised p-3 text-sm text-ink-muted">
      <input
        ref={inputRef}
        type="checkbox"
        data-testid="allergen-ack"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        aria-invalid={touched && !checked}
        aria-describedby={touched && !checked ? "allergen-ack-error" : undefined}
        className="mt-1 size-4 shrink-0"
      />
      <span>
        <span className="font-medium text-ink">
          This order has {flagged.allergens.length > 0 ? flagged.allergens.join(", ") : "declared contraindications"}
        </span>{" "}
        in {flagged.dishes.map((d) => d.name).join(", ")}. I&rsquo;ve reviewed the allergen information for this order.
        {touched && !checked && (
          <span id="allergen-ack-error" role="alert" className="mt-1 block text-xs font-medium text-[var(--danger)]">
            Please confirm you&rsquo;ve reviewed the allergen information for this order.
          </span>
        )}
      </span>
    </label>
  );
}
