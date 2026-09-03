"use client"; // Justification: client-side interaction handlers for address confirmation and location adjustment.
import type { GeoPlace } from "@/lib/geoClient";
import { Button } from "@/components/ui/button";

/**
 * The sheet's footer: where the pin resolved to, and the one next step.
 *
 * T-03: the verdict is said HERE, before any address field. A Delhi visitor
 * used to be shown "Delivering your order to … Noida" and a gold "Add more
 * address details" — an address form for a place we do not serve. With
 * `serviceable === false` the card says "not yet" and the primary becomes
 * "Leave your number", which the host turns into the notify-me capture.
 * `null` (unknown / still checking) never reads as yes.
 */
export function LocationSummaryCard({
  place,
  loading,
  serviceable,
  onChangeTap,
  onConfirm,
  onManualFallback,
}: {
  place: GeoPlace | null;
  loading: boolean;
  serviceable: boolean | null;
  onChangeTap: () => void;
  onConfirm: () => void;
  onManualFallback: () => void;
}) {
  const outOfZone = serviceable === false && !loading && !!place;
  const heading = outOfZone ? "We don't deliver here yet" : "Delivering your order to";
  const title = place?.city || (place?.pincode ? `PIN ${place.pincode}` : "Selected Location");
  const subtitle = outOfZone
    ? `${place?.pincode ? `PIN ${place.pincode} — ` : ""}Noida sectors only for now. Leave your number and we'll message you the day we reach you.`
    : place?.formattedAddress || "Move the map pin or use current location to set delivery area";

  return (
    <div className="flex flex-col gap-4 border-t border-line bg-surface p-4 shadow-xl sm:rounded-t-2xl sm:p-6">
      <h2 className={`text-xs font-bold tracking-wider uppercase ${outOfZone ? "text-[var(--danger)]" : "text-ink-muted"}`}>
        {heading}
      </h2>

      <div className={`flex items-center justify-between gap-3 rounded-2xl border bg-bg p-3.5 shadow-xs ${outOfZone ? "border-[var(--danger)]/40" : "border-line"}`}>
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink shadow-xs">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <div className="flex flex-col overflow-hidden" role="status" aria-live="polite" aria-busy={loading}>
            <span className="truncate text-base font-bold text-ink">{loading ? "Locating…" : title}</span>
            <span className={`text-xs font-medium text-ink-muted ${outOfZone ? "line-clamp-3" : "truncate"}`}>
              {loading ? "Fetching address details…" : subtitle}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onChangeTap}
          className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-xs font-bold text-[var(--primary)] hover:underline"
        >
          Change
        </button>
      </div>

      <Button
        type="button"
        disabled={loading || !place}
        onClick={onConfirm}
        shape="xl"
        size="fluid"
        className="flex w-full min-h-12 items-center justify-center gap-2 px-5 py-3.5 text-base font-bold shadow-md hover:opacity-95 disabled:opacity-40"
      >
        <span>{outOfZone ? "Leave your number" : "Add more address details"}</span>
        <span aria-hidden>▸</span>
      </Button>

      <button
        type="button"
        onClick={onManualFallback}
        className="mx-auto inline-flex min-h-11 items-center text-center text-xs font-semibold text-ink-muted underline decoration-line underline-offset-4 hover:text-ink"
      >
        I don’t know the exact location on map
      </button>
    </div>
  );
}
