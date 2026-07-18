import { useState, useRef, useEffect } from "react";
import { MapPin, Target, MagnifyingGlass, House, Buildings, Notepad, ArrowLeft, X, CircleNotch, CheckCircle, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";
import { checkPincode } from "@/lib/serviceablePincodes";

interface LocationPickerFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (addressData: any) => Promise<void>;
  initialData?: any;
}

// ── Google Maps bootstrap (component-local, idempotent) ─────────────────
//
// Root problem: root.tsx injects the ECL <script> and <gmpx-api-loader>
// globally, but those are async — if the script hasn't resolved by the time
// this dialog opens the old passive poll just times out and fails.
//
// Fix: this module actively loads ECL + triggers Maps JS API loading when the
// dialog opens, so the picker never depends on an externally managed sequence.

const MAPS_API_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? "";

// Warn in development so misconfigurations are caught early.
if (import.meta.env.DEV && !MAPS_API_KEY) {
  console.warn(
    "[LocationPickerFlow] VITE_GOOGLE_MAPS_API_KEY is not set — " +
      "the map picker will fall back to manual address entry.",
  );
}

// ECL version is pinned in ECL_SRC; update there when bumping.
const ECL_SRC =
  "https://ajax.googleapis.com/ajax/libs/@googlemaps/extended-component-library/0.6.11/index.min.js";

/** Module-level promise so concurrent callers never double-inject the script. */
let _eclLoadPromise: Promise<void> | null = null;

/**
 * Ensures the Extended Component Library module is loaded (registers gmp-map,
 * gmpx-place-picker, gmpx-api-loader, etc.). Idempotent: if ECL is already
 * loaded this resolves immediately.
 */
function loadECLScript(): Promise<void> {
  // Already registered — nothing to do.
  if (customElements.get("gmpx-api-loader")) return Promise.resolve();
  // In-flight — reuse the same promise.
  if (_eclLoadPromise) return _eclLoadPromise;

  _eclLoadPromise = new Promise<void>((resolve, reject) => {
    const onDefined = () =>
      customElements
        .whenDefined("gmpx-api-loader")
        .then(() => resolve())
        .catch((err: unknown) =>
          reject(
            new Error(
              `ECL custom element registration failed: ${String(err)}`,
            ),
          ),
        );

    // Script tag may already be in DOM (from root.tsx) — just wait for it.
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${ECL_SRC}"]`,
    );
    if (existing) {
      onDefined();
      return;
    }
    const script = document.createElement("script");
    script.type = "module";
    script.src = ECL_SRC;
    script.addEventListener("load", onDefined);
    script.addEventListener("error", () => {
      _eclLoadPromise = null; // allow a future retry
      reject(new Error("Google Maps Extended Component Library failed to load"));
    });
    document.head.appendChild(script);
  });
  return _eclLoadPromise;
}

/**
 * Ensures a <gmpx-api-loader> element is present in the DOM so the Maps JS
 * API (including Geocoder) gets bootstrapped. The element is idempotent — ECL
 * only fires the Maps bootstrap once regardless of how many elements exist.
 */
function ensureMapsAPILoader(apiKey: string): void {
  if (document.querySelector("gmpx-api-loader")) return;
  const el = document.createElement("gmpx-api-loader");
  el.setAttribute("apiKey", apiKey);
  el.setAttribute(
    "solution-channel",
    "GMP_GE_mapsandplacesautocomplete_v2",
  );
  document.head.appendChild(el);
}

/**
 * Active loader — loads ECL, kicks off Maps JS API bootstrap if needed, then
 * polls until `window.google.maps.Geocoder` is available (or timeout).
 *
 * Unlike the old passive `waitForGoogleMaps`, this function is the single
 * point that drives loading, so the component is self-sufficient.
 *
 * Timeout budget is split: 40% allocated to ECL loading, the remainder
 * reserved for Maps JS API polling, so each stage has adequate time.
 */
