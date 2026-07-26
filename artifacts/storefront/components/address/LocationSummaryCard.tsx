"use client"; // Justification: client-side interaction handlers for address confirmation and location adjustment.
import type { GeoPlace } from "@/lib/geoClient";

export function LocationSummaryCard({
  place,
  loading,
  onChangeTap,
  onConfirm,
  onManualFallback,
}: {
  place: GeoPlace | null;
  loading: boolean;
  onChangeTap: () => void;
  onConfirm: () => void;
  onManualFallback: () => void;
}) {
  const title = place?.city || (place?.pincode ? `PIN ${place.pincode}` : "Selected Location");
  const subtitle = place?.formattedAddress || "Move the map pin or use current location to set delivery area";

  return (
    <div className="flex flex-col gap-4 border-t border-line bg-surface p-4 shadow-xl sm:rounded-t-2xl sm:p-6">
      <h2 className="text-xs font-bold tracking-wider uppercase text-ink-muted">Delivering your order to</h2>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-bg p-3.5 shadow-xs">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink shadow-xs">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="truncate text-base font-bold text-ink">{loading ? "Locating…" : title}</span>
            <span className="truncate text-xs font-medium text-ink-muted">{loading ? "Fetching address details…" : subtitle}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onChangeTap}
          className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-[var(--primary)] hover:underline"
        >
          Change
        </button>
      </div>

      <button
        type="button"
        disabled={loading || !place}
        onClick={onConfirm}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3.5 text-base font-bold text-[var(--gold-ink)] shadow-md transition-all hover:opacity-95 disabled:opacity-40"
      >
        <span>Add more address details</span>
        <span>▸</span>
      </button>

      <button
        type="button"
        onClick={onManualFallback}
        className="mx-auto block text-center text-xs font-semibold text-ink-muted underline decoration-line underline-offset-4 hover:text-ink"
      >
        I don’t know the exact location on map
      </button>
    </div>
  );
}
