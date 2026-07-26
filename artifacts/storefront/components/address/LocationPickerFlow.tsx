"use client"; // Justification: client-side geolocation GPS capture, dynamic search queries, and map orchestration.
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { reverseGeocode, searchLocation, DEFAULT_MAP_CENTER, type GeoPlace } from "@/lib/geoClient";
import { LocationSummaryCard } from "./LocationSummaryCard";

const PickerMap = dynamic(() => import("./LocationPickerMap"), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center bg-[var(--bg)] text-xs font-medium text-ink-muted">Loading interactive map…</div>,
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg sm:mx-auto sm:my-8 sm:max-w-xl sm:rounded-3xl sm:border sm:border-line sm:shadow-2xl sm:overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3.5">
        <button type="button" onClick={onClose} aria-label="Go back" className="rounded-xl p-1 text-ink hover:bg-bg">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-lg font-bold text-ink">Add address</h1>
      </div>

      <div className="relative z-10 px-4 pt-3 bg-surface pb-2">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-bg px-3.5 py-2.5 shadow-sm">
          <svg className="h-5 w-5 text-ink-muted" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          <input ref={searchInputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search for a new area, locality..." className="w-full bg-transparent text-sm font-medium text-ink outline-none placeholder:text-ink-muted" />
        </div>
        {suggestions.length > 0 && (
          <ul className="absolute left-4 right-4 top-14 z-50 max-h-60 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-2xl">
            {suggestions.map((item, idx) => (
              <li key={idx}><button type="button" onClick={() => handleSuggestionSelect(item)} className="w-full rounded-xl px-3 py-2.5 text-left hover:bg-bg"><div className="text-sm font-bold text-ink">{item.city || "Area"}</div><div className="truncate text-xs text-ink-muted">{item.formattedAddress}</div></button></li>
            ))}
          </ul>
        )}
      </div>

      <div className="relative flex-1 min-h-[260px] w-full">
        <PickerMap coords={coords} recenterSeq={recenterSeq} onDragEnd={(lat, lng) => { setCoords({ lat, lng }); void fetchPlace(lat, lng); }} />
        <div className="absolute bottom-4 left-0 right-0 z-[600] flex justify-center px-4">
          <button type="button" onClick={handleUseCurrentLocation} className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-5 py-3 font-bold text-ink shadow-xl transition hover:opacity-90">
            <svg className="h-5 w-5 text-[var(--gold)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></svg>
            <span className="text-sm">Use current location</span>
          </button>
        </div>
      </div>

      <LocationSummaryCard place={place} loading={loading} onChangeTap={() => searchInputRef.current?.focus()} onConfirm={() => place && onSelectLocation({ ...place, lat: coords.lat, lng: coords.lng })} onManualFallback={onManualFallback} />
    </div>
  );
}
