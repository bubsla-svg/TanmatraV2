import { useState, useRef, useEffect, lazy, Suspense } from "react";
import {
  MapPin,
  Target,
  MagnifyingGlass,
  House,
  Buildings,
  Notepad,
  ArrowLeft,
  X,
  CircleNotch,
  CheckCircle,
  Warning,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { checkPincode } from "@/lib/serviceablePincodes";
import { API_BASE } from "@/lib/apiBase";

// Default map centre — Noida Sector 18 (our core serviceable NCR area).
const DEFAULT_CENTER = { lat: 28.5708, lng: 77.326 } as const;

// Leaflet touches `window` at import time, which crashes the SSR prerender
// (react-router build). Load the map only on the client, mirroring RiderMap.
const PickerMap = lazy(() => import("./PickerMap"));

interface LocationPickerFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (addressData: any) => Promise<void>;
  initialData?: any;
}

// ── Canvas-free location picker ─────────────────────────────────────────
//
// The previous flow rendered a Google Maps JS canvas via the Extended
// Component Library map/loader custom elements. The
// frontend Maps key does not have the Maps JavaScript API enabled, so the
// canvas could never boot in production — users saw "Map tiles couldn't
// load" and a dead pin. Rebuilt without any Maps JS dependency:
//
//   • Search   → Places API (New) REST autocomplete + place details —
//                the one Google surface verified to work with this key.
//   • Locate   → browser geolocation reverse-geocoded through OUR api
//                (`/geo/reverse`, server GOOGLE_API_KEY — Geocoding API
//                verified enabled server-side).
//   • Manual   → the details form, always one tap away.
//
// No script injection, no custom elements, no tiles — nothing left that
// can fail to boot.

const MAPS_API_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? "";

interface GeoPlace {
  formattedAddress: string;
  city: string;
  pincode: string;
}

interface Suggestion {
  id: string;
  main: string;
  secondary: string;
  // Present when the suggestion came from the server geocoder fallback
  // (/geo/search) — selecting it fills the address directly, no details call.
  place?: GeoPlace;
}

