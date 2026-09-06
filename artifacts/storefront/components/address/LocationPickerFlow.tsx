"use client"; // Justification: client-side geolocation GPS capture, dynamic search queries, and map orchestration.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { reverseGeocode, searchLocation, DEFAULT_MAP_CENTER, type GeoPlace } from "@/lib/geoClient";
import { gradeGpsAccuracy, type GpsConfidence } from "@/lib/geolocation";
import { checkServiceability } from "@/lib/serviceabilityApi";
import { useOverlayHistory } from "@/components/ui/useOverlayHistory";
import { LocationSummaryCard } from "./LocationSummaryCard";

const PickerMap = dynamic(() => import("./LocationPickerMap"), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center bg-bg text-xs font-medium text-ink-muted">Loading interactive map…</div>,
});

export function LocationPickerFlow({
  onClose,
  onSelectLocation,
  onManualFallback,
}: {
  onClose: () => void;
  onSelectLocation: (place: GeoPlace & { lat: number; lng: number }) => void;
  onManualFallback: () => void;
}) {
  const [coords, setCoords] = useState<{ lat: number; lng: number }>(DEFAULT_MAP_CENTER);
  const [recenterSeq, setRecenterSeq] = useState(0);
  const [place, setPlace] = useState<GeoPlace | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeoPlace[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  // null until a GPS fix has actually been taken — an un-attempted fix is not
  // the same as a precise one, and must not render a reassuring absence.
  const [gpsConfidence, setGpsConfidence] = useState<GpsConfidence | null>(null);
  // T-03: whether the kitchen delivers to the PIN under the pin. Null until
  // a PIN resolves (or while the check is in flight) — an unknown must never
  // read as "yes".
  const [serviceable, setServiceable] = useState<boolean | null>(null);
  const autoLocatedRef = useRef(false);

  useEffect(() => setMounted(true), []);

  // T-03: a granted geolocation is HONOURED on open. The map used to seed a
  // fixed Noida pin regardless, walking a Delhi visitor into an address form
  // for a place they are not. `permissions.query` is read-only — no prompt
  // is raised here; a visitor who has not granted still taps the button.
  useEffect(() => {
    if (autoLocatedRef.current || typeof navigator === "undefined" || !navigator.permissions?.query) return;
    autoLocatedRef.current = true;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        if (status.state === "granted") handleUseCurrentLocation();
      })
      .catch(() => {});
    // handleUseCurrentLocation is stable for the life of the sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The verdict follows the resolved PIN, from the same public check the
  // header's bar uses — so "not yet" is said here, before any address field.
  useEffect(() => {
    const pin = place?.pincode?.trim() ?? "";
    if (!/^\d{6}$/.test(pin)) {
      setServiceable(null);
      return;
    }
    let live = true;
    setServiceable(null);
    checkServiceability(pin)
      .then((s) => {
        if (live) setServiceable(s.verdict === "serviceable");
      })
      .catch(() => {
        if (live) setServiceable(null);
      });
    return () => {
      live = false;
    };
  }, [place?.pincode]);

  // Mounted only while "open" (every caller conditionally renders this flow)
  // — the back gesture closes the picker instead of leaving the host page.
  useOverlayHistory(true, onClose);

  const fetchPlace = useCallback(async (lat: number, lng: number) => {
    setLoading(true);
    const res = await reverseGeocode(lat, lng);
    if (res) setPlace(res);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchPlace(coords.lat, coords.lng);
  }, [fetchPlace, coords.lat, coords.lng]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 3) void searchLocation(query).then(setSuggestions);
      else setSuggestions([]);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  function handleUseCurrentLocation() {
    if (!typeof window || !navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(next);
        setRecenterSeq((s) => s + 1);
        // `accuracy` is the 68th-percentile radius in metres. Above ~150m the
        // fix is cell-tower triangulation, not GPS, and cannot identify a
        // building — which is exactly what a 6 AM doorstep drop needs. Grading
        // it (rather than ignoring it, as this handler used to) is what turns a
        // silently-wrong pin into a prompt the user can act on.
        setGpsConfidence(gradeGpsAccuracy(pos.coords.accuracy));
        void fetchPlace(next.lat, next.lng);
      },
      () => setLoading(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function handleSuggestionSelect(item: GeoPlace) {
    setPlace(item);
    setQuery("");
    setSuggestions([]);
  }

  // Stable identity so `memo(LocationPickerMap)` — and the Leaflet listener
  // it owns — don't churn every time `query` changes (i.e. every keystroke
  // in the search box below).
  const handleMapDragEnd = useCallback(
    (lat: number, lng: number) => {
      setCoords({ lat, lng });
      // Dragging IS the corrective action the warning asks for, so the
      // warning retires the moment it is taken. Leaving it up would
      // nag a user who has already done the thing.
      setGpsConfidence(null);
      void fetchPlace(lat, lng);
    },
    [fetchPlace],
  );

  // PORTALLED TO document.body ON PURPOSE. Every caller renders this sheet in
  // place, and one of them (ServiceabilityBar) sits inside the Header, which is
  // `sticky top-0 z-10 backdrop-blur` — both the z-index and the filter open a
  // stacking context. A `fixed` child cannot escape one: the sheet's own z was
  // resolved INSIDE the header's context and so capped at 10 against the root,
  // which left the --z-nav bottom bar painting straight over it. On a phone that
  // hid the "I don't know the exact location" manual fallback completely and
  // clipped the confirm button (all of it on a notched iPhone). Portalling makes
  // body the parent, so the --z-modal tier below actually means what it says.
  //
  // Guarded on `mounted` because document does not exist during SSR/prerender.
  // Callers mount this on a tap, so the skipped first frame is never seen.
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[var(--z-modal)] flex animate-sheet-in flex-col bg-bg sm:mx-auto sm:my-8 sm:max-w-xl sm:animate-dialog-in sm:rounded-2xl sm:border sm:border-line sm:shadow-[var(--shadow-raised)] sm:overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3.5">
        <button type="button" onClick={onClose} aria-label="Go back" className="rounded-xl p-1 text-ink hover:bg-bg">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="font-display text-xl font-semibold leading-tight text-primary">Add address</h1>
      </div>

      <div className="relative z-10 px-4 pt-3 bg-surface pb-2">
        {/* T-03: a labelled 50px search field at 16px (no iOS zoom), with a
            search return key — it was 14px text in a 20px box, unlabelled. */}
        <label htmlFor="location-search" className="sr-only">Search area, locality or PIN code</label>
        <div className="flex min-h-[50px] items-center gap-3 rounded-2xl border border-line bg-bg px-3.5 focus-within:border-line-strong">
          <svg aria-hidden className="h-5 w-5 shrink-0 text-ink-muted" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          <input
            ref={searchInputRef}
            id="location-search"
            type="search"
            enterKeyHint="search"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Area, locality or PIN code"
            className="min-h-[48px] w-full bg-transparent text-base font-medium text-ink outline-none placeholder:text-ink-faint"
          />
        </div>
        {suggestions.length > 0 && (
          <ul className="absolute left-4 right-4 top-14 z-50 max-h-60 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-raised)]">
            {suggestions.map((item, idx) => (
              <li key={idx}><button type="button" onClick={() => handleSuggestionSelect(item)} className="w-full rounded-xl px-3 py-2.5 text-left hover:bg-bg"><div className="text-sm font-bold text-ink">{item.city || "Area"}</div><div className="truncate text-xs text-ink-muted">{item.formattedAddress}</div></button></li>
            ))}
          </ul>
        )}
      </div>

      <div className="relative flex-1 min-h-[260px] w-full">
        <PickerMap coords={coords} recenterSeq={recenterSeq} onDragEnd={handleMapDragEnd} />
        {gpsConfidence !== null && gpsConfidence !== "precise" && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-[600] flex justify-center px-4">
            <p
              role="status"
              className="max-w-sm rounded-2xl border border-warning/40 bg-surface px-4 py-2.5 text-center text-xs font-semibold text-ink shadow-[var(--shadow-raised)]"
            >
              {gpsConfidence === "weak"
                ? "Weak GPS signal. Drag the pin to your exact building so the morning drop reaches the right door."
                : "Couldn't read your GPS accuracy. Drag the pin to your exact building before confirming."}
            </p>
          </div>
        )}
        <div className="absolute bottom-4 left-0 right-0 z-[600] flex justify-center px-4">
          <button type="button" onClick={handleUseCurrentLocation} className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-5 py-3 font-bold text-ink shadow-[var(--shadow-raised)] transition hover:opacity-90">
            <svg className="h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></svg>
            <span className="text-sm">Use current location</span>
          </button>
        </div>
      </div>

      <LocationSummaryCard place={place} loading={loading} serviceable={serviceable} onChangeTap={() => searchInputRef.current?.focus()} onConfirm={() => place && onSelectLocation({ ...place, lat: coords.lat, lng: coords.lng })} onManualFallback={onManualFallback} />
    </div>,
    document.body,
  );
}
