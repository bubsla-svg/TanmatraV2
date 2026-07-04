import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MapPin, Target, MagnifyingGlass, House, Buildings, Notepad, ArrowLeft, X, CircleNotch, CheckCircle, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";
import { checkPincode } from "@/lib/serviceablePincodes";
import { cn } from "@/lib/utils";

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
  if (!(window as any).google?.maps?.Geocoder) {
    ensureMapsAPILoader(MAPS_API_KEY);
  }

  // Step 3 — poll until Maps JS API (Geocoder) is ready.
  while (Date.now() < mapsDeadline) {
    if ((window as any).google?.maps?.Geocoder) return true;
    await new Promise<void>((resolve) => setTimeout(resolve, 200));
  }
  return false;
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
      toast.error(`We do not deliver to pincode ${pincode} yet. We are expanding rapidly across Noida NCR!`);
      return;
    }

    setSaving(true);
    try {
      const finalLine1 = flatNo.trim();
      const finalLine2 = [floor.trim(), landmark.trim(), locality.trim()].filter(Boolean).join(", ");

      const finalLabel = addressType === "other" ? (otherLabel.trim() || "Other") : addressType.charAt(0).toUpperCase() + addressType.slice(1);
      const finalType = addressType === "hotel" ? "other" : addressType;

      const finalPhone = orderingFor === "someone"
        ? `${recipientPhone} (${recipientName})`
        : recipientPhone;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "p-0 bg-clinical-surface border-0 sm:border border-clinical-border w-full max-w-none sm:max-w-lg h-[100dvh] sm:h-[80vh] sm:rounded-lg flex flex-col overflow-hidden",
        step !== "prompt" && "[&>button]:hidden"
      )}>

        {/* STEP 1: Initial Prompt */}
        {step === "prompt" && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
            <div className="w-24 h-24 rounded-full bg-clinical-gold/10 flex items-center justify-center border border-clinical-gold/20">
              <MapPin className="w-12 h-12 text-clinical-gold" weight="fill" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-serif font-semibold text-white">Where should we deliver?</h3>
              <p className="text-xs text-clinical-zinc">
                We deliver across Noida & Delhi NCR — pick your location or type the address.
              </p>
            </div>
            <div className="w-full space-y-3">
              <Button
                onClick={handleUseCurrentLocation}
                className="w-full h-11 bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90 font-semibold text-sm gap-2"
              >
                <Target className="w-4 h-4" weight="bold" />
                Use my current location
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep("map")}
                className="w-full h-11 border-clinical-border text-white hover:bg-white/5 font-semibold text-sm gap-2"
              >
                <MapPin className="w-4 h-4 text-clinical-gold" />
                Select location on map
              </Button>
              <Button
                variant="ghost"
                onClick={() => setStep("details")}
                className="w-full h-10 text-clinical-zinc hover:text-white font-medium text-xs"
              >
                Enter address manually
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Map Selector */}
        {step === "map" && (
          <div className="flex-1 flex flex-col relative">
            <div className="absolute top-4 inset-x-4 z-10 flex gap-2 items-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setStep("prompt")}
                className="h-10 w-10 shrink-0 bg-clinical-surface/90 backdrop-blur-md border border-clinical-border rounded-lg text-white hover:bg-clinical-surface"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1 min-w-0 bg-clinical-surface/95 backdrop-blur-md rounded-lg border border-clinical-border overflow-hidden shadow-lg p-1 flex items-center gap-1">
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
                    <MagnifyingGlass className="w-4 h-4 text-clinical-zinc shrink-0" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search area, sector or landmark…"
                      className="h-8 border-0 bg-transparent text-xs text-white focus-visible:ring-0 px-1"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      className="h-7 bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90 text-xs px-2.5 font-semibold"
                    >
                      Search
                    </Button>
                  </form>
                )}
                {mapsReady && (
                  <button
                    type="button"
                    onClick={() => setPlainSearch(!plainSearch)}
                    className="text-[10px] text-clinical-gold hover:underline shrink-0 px-2 font-medium"
                    title={plainSearch ? "Use Google Place Picker" : "Use standard text search"}
                  >
                    {plainSearch ? "Place Picker" : "Text Search"}
                  </button>
                )}
              </div>
            </div>

            {/* Google Map Container with Extended Components */}
            <div className="flex-1 w-full bg-clinical-dark relative">
              {!mapsReady && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-clinical-dark">
                  {!mapsFailed ? (
                    <>
                      <CircleNotch className="w-7 h-7 text-clinical-gold animate-spin" />
                      <p className="text-xs text-clinical-zinc">Loading map components…</p>
                    </>
                  ) : (
                    <>
                      <Warning className="w-7 h-7 text-orange-400" />
                      <p className="text-xs text-clinical-zinc text-center px-8">
                        The map couldn't load. You can still enter your address manually.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => setStep("details")}
                        className="bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90 text-xs h-9"
                      >
                        Enter address manually
                      </Button>
                    </>
                  )}
                </div>
              )}

              {locating && mapsReady && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-black/80 border border-clinical-border rounded-full px-3 py-1.5">
                  <CircleNotch className="w-3.5 h-3.5 text-clinical-gold animate-spin" />
                  <span className="text-[11px] text-white">Finding you…</span>
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
            <div className="bg-clinical-surface border-t border-clinical-border p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-md bg-clinical-gold/10 border border-clinical-gold/20 flex items-center justify-center shrink-0">
                  {geocoding ? (
                    <CircleNotch className="w-4 h-4 text-clinical-gold animate-spin" />
                  ) : (
                    <MapPin className="w-5 h-5 text-clinical-gold" weight="bold" />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-semibold text-white truncate">Delivering your order to</p>
                  <p className="text-[11px] text-clinical-zinc mt-0.5 line-clamp-2">
                    {geocoding ? "Updating address…" : locality || "Move the map to drop your pin"}
                  </p>
                </div>
              </div>

              {/* Early serviceability signal — don't make the user fill a
                  whole form before learning we can't deliver. */}
              {pinCheck.state === "serviceable" && (
                <div className="flex items-center gap-1.5 text-[11px] text-clinical-sage">
                  <CheckCircle className="w-3.5 h-3.5" weight="fill" />
                  We deliver here — {pinCheck.info.area}
                </div>
              )}
              {pinCheck.state === "unserviceable" && (
                <div className="flex items-center gap-1.5 text-[11px] text-orange-300">
                  <Warning className="w-3.5 h-3.5" weight="fill" />
                  Pincode {pincode} looks outside our zone — you can adjust it in the next step.
                </div>
              )}

              <Button
                onClick={() => setStep("details")}
                disabled={!locality || geocoding}
                className="w-full h-11 bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90 font-semibold text-sm"
              >
                Confirm location & add details
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Enter Complete Address */}
        {step === "details" && (
          <div className="flex-1 flex flex-col overflow-y-auto">
            <DialogHeader className="p-4 border-b border-clinical-border flex flex-row items-center justify-between">
              <DialogTitle className="text-white text-base font-serif">Enter complete address</DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 text-clinical-zinc hover:text-white"
              >
                <X className="w-5 h-5" />
              </Button>
            </DialogHeader>

            <div className="p-4 space-y-4 text-left flex-1">

              {/* Recipient Segment */}
              <div className="space-y-2">
                <Label className="text-[11px] text-clinical-zinc">Who you are ordering for?</Label>
                <RadioGroup
                  value={orderingFor}
                  onValueChange={(v: any) => setOrderingFor(v)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="myself" id="myself" />
                    <Label htmlFor="myself" className="text-xs text-white cursor-pointer">Myself</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="someone" id="someone" />
                    <Label htmlFor="someone" className="text-xs text-white cursor-pointer">Someone else</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Save Address As */}
              <div className="space-y-2">
                <Label className="text-[11px] text-clinical-zinc">Save address as *</Label>
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
                        className={`h-9 px-3 rounded-lg border text-xs flex items-center gap-1.5 transition-all font-medium ${
                          active
                            ? "bg-clinical-gold/10 border-clinical-gold text-clinical-gold"
                            : "bg-clinical-dark border-clinical-border text-clinical-zinc hover:border-white/20"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                {addressType === "other" && (
                  <Input
                    placeholder="e.g. Parents, Gym, Friends House"
                    value={otherLabel}
                    onChange={(e) => setOtherLabel(e.target.value)}
                    className="h-9 text-xs bg-clinical-dark border-clinical-border mt-2"
                  />
                )}
              </div>

              {/* Flat/House number */}
              <div className="space-y-1">
                <Label className="text-[11px] text-clinical-zinc">Flat / House no / Building name *</Label>
                <Input
                  value={flatNo}
                  onChange={(e) => setFlatNo(e.target.value)}
                  className="h-9 text-xs bg-clinical-dark border-clinical-border"
                />
              </div>

              {/* Floor (optional) */}
              <div className="space-y-1">
                <Label className="text-[11px] text-clinical-zinc">Floor (optional)</Label>
                <Input
                  placeholder="Floor (optional)"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  className="h-9 text-xs bg-clinical-dark border-clinical-border"
                />
              </div>

              {/* Area / Sector / Locality */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] text-clinical-zinc">Area / Sector / Locality *</Label>
                  <button
                    type="button"
                    onClick={() => setStep("map")}
                    className="text-[11px] text-clinical-gold hover:underline flex items-center gap-1 font-medium"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Pick on Map
                  </button>
                </div>
                <Input
                  placeholder="e.g. Sector 62, Noida"
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
                  className="h-9 text-xs bg-clinical-dark border-clinical-border text-white"
                />
              </div>

              {/* City + PIN — editable so a failed geocode is never a dead
                  end, with live serviceability feedback on the PIN. */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-clinical-zinc">City *</Label>
                  <Input
                    placeholder="Noida"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="h-9 text-xs bg-clinical-dark border-clinical-border"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-clinical-zinc">PIN code *</Label>
                  <Input
                    placeholder="201301"
                    inputMode="numeric"
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                    className={cn(
                      "h-9 text-xs bg-clinical-dark border-clinical-border",
                      pinCheck.state === "unserviceable" && "border-orange-400/60",
                      pinCheck.state === "serviceable" && "border-clinical-sage/60",
                    )}
                  />
                </div>
              </div>
              {pinCheck.state === "serviceable" && (
                <p className="flex items-center gap-1.5 text-[11px] text-clinical-sage -mt-2">
                  <CheckCircle className="w-3.5 h-3.5" weight="fill" />
                  We deliver here — {pinCheck.info.area}
                </p>
              )}
              {pinCheck.state === "unserviceable" && (
                <p className="flex items-center gap-1.5 text-[11px] text-orange-300 -mt-2">
                  <Warning className="w-3.5 h-3.5" weight="fill" />
                  We don't deliver to {pincode} yet — Noida, Greater Noida & parts of East Delhi only.
                </p>
              )}

              {/* Landmark (optional) */}
              <div className="space-y-1">
                <Label className="text-[11px] text-clinical-zinc">Nearby landmark (optional)</Label>
                <Input
                  placeholder="Nearby landmark (optional)"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  className="h-9 text-xs bg-clinical-dark border-clinical-border"
                />
              </div>

              {/* Someone Else Details */}
              {orderingFor === "someone" && (
                <div className="space-y-3 pt-2 border-t border-clinical-border animate-in fade-in duration-200">
                  <p className="text-[11px] font-semibold text-clinical-zinc">Enter details for seamless delivery experience</p>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-clinical-zinc">Recipient's name *</Label>
                    <Input
                      placeholder="Recipient's Name"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="h-9 text-xs bg-clinical-dark border-clinical-border"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-clinical-zinc">Recipient's phone number *</Label>
                    <Input
                      placeholder="e.g. +91 98765 43210"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      className="h-9 text-xs bg-clinical-dark border-clinical-border"
                    />
                  </div>
                </div>
              )}

            </div>

            <div className="p-4 border-t border-clinical-border bg-clinical-surface mt-auto">
              <Button
                onClick={handleSaveAddress}
                disabled={saving}
                className="w-full h-11 bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90 font-semibold text-sm"
              >
                {saving ? "Saving..." : "Save address"}
              </Button>
            </div>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