async function ensureGoogleMapsLoaded(timeoutMs: number): Promise<boolean> {
  if (!MAPS_API_KEY) return false;

  // Fast path: already fully loaded (e.g., root.tsx bootstrap already ran).
  if (
    customElements.get("gmp-map") &&
    (window as any).google?.maps?.Geocoder
  ) {
    return true;
  }

  // Allocate 40% of the budget to ECL script loading; the full deadline
  // remains available for Maps JS API polling in step 3.
  const eclBudgetMs = Math.round(timeoutMs * 0.4);
  const mapsDeadline = Date.now() + timeoutMs;

  // Step 1 — load ECL module (registers all gmp-* / gmpx-* custom elements).
  try {
    await Promise.race<void>([
      loadECLScript(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("ECL load timed out")),
          eclBudgetMs,
        ),
      ),
    ]);
  } catch {
    return false;
  }

  // Step 2 — ensure a <gmpx-api-loader> element exists to bootstrap Maps JS.
  if (!(window as any).google?.maps?.importLibrary) {
    ensureMapsAPILoader(MAPS_API_KEY);
  }

  // Step 3 — wait for the Maps JS bootstrap (`google.maps.importLibrary`),
  // then explicitly import the libraries we use. Under the modern dynamic
  // loader, classes like `google.maps.Geocoder` are LAZY — they only exist
  // after `importLibrary("geocoding")` resolves, so passively polling for
  // them would time out forever even with the API enabled.
  while (Date.now() < mapsDeadline) {
    if ((window as any).google?.maps?.importLibrary) break;
    await new Promise<void>((resolve) => setTimeout(resolve, 200));
  }
  const gmaps = (window as any).google?.maps;
  if (!gmaps?.importLibrary) return false;

  try {
    const remaining = Math.max(1_000, mapsDeadline - Date.now());
    await Promise.race([
      Promise.all([
        gmaps.importLibrary("maps"),
        gmaps.importLibrary("geocoding"),
        gmaps.importLibrary("marker"),
        customElements.whenDefined("gmp-map"),
      ]),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Maps libraries timed out")),
          remaining,
        ),
      ),
    ]);
  } catch {
    return false;
  }
  return !!(window as any).google?.maps?.Geocoder;
}