export function LocationPickerFlow({ open, onOpenChange, onSave, initialData }: LocationPickerFlowProps) {
  const [step, setStep] = useState<"locate" | "details">("locate");

  // Resolved location
  const [locality, setLocality] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [locating, setLocating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [locSource, setLocSource] = useState<"gps" | "search" | "pin" | null>(null);

  // Map pin position + a bump counter that tells the map to recentre (only
  // GPS/search bump it; dragging the map does not, so the map never fights
  // the user). lastResolvedRef dedupes reverse-geocodes for the same spot.
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ ...DEFAULT_CENTER });
  const [recenterSeq, setRecenterSeq] = useState(0);
  const lastResolvedRef = useRef<string>("");

  // Search state (Places REST — no Maps JS involved)
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  // Inline status under the search box (no-matches / unavailable) so the box
  // is never a silent dead-end. Null = no message.
  const [searchHint, setSearchHint] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form details
  const [orderingFor, setOrderingFor] = useState<"myself" | "someone">("myself");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [addressType, setAddressType] = useState<"home" | "work" | "hotel" | "other">("home");
  const [flatNo, setFlatNo] = useState("");
  const [floor, setFloor] = useState("");
  const [landmark, setLandmark] = useState("");
  const [otherLabel, setOtherLabel] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset on open / prefill when editing
  useEffect(() => {
    if (open && initialData) {
      setStep("details");
      setFlatNo(initialData.line1 || "");
      setLocality(initialData.line2 || "");
      setCity(initialData.city || "");
      setPincode(initialData.pincode || "");
      setRecipientPhone(initialData.phone || "");
      setAddressType(initialData.type === "home" ? "home" : initialData.type === "work" ? "work" : "other");
    } else if (open) {
      setStep("locate");
      setFlatNo("");
      setLocality("");
      setCity("");
      setPincode("");
      setRecipientName("");
      setRecipientPhone("");
      setAddressType("home");
      setFloor("");
      setLandmark("");
      setSearchQuery("");
      setSuggestions([]);
      setSearchHint(null);
      setLocSource(null);
      setCoords({ ...DEFAULT_CENTER });
      lastResolvedRef.current = "";
    }
    if (!open) {
      setLocating(false);
      setResolving(false);
    }
  }, [open, initialData]);

  // ── Search: Places (New) REST, with a server-geocoder fallback ────────
  // The box must NEVER accept typing and do nothing. If the frontend Places
  // key is missing or its call fails, we fall back to our own server
  // (/geo/search, server GOOGLE_API_KEY); if THAT is unconfigured we show an
  // inline hint instead of silently swallowing the query.
  const SEARCH_UNAVAILABLE_HINT =
    "Search is unavailable right now — use your location or enter the address manually.";

  const queryServerSearch = async (input: string) => {
    try {
      const res = await fetch(`${API_BASE}/geo/search?q=${encodeURIComponent(input.trim())}`);
      if (res.status === 503) {
        setSuggestions([]);
        setSearchHint(SEARCH_UNAVAILABLE_HINT);
        return;
      }
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; results?: GeoPlace[] }
        | null;
      if (res.ok && data?.ok && Array.isArray(data.results)) {
        if (data.results.length === 0) {
          setSuggestions([]);
          setSearchHint("No matches — try a nearby landmark or sector.");
          return;
        }
        setSearchHint(null);
        setSuggestions(
          data.results.slice(0, 6).map((r, i) => ({
            id: `srv-${i}`,
            main: r.formattedAddress.split(",")[0]?.trim() || r.formattedAddress,
            secondary: r.formattedAddress,
            place: r,
          })),
        );
        return;
      }
      setSuggestions([]);
      setSearchHint(SEARCH_UNAVAILABLE_HINT);
    } catch {
      setSuggestions([]);
      setSearchHint(SEARCH_UNAVAILABLE_HINT);
    }
  };

  const queryPlacesRest = async (input: string) => {
    if (input.trim().length < 3) return;
    // No frontend Places key → straight to the server geocoder.
    if (!MAPS_API_KEY) {
      await queryServerSearch(input);
      return;
    }
    try {
      const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": MAPS_API_KEY },
        body: JSON.stringify({
          input: input.trim(),
          includedRegionCodes: ["in"],
          locationBias: { circle: { center: { latitude: 28.55, longitude: 77.25 }, radius: 50000 } },
        }),
      });
      if (!res.ok) {
        await queryServerSearch(input);
        return;
      }
      const data = (await res.json()) as any;
      const mapped: Suggestion[] = (data.suggestions ?? [])
        .map((sg: any) => sg.placePrediction)
        .filter(Boolean)
        .slice(0, 6)
        .map((pp: any) => ({
          id: pp.placeId as string,
          main: pp.structuredFormat?.mainText?.text ?? pp.text?.text ?? "",
          secondary: pp.structuredFormat?.secondaryText?.text ?? "",
        }));
      if (mapped.length === 0) {
        // Places found nothing — try the server geocoder before giving up.
        await queryServerSearch(input);
        return;
      }
      setSearchHint(null);
      setSuggestions(mapped);
    } catch {
      await queryServerSearch(input);
    }
  };

  const choosePlace = async (sg: Suggestion) => {
    setSuggestions([]);
    setSearchHint(null);
    setSearchQuery(sg.main);
    // Server-fallback result already carries the resolved address — fill
    // directly, no Places details call needed.
    if (sg.place) {
      if (sg.place.formattedAddress) setLocality(sg.place.formattedAddress);
      if (sg.place.city) setCity(sg.place.city);
      if (sg.place.pincode) setPincode(sg.place.pincode);
      setLocSource("search");
      return;
    }
    if (!MAPS_API_KEY) return;
    setResolving(true);
    try {
      const res = await fetch(`https://places.googleapis.com/v1/places/${sg.id}`, {
        headers: {
          "X-Goog-Api-Key": MAPS_API_KEY,
          "X-Goog-FieldMask": "location,formattedAddress,addressComponents",
        },
      });
      if (!res.ok) {
        toast.info("Couldn't load that place — try another result or enter manually");
        return;
      }
      const place = (await res.json()) as any;
      if (place.formattedAddress) setLocality(place.formattedAddress);
      let cityStr = "";
      let pinStr = "";
      for (const c of place.addressComponents ?? []) {
        if (c.types?.includes("locality")) cityStr = c.longText;
        if (c.types?.includes("postal_code")) pinStr = c.longText;
      }
      if (cityStr) setCity(cityStr);
      if (pinStr) setPincode(pinStr);
      setLocSource("search");
      // Recentre the map on the chosen place so the pin lands there.
      const lat = place.location?.latitude;
      const lng = place.location?.longitude;
      if (typeof lat === "number" && typeof lng === "number") {
        lastResolvedRef.current = `${lat.toFixed(5)},${lng.toFixed(5)}`;
        setCoords({ lat, lng });
        setRecenterSeq((s) => s + 1);
      }
    } catch {
      // leave whatever we had
    } finally {
      setResolving(false);
    }
  };

  const onSearchChange = (v: string) => {
    setSearchQuery(v);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (v.trim().length < 3) {
      setSuggestions([]);
      setSearchHint(null);
      return;
    }
    searchDebounceRef.current = setTimeout(() => queryPlacesRest(v), 300);
  };

  // Reverse-geocode a lat/lng into the address fields — shared by GPS and by
  // dragging the map pin. Deduped so a settle-in-place doesn't refetch. On a
  // failure it never dead-ends: for user-initiated calls it nudges toward
  // manual entry; silent (auto-locate) calls stay quiet.
  const resolveByCoords = async (
    lat: number,
    lng: number,
    opts: { userInitiated: boolean; source: "gps" | "pin" },
  ) => {
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (key === lastResolvedRef.current) return;
    lastResolvedRef.current = key;
    setResolving(true);
    try {
      const res = await fetch(`${API_BASE}/geo/reverse?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`);
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; formattedAddress?: string; city?: string; pincode?: string }
        | null;
      if (res.ok && data?.ok && data.formattedAddress) {
        setLocality(data.formattedAddress);
        if (data.city) setCity(data.city);
        if (data.pincode) setPincode(data.pincode);
        setLocSource(opts.source);
      } else if (opts.userInitiated) {
        toast.info("Couldn't name that spot — nudge the pin, search, or enter details manually");
      }
    } catch {
      if (opts.userInitiated) {
        toast.info("Couldn't resolve that location — search your area or enter it manually");
      }
    } finally {
      setResolving(false);
    }
  };

  // Dragging the map re-places the pin → reverse-geocode the new centre.
  const handleMapDragEnd = (lat: number, lng: number) => {
    setCoords({ lat, lng });
    void resolveByCoords(lat, lng, { userInitiated: true, source: "pin" });
  };

  // ── GPS → server reverse geocode (no Maps JS) ─────────────────────────
  // `userInitiated` distinguishes an explicit tap (surface errors) from the
  // silent auto-locate on open (permission granted ≠ position obtainable —
  // never toast a banner the user didn't ask for). Explicit taps also get a
  // retry ladder: high-accuracy first, then one low-accuracy retry, since
  // high-accuracy fixes routinely time out on desktops/VPNs.
  const handleUseCurrentLocation = (userInitiated = true) => {
    if (!navigator.geolocation) {
      if (userInitiated) {
        toast.error("Location is not supported by your browser — search your area instead");
      }
      return;
    }
    setLocating(true);

    const onPosition = (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      setLocating(false);
      // Recentre the map on the fix and reverse-geocode it.
      setCoords({ lat: latitude, lng: longitude });
      setRecenterSeq((s) => s + 1);
      void resolveByCoords(latitude, longitude, { userInitiated, source: "gps" });
    };

    const HIGH_ACCURACY: PositionOptions = { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 };
    const LOW_ACCURACY: PositionOptions = { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 };

    const onError = (err: GeolocationPositionError, isRetry: boolean) => {
      // PERMISSION_DENIED is never retryable — distinct, actionable copy.
      if (err.code === err.PERMISSION_DENIED) {
        setLocating(false);
        if (userInitiated) {
          toast.info(
            "Location permission is off for this site — allow it in your browser settings, or search your area instead",
          );
        }
        return;
      }
      // TIMEOUT / POSITION_UNAVAILABLE: retry once at low accuracy, keeping
      // the spinner up, before surfacing anything.
      if (!isRetry) {
        navigator.geolocation.getCurrentPosition(onPosition, (e) => onError(e, true), LOW_ACCURACY);
        return;
      }
      setLocating(false);
      if (userInitiated) {
        toast.info("Couldn't get your location — search your area or enter the address manually");
      }
    };

    navigator.geolocation.getCurrentPosition(onPosition, (e) => onError(e, false), HIGH_ACCURACY);
  };

  // Auto-pick: when the flow opens for a NEW address and the browser has
  // already granted geolocation, locate straight away. First-time visitors
  // must tap the button themselves so the browser's permission dialog never
  // appears unprompted. Ref (not state) so re-renders can't re-trigger it.
  const autoLocatedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      autoLocatedRef.current = false;
      return;
    }
    if (initialData || step !== "locate" || autoLocatedRef.current) return;
    if (!navigator.geolocation || !navigator.permissions?.query) return;
    let cancelled = false;
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((status) => {
        if (cancelled || autoLocatedRef.current) return;
        if (status.state === "granted") {
          autoLocatedRef.current = true;
          // Silent: a failed auto-locate must not toast an unprompted banner.
          handleUseCurrentLocation(false);
        }
      })
      .catch(() => {
        // Permissions API unavailable (older Safari) — keep manual buttons.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, initialData]);

  // Early serviceability signal — surfaced as soon as a PIN is known.
  const pinCheck = checkPincode(pincode);

  const handleSaveAddress = async () => {
    if (!flatNo.trim()) {
      toast.error("Flat/House number is required");
      return;
    }
    if (!locality.trim()) {
      toast.error("Locality address is missing");
      return;
    }
    if (orderingFor === "someone" && (!recipientName.trim() || !recipientPhone.trim())) {
      toast.error("Recipient name and phone number are required");
      return;
    }
    const check = checkPincode(pincode.trim());
    if (check.state === "empty" || check.state === "invalid") {
      toast.error("Please enter your 6-digit PIN code");
      return;
    }
    if (check.state === "unserviceable") {
      toast.error(`We do not deliver to pincode ${pincode} yet. We are expanding rapidly across Noida!`);
      return;
    }

    setSaving(true);
    try {
      const recipientPrefix = orderingFor === "someone" && recipientName.trim()
        ? `For: ${recipientName.trim()}`
        : null;
      const finalLine1 = flatNo.trim();
      const finalLine2 = [recipientPrefix, floor.trim(), landmark.trim(), locality.trim()].filter(Boolean).join(", ");

      const finalLabel = addressType === "other" ? (otherLabel.trim() || "Other") : addressType.charAt(0).toUpperCase() + addressType.slice(1);
      const finalType = addressType === "hotel" ? "other" : addressType;

      const finalPhone = recipientPhone.trim();

      await onSave({
        label: finalLabel,
        type: finalType,
        line1: finalLine1,
        line2: finalLine2,
        city: city || check.info.city,
        pincode: pincode,
        phone: finalPhone,
      });

      onOpenChange(false);
    } catch (err: any) {
      toast.error("Failed to save address: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="tnm2 nn bg-black/60"
      style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
      onClick={() => onOpenChange(false)}
    >
      <div
        className="card w-full max-w-none sm:max-w-lg h-[100dvh] sm:h-[80vh] flex flex-col overflow-hidden"
        style={{ padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* STEP 1: Locate — search, GPS, or manual */}
        {step === "locate" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--ln)" }}>
              <div className="tt" style={{ color: "var(--tx)" }}>Where should we deliver?</div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
                className="iconbtn"
                style={{ width: 32, height: 32 }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <p className="fine">
                We deliver across Noida — search your area, use your
                location, or type the address yourself.
              </p>

              {/* Search — Places REST, no map required */}
              <div className="relative">
                <div
                  className="rounded-lg p-1 flex items-center gap-1"
                  style={{ background: "var(--s1)", border: "1px solid var(--ln)" }}
                >
                  <MagnifyingGlass className="w-4 h-4 shrink-0 ml-2" style={{ color: "var(--mut)" }} />
                  <input
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Search area, sector or landmark…"
                    className="f1"
                    style={{ height: 38, fontSize: 13, color: "var(--tx)", padding: "0 6px", width: "100%" }}
                  />
                  {resolving && (
                    <CircleNotch className="w-4 h-4 animate-spin shrink-0 mr-2" style={{ color: "var(--safb)" }} />
                  )}
                </div>

                {suggestions.length > 0 && (
                  <div
                    className="absolute inset-x-0 z-20 mt-1 rounded-lg overflow-hidden shadow-lg"
                    style={{ background: "var(--s1)", border: "1px solid var(--ln)" }}
                  >
                    {suggestions.map((sg) => (
                      <button
                        key={sg.id}
                        type="button"
                        onClick={() => choosePlace(sg)}
                        className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left"
                        style={{ borderBottom: "1px solid var(--ln)" }}
                      >
                        <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--safb)" }} />
                        <span className="min-w-0">
                          <span className="block text-xs font-medium truncate" style={{ color: "var(--tx)" }}>{sg.main}</span>
                          {sg.secondary && (
                            <span className="block text-[10px] truncate" style={{ color: "var(--mut)" }}>{sg.secondary}</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Inline search status — the box is never a silent dead-end. */}
              {searchHint && suggestions.length === 0 && (
                <p className="fine -mt-1" style={{ color: "var(--mut)" }}>
                  {searchHint}
                </p>
              )}

              {/* GPS */}
              <button
                type="button"
                onClick={() => handleUseCurrentLocation(true)}
                disabled={locating}
                className={`btn btn-g btn-blk ${locating ? "dis" : ""}`}
                style={{ color: "var(--safb)", borderColor: "var(--saf)" }}
              >
                {locating ? (
                  <>
                    <CircleNotch className="w-4 h-4 animate-spin" />
                    Finding you…
                  </>
                ) : (
                  <>
                    <Target className="w-4 h-4" weight="bold" />
                    Use my current location
                  </>
                )}
              </button>

              {/* Drag-to-position map — OpenStreetMap tiles via Leaflet (no
                  Google Maps JS, which is disabled on the frontend key),
                  lazy-loaded client-side. Drag the map to move the pin. */}
              <div className="relative rounded-lg overflow-hidden" style={{ height: 240, border: "1px solid var(--ln)" }}>
                <Suspense
                  fallback={
                    <div className="w-full h-full flex items-center justify-center" style={{ background: "var(--s2)" }}>
                      <CircleNotch className="w-5 h-5 animate-spin" style={{ color: "var(--safb)" }} />
                    </div>
                  }
                >
                  <PickerMap coords={coords} recenterSeq={recenterSeq} onDragEnd={handleMapDragEnd} />
                </Suspense>
              </div>

              {/* Resolved location card */}
              {locality && (
                <div
                  className="rounded-lg p-3 space-y-2"
                  style={{ background: "var(--s1)", border: "1px solid var(--ln)" }}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-md flex items-center justify-center shrink-0" style={{ background: "var(--safd)", border: "1px solid var(--saf)" }}>
                      <MapPin className="w-5 h-5" style={{ color: "var(--safb)" }} weight="bold" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-xs font-semibold" style={{ color: "var(--tx)" }}>
                        {locSource === "gps" ? "Your current location" : "Selected location"}
                      </p>
                      <p className="text-[11px] mt-0.5 line-clamp-3" style={{ color: "var(--mut)" }}>
                        {locality}
                      </p>
                    </div>
                  </div>

                  {pinCheck.state === "serviceable" && (
                    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--sage)" }}>
                      <CheckCircle className="w-3.5 h-3.5" weight="fill" />
                      We deliver here — {pinCheck.info.area}
                    </div>
                  )}
                  {pinCheck.state === "unserviceable" && (
                    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--dgr)" }}>
                      <Warning className="w-3.5 h-3.5" weight="fill" />
                      Pincode {pincode} looks outside our zone — you can adjust it in the next step.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 mt-auto space-y-2" style={{ borderTop: "1px solid var(--ln)", background: "var(--s1)" }}>
              <button
                type="button"
                onClick={() => setStep("details")}
                disabled={!locality || resolving}
                className={`btn btn-p btn-blk ${!locality || resolving ? "dis" : ""}`}
              >
                Confirm location &amp; add details
              </button>
              <button
                type="button"
                onClick={() => setStep("details")}
                className="btn btn-blk"
                style={{ color: "var(--mut)" }}
              >
                Enter address manually
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Enter Complete Address */}
        {step === "details" && (
          <div className="flex-1 flex flex-col overflow-y-auto">
            <div className="p-4 flex flex-row items-center justify-between" style={{ borderBottom: "1px solid var(--ln)" }}>
              <div className="fx ac" style={{ gap: 8 }}>
                {!initialData && (
                  <button
                    type="button"
                    onClick={() => setStep("locate")}
                    aria-label="Back to location search"
                    className="iconbtn"
                    style={{ width: 32, height: 32 }}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <div className="tt" style={{ color: "var(--tx)" }}>Enter complete address</div>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
                className="iconbtn"
                style={{ width: 32, height: 32 }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-4 space-y-4">
              {/* Ordering for */}
              <div className="space-y-2">
                <label className="lab">Ordering for *</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    id="myself"
                    onClick={() => setOrderingFor("myself")}
                    className={orderingFor === "myself" ? "chip on" : "chip"}
                  >
                    Myself
                  </button>
                  <button
                    type="button"
                    id="someone"
                    onClick={() => setOrderingFor("someone")}
                    className={orderingFor === "someone" ? "chip on" : "chip"}
                  >
                    Someone else
                  </button>
                </div>
              </div>

              {/* Save Address As */}
              <div className="space-y-2">
                <label className="lab">Save address as *</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "home", label: "Home", icon: House },
                    { value: "work", label: "Work", icon: Buildings },
                    { value: "hotel", label: "Hotel", icon: Notepad },
                    { value: "other", label: "Other", icon: MapPin },
                  ].map((item) => {
                    const Icon = item.icon;
                    const active = addressType === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setAddressType(item.value as any)}
                        className={active ? "chip on" : "chip"}
                      >
                        <Icon className="w-4 h-4" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                {addressType === "other" && (
                  <input
                    placeholder="e.g. Parents, Gym, Friends House"
                    value={otherLabel}
                    onChange={(e) => setOtherLabel(e.target.value)}
                    className="inp mt-2"
                  />
                )}
              </div>

              {/* Flat/House number */}
              <div className="space-y-1">
                <label className="lab">Flat / House no / Building name *</label>
                <input
                  value={flatNo}
                  onChange={(e) => setFlatNo(e.target.value)}
                  className="inp"
                />
              </div>

              {/* Floor (optional) */}
              <div className="space-y-1">
                <label className="lab">Floor (optional)</label>
                <input
                  placeholder="Floor (optional)"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  className="inp"
                />
              </div>

              {/* Area / Sector / Locality */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="lab">Area / Sector / Locality *</label>
                  {!initialData && (
                    <button
                      type="button"
                      onClick={() => setStep("locate")}
                      className="text-[11px] hover:underline flex items-center gap-1 font-medium"
                      style={{ color: "var(--safb)" }}
                    >
                      <MagnifyingGlass className="w-3.5 h-3.5" />
                      Search area
                    </button>
                  )}
                </div>
                <input
                  placeholder="e.g. Sector 62, Noida"
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
                  className="inp"
                />
              </div>

              {/* City + PIN — editable so a failed geocode is never a dead
                  end, with live serviceability feedback on the PIN. */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="lab">City *</label>
                  <input
                    placeholder="Noida"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="inp"
                  />
                </div>
                <div className="space-y-1">
                  <label className="lab">PIN code *</label>
                  <input
                    placeholder="201301"
                    inputMode="numeric"
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                    className="inp"
                    style={
                      pinCheck.state === "unserviceable"
                        ? { borderColor: "var(--dgr)" }
                        : pinCheck.state === "serviceable"
                          ? { borderColor: "var(--sage)" }
                          : undefined
                    }
                  />
                </div>
              </div>
              {pinCheck.state === "serviceable" && (
                <p className="flex items-center gap-1.5 text-[11px] -mt-2" style={{ color: "var(--sage)" }}>
                  <CheckCircle className="w-3.5 h-3.5" weight="fill" />
                  We deliver here — {pinCheck.info.area}
                </p>
              )}
              {pinCheck.state === "unserviceable" && (
                <p className="flex items-center gap-1.5 text-[11px] -mt-2" style={{ color: "var(--dgr)" }}>
                  <Warning className="w-3.5 h-3.5" weight="fill" />
                  We don't deliver to {pincode} yet — we deliver across Noida.
                </p>
              )}

              {/* Landmark (optional) */}
              <div className="space-y-1">
                <label className="lab">Nearby landmark (optional)</label>
                <input
                  placeholder="Nearby landmark (optional)"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  className="inp"
                />
              </div>

              {/* Someone Else Details */}
              {orderingFor === "someone" && (
                <div className="space-y-3 pt-2 animate-in fade-in duration-200" style={{ borderTop: "1px solid var(--ln)" }}>
                  <p className="text-[11px] font-semibold" style={{ color: "var(--mut)" }}>Enter details for seamless delivery experience</p>

                  <div className="space-y-1">
                    <label className="lab">Recipient's name *</label>
                    <input
                      placeholder="Recipient's Name"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="inp"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="lab">Recipient's phone number *</label>
                    <input
                      placeholder="e.g. +91 98765 43210"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      className="inp"
                    />
                  </div>
                </div>
              )}

            </div>

            <div className="p-4 mt-auto" style={{ borderTop: "1px solid var(--ln)", background: "var(--s1)" }}>
              <button
                type="button"
                onClick={handleSaveAddress}
                disabled={saving}
                className={`btn btn-p btn-blk ${saving ? "dis" : ""}`}
              >
                {saving ? "Saving..." : "Save address"}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