export function LocationPickerFlow({ open, onOpenChange, onSave, initialData }: LocationPickerFlowProps) {
  const [step, setStep] = useState<"prompt" | "map" | "details">("prompt");

  // Geolocation / Geocoding states
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: 28.5708, lng: 77.3260 }); // Noida Sector 18
  const [locality, setLocality] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsFailed, setMapsFailed] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [plainSearch, setPlainSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Places (New) REST suggestions — independent of Maps JS, so search works
  // even when the map canvas can't boot (e.g. Maps JavaScript API disabled
  // on the key while Places API (New) is enabled — verified server-side).
  const [suggestions, setSuggestions] = useState<
    Array<{ id: string; main: string; secondary: string }>
  >([]);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form details states
  const [orderingFor, setOrderingFor] = useState<"myself" | "someone">("myself");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [addressType, setAddressType] = useState<"home" | "work" | "hotel" | "other">("home");
  const [flatNo, setFlatNo] = useState("");
  const [floor, setFloor] = useState("");
  const [landmark, setLandmark] = useState("");
  const [otherLabel, setOtherLabel] = useState("");

  const [saving, setSaving] = useState(false);

  // Map refs
  const mapRef = useRef<any>(null);
  const autocompleteRef = useRef<any>(null);
  const lastGeocodedRef = useRef<{ lat: number; lng: number } | null>(null);

  // Initialize values if editing
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
      setStep("prompt");
      setFlatNo("");
      setLocality("");
      setCity("");
      setPincode("");
      setRecipientName("");
      setRecipientPhone("");
      setAddressType("home");
      setFloor("");
      setLandmark("");
    }
    if (!open) {
      setLocating(false);
      // Allow the loading sequence to retry on the next open if it failed
      // (e.g., transient network error, API key fixed, CSP updated).
      setMapsFailed(false);
    }
  }, [open, initialData]);

  // Google invokes the global gm_authFailure when the Maps JS API rejects
  // the key (API not enabled, billing off, bad referer). Without this hook
  // the map just renders a dead dark canvas — route it into the same
  // manual-entry fallback as a missing script.
  useEffect(() => {
    if (!open) return;
    (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
      console.error("[address-picker] Google Maps auth failure — check key/API enablement");
      setMapsReady(false);
      setMapsFailed(true);
    };
    return () => {
      delete (window as unknown as { gm_authFailure?: () => void }).gm_authFailure;
    };
  }, [open]);

  // Actively load Maps when the dialog opens instead of passively polling for
  // a globally injected script that may never arrive.
  useEffect(() => {
    if (!open || mapsReady || mapsFailed) return;
    if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
      console.warn("[address-picker] VITE_GOOGLE_MAPS_API_KEY not set. Using manual entry mode.");
      setMapsReady(false);
      setMapsFailed(true);
      return;
    }
    let cancelled = false;
    ensureGoogleMapsLoaded(12_000).then((ok) => {
      if (cancelled) return;
      setMapsReady(ok);
      setMapsFailed(!ok);
    });
    return () => {
      cancelled = true;
    };
  }, [open, mapsReady, mapsFailed]);

  const reverseGeocode = (lat: number, lng: number) => {
    const g = (window as any).google;
    if (!g?.maps?.Geocoder) return;
    setGeocoding(true);
    lastGeocodedRef.current = { lat, lng };
    let geocoder: any;
    try {
      geocoder = new g.maps.Geocoder();
    } catch {
      setGeocoding(false);
      setLocality((prev) => prev || `Dropped pin (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      return;
    }
    geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
      setGeocoding(false);
      if (status === "OK" && results?.[0]) {
        const place = results[0];
        parseAddressComponents(place.address_components);
        setLocality(place.formatted_address);
      } else {
        // Geocoder denied/over-quota/no result: never dead-end the flow —
        // the user can still proceed and type details manually.
        setLocality((prev) => prev || `Dropped pin (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      }
    });
  };

  const parseAddressComponents = (components: any[]) => {
    let cityStr = "";
    let pinStr = "";
    for (const comp of components) {
      const types = comp.types;
      if (types.includes("locality")) {
        cityStr = comp.long_name;
      } else if (types.includes("postal_code")) {
        pinStr = comp.long_name;
      }
    }
    if (cityStr) setCity(cityStr);
    if (pinStr) setPincode(pinStr);
  };

  // Enter-to-search fallback when Autocomplete is unavailable: forward-
  // geocode the typed query and recenter the map.
  const handlePlainSearch = (query: string) => {
    const g = (window as any).google;
    if (!g?.maps?.Geocoder || !query.trim()) return;
    setGeocoding(true);
    try {
      const geocoder = new g.maps.Geocoder();
      geocoder.geocode(
        { address: `${query.trim()}, India`, componentRestrictions: { country: "in" } },
        (results: any, status: any) => {
          setGeocoding(false);
          if (status === "OK" && results?.[0]?.geometry?.location) {
            const loc = results[0].geometry.location;
            const next = { lat: loc.lat(), lng: loc.lng() };
            lastGeocodedRef.current = next;
            setCoords(next);
            if (mapRef.current) {
              mapRef.current.setCenter(next);
              mapRef.current.setZoom(16);
            }
            parseAddressComponents(results[0].address_components || []);
            setLocality(results[0].formatted_address || "");
          } else {
            toast.info("Couldn't find that area — try a nearby landmark or sector");
          }
        },
      );
    } catch {
      setGeocoding(false);
    }
  };

  // ── Places (New) REST search — key-capability-proof search path ──
  const queryPlacesRest = async (input: string) => {
    if (!MAPS_API_KEY || input.trim().length < 3) return;
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
      if (!res.ok) return;
      const data = (await res.json()) as any;
      setSuggestions(
        (data.suggestions ?? [])
          .map((sg: any) => sg.placePrediction)
          .filter(Boolean)
          .slice(0, 6)
          .map((pp: any) => ({
            id: pp.placeId as string,
            main: pp.structuredFormat?.mainText?.text ?? pp.text?.text ?? "",
            secondary: pp.structuredFormat?.secondaryText?.text ?? "",
          })),
      );
    } catch {
      // network/deny — Enter-to-geocode fallback still available
    }
  };

  const choosePlace = async (placeId: string, label: string) => {
    setSuggestions([]);
    setSearchQuery(label);
    if (!MAPS_API_KEY) return;
    setGeocoding(true);
    try {
      const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        headers: {
          "X-Goog-Api-Key": MAPS_API_KEY,
          "X-Goog-FieldMask": "location,formattedAddress,addressComponents",
        },
      });
      if (!res.ok) return;
      const place = (await res.json()) as any;
      const next = { lat: place.location?.latitude, lng: place.location?.longitude };
      if (typeof next.lat === "number" && typeof next.lng === "number") {
        lastGeocodedRef.current = next;
        setCoords(next);
        if (mapRef.current) {
          mapRef.current.center = `${next.lat},${next.lng}`;
          mapRef.current.zoom = 17;
          const marker = document.querySelector("gmp-advanced-marker") as any;
          if (marker) marker.position = `${next.lat},${next.lng}`;
        }
      }
      if (place.formattedAddress) setLocality(place.formattedAddress);
      let cityStr = "", pinStr = "";
      for (const c of place.addressComponents ?? []) {
        if (c.types?.includes("locality")) cityStr = c.longText;
        if (c.types?.includes("postal_code")) pinStr = c.longText;
      }
      if (cityStr) setCity(cityStr);
      if (pinStr) setPincode(pinStr);
    } catch {
      // leave whatever we had
    } finally {
      setGeocoding(false);
    }
  };

  const onSearchChange = (v: string) => {
    setSearchQuery(v);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (v.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    searchDebounceRef.current = setTimeout(() => queryPlacesRest(v), 300);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location is not supported by your browser — drop the pin instead");
      setStep("map");
      return;
    }
    // Move to the map IMMEDIATELY — the old flow blocked on the prompt
    // screen (GPS can take 30s+ with no feedback). The map shows a
    // "finding you" chip while we wait, and the default pin stays usable.
    setLocating(true);
    setStep("map");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const { latitude, longitude } = position.coords;
        const next = { lat: latitude, lng: longitude };
        setCoords(next);
        if (mapRef.current) {
          mapRef.current.setCenter(next);
          mapRef.current.setZoom(16);
        }
        reverseGeocode(latitude, longitude);
      },
      () => {
        setLocating(false);
        toast.info("Couldn't get your location — drag the pin or search your area instead");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  };

  // Early serviceability signal on the map step — the old flow let you
  // fill the entire details form before revealing "we don't deliver here".
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
      toast.error(`We do not deliver to pincode ${pincode} yet. We are expanding rapidly across Noida, Delhi & Gurgaon!`);
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

        {/* STEP 1: Initial Prompt */}
        {step === "prompt" && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6" style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="iconbtn"
              style={{ position: "absolute", top: 12, right: 12 }}
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ background: "var(--safd)", border: "1px solid var(--saf)" }}>
              <MapPin className="w-12 h-12" style={{ color: "var(--safb)" }} weight="fill" />
            </div>
            <div className="space-y-2">
              <h3 className="h2" style={{ color: "var(--tx)" }}>Where should we deliver?</h3>
              <p className="fine">
                We deliver across Noida, Delhi & Gurgaon — pick your location or type the address.
              </p>
            </div>
            <div className="w-full space-y-3">
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="btn btn-p btn-blk"
              >
                <Target className="w-4 h-4" weight="bold" />
                Use my current location
              </button>
              <button
                type="button"
                onClick={() => setStep("map")}
                className="btn btn-g btn-blk"
              >
                <MapPin className="w-4 h-4" style={{ color: "var(--safb)" }} />
                Select location on map
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

        {/* STEP 2: Map Selector */}
        {step === "map" && (
          <div className="flex-1 flex flex-col relative">
            <div className="absolute top-4 inset-x-4 z-10 flex gap-2 items-center">
              <button
                type="button"
                onClick={() => setStep("prompt")}
                className="iconbtn shrink-0"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div
                className="flex-1 min-w-0 rounded-lg overflow-hidden shadow-lg p-1 flex items-center gap-1"
                style={{ background: "var(--s1)", border: "1px solid var(--ln)" }}
              >
                {mapsReady && !plainSearch ? (
                  <div className="flex-1 w-full relative">
                    <gmpx-place-picker
                      ref={(picker: any) => {
                        if (picker && !autocompleteRef.current) {
                          autocompleteRef.current = picker;
                          picker.addEventListener("gmpx-placechange", () => {
                            try {
                              const place = picker.value;
                              if (!place || !place.location) return;
                              const loc = place.location;
                              const next = {
                                lat: typeof loc.lat === "function" ? loc.lat() : loc.lat,
                                lng: typeof loc.lng === "function" ? loc.lng() : loc.lng,
                              };
                              lastGeocodedRef.current = next;
                              setCoords(next);
                              if (mapRef.current) {
                                if (place.viewport && mapRef.current.innerMap) {
                                  mapRef.current.innerMap.fitBounds(place.viewport);
                                } else {
                                  mapRef.current.center = `${next.lat},${next.lng}`;
                                  mapRef.current.zoom = 17;
                                }
                              }
                              const marker = document.querySelector("gmp-advanced-marker") as any;
                              if (marker) marker.position = `${next.lat},${next.lng}`;
                              if (place.formattedAddress) setLocality(place.formattedAddress);
                              if (place.addressComponents) parseAddressComponents(place.addressComponents);
                              else reverseGeocode(next.lat, next.lng);
                            } catch {}
                          });
                        }
                      }}
                      placeholder="Enter or search an address…"
                      style={{ width: "100%", display: "block" }}
                    ></gmpx-place-picker>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handlePlainSearch(searchQuery);
                    }}
                    className="flex-1 flex items-center gap-1 px-2"
                  >
                    <MagnifyingGlass className="w-4 h-4 shrink-0" style={{ color: "var(--mut)" }} />
                    <input
                      value={searchQuery}
                      onChange={(e) => onSearchChange(e.target.value)}
                      placeholder="Search area, sector or landmark…"
                      className="f1"
                      style={{ height: 32, fontSize: 12, color: "var(--tx)", padding: "0 4px" }}
                    />
                    <button
                      type="submit"
                      className="btn btn-p"
                      style={{ height: 28, fontSize: 12, padding: "0 10px" }}
                    >
                      Search
                    </button>
                  </form>
                )}
                {mapsReady && (
                  <button
                    type="button"
                    onClick={() => setPlainSearch(!plainSearch)}
                    className="text-[10px] hover:underline shrink-0 px-2 font-medium"
                    style={{ color: "var(--safb)" }}
                    title={plainSearch ? "Use Google Place Picker" : "Use standard text search"}
                  >
                    {plainSearch ? "Place Picker" : "Text Search"}
                  </button>
                )}
              </div>
            </div>

            {/* Live suggestions (Places REST) — floats under the search bar
                and works even when the map canvas failed to boot. */}
            {suggestions.length > 0 && (
              <div
                className="absolute top-16 inset-x-4 z-20 mt-1 rounded-lg overflow-hidden shadow-lg"
                style={{ background: "var(--s1)", border: "1px solid var(--ln)" }}
              >
                {suggestions.map((sg) => (
                  <button
                    key={sg.id}
                    type="button"
                    onClick={() => choosePlace(sg.id, sg.main)}
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

            {/* Google Map Container with Extended Components */}
            <div className="flex-1 w-full relative" style={{ background: "var(--bg)" }}>
              {!mapsReady && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3" style={{ background: "var(--bg)" }}>
                  {!mapsFailed ? (
                    <>
                      <CircleNotch className="w-7 h-7 animate-spin" style={{ color: "var(--safb)" }} />
                      <p className="fine">Loading map components…</p>
                    </>
                  ) : (
                    <>
                      <Warning className="w-7 h-7" style={{ color: "var(--dgr)" }} />
                      <p className="fine text-center px-8">
                        Map tiles couldn't load — search your area above, or enter
                        the address manually.
                      </p>
                      <button
                        type="button"
                        onClick={() => setStep("details")}
                        className="btn btn-p"
                        style={{ height: 36, fontSize: 12 }}
                      >
                        Enter address manually
                      </button>
                    </>
                  )}
                </div>
              )}

              {locating && mapsReady && (
                <div
                  className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full px-3 py-1.5 bg-nn-bg/80"
                  style={{ border: "1px solid var(--ln)" }}
                >
                  <CircleNotch className="w-3.5 h-3.5 animate-spin" style={{ color: "var(--safb)" }} />
                  <span className="text-[11px]" style={{ color: "var(--tx)" }}>Finding you…</span>
                </div>
              )}

              {mapsReady && (
                <gmp-map
                  ref={(node: any) => {
                    if (node && !mapRef.current) {
                      mapRef.current = node;
                      customElements.whenDefined("gmp-map").then(() => {
                        if (node.innerMap) {
                          node.innerMap.setOptions({
                            mapTypeControl: false,
                            gestureHandling: "greedy",
                          });
                          node.innerMap.addListener("idle", () => {
                            try {
                              const center = node.innerMap.getCenter();
                              if (!center) return;
                              const next = { lat: center.lat(), lng: center.lng() };
                              const last = lastGeocodedRef.current;
                              const moved =
                                !last ||
                                Math.abs(next.lat - last.lat) > 1e-5 ||
                                Math.abs(next.lng - last.lng) > 1e-5;
                              if (!moved) return;
                              setCoords(next);
                              reverseGeocode(next.lat, next.lng);
                              const marker = node.querySelector("gmp-advanced-marker") as any;
                              if (marker) marker.position = `${next.lat},${next.lng}`;
                            } catch {}
                          });
                        }
                      });
                    }
                  }}
                  center={`${coords.lat},${coords.lng}`}
                  zoom="15"
                  map-id="DEMO_MAP_ID"
                  style={{ width: "100%", height: "100%", display: "block" }}
                >
                  <gmp-advanced-marker position={`${coords.lat},${coords.lng}`}></gmp-advanced-marker>
                </gmp-map>
              )}
            </div>

            {/* Bottom Preview Card */}
            <div className="p-4 space-y-3" style={{ background: "var(--s1)", borderTop: "1px solid var(--ln)" }}>
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-md flex items-center justify-center shrink-0" style={{ background: "var(--safd)", border: "1px solid var(--saf)" }}>
                  {geocoding ? (
                    <CircleNotch className="w-4 h-4 animate-spin" style={{ color: "var(--safb)" }} />
                  ) : (
                    <MapPin className="w-5 h-5" style={{ color: "var(--safb)" }} weight="bold" />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-semibold truncate" style={{ color: "var(--tx)" }}>Delivering your order to</p>
                  <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: "var(--mut)" }}>
                    {geocoding ? "Updating address…" : locality || "Move the map to drop your pin"}
                  </p>
                </div>
              </div>

              {/* Early serviceability signal — don't make the user fill a
                  whole form before learning we can't deliver. */}
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

              <button
                type="button"
                onClick={() => setStep("details")}
                disabled={!locality || geocoding}
                className={`btn btn-p btn-blk ${!locality || geocoding ? "dis" : ""}`}
              >
                Confirm location & add details
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Enter Complete Address */}
        {step === "details" && (
          <div className="flex-1 flex flex-col overflow-y-auto">
            <div className="p-4 flex flex-row items-center justify-between" style={{ borderBottom: "1px solid var(--ln)" }}>
              <div className="tt" style={{ color: "var(--tx)" }}>Enter complete address</div>
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

            <div className="p-4 space-y-4 text-left flex-1">

              {/* Recipient Segment */}
              <div className="space-y-2">
                <label className="lab">Who you are ordering for?</label>
                <div className="flex gap-4">
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
                  <button
                    type="button"
                    onClick={() => setStep("map")}
                    className="text-[11px] hover:underline flex items-center gap-1 font-medium"
                    style={{ color: "var(--safb)" }}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Pick on Map
                  </button>
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
                  We don't deliver to {pincode} yet — we deliver across Noida, Delhi & Gurgaon.
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
