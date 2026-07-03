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

// ── Google Maps readiness ──────────────────────────────────────────────
// The maps <script> loads async in root.tsx. If the user opens the picker
// before it arrives, the old code rendered a permanently blank map with a
// dead search box (the init effect never re-ran). Poll until ready, and
// surface an explicit manual-entry fallback if it never comes (missing
// key, blocked network).
function waitForGoogleMaps(timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (typeof window !== "undefined" && (window as any).google?.maps?.Geocoder) {
        resolve(true);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        resolve(false);
        return;
      }
      setTimeout(tick, 250);
    };
    tick();
  });
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
  // Places Autocomplete is unavailable on Google Maps keys created after
  // March 2025 (its constructor THROWS "not available to new customers").
  // When that happens we fall back to Enter-to-search via the Geocoder,
  // which every key supports.
  const [plainSearch, setPlainSearch] = useState(false);

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
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<any>(null);
  const autocompleteRef = useRef<any>(null);
  // Last coords we reverse-geocoded — dedupes idle events (zoom, tiny pans,
  // programmatic recenters after a search already handled elsewhere).
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
    }
  }, [open, initialData]);

  // Wait for the maps script as soon as the dialog opens so the map step
  // is instant by the time the user reaches it.
  useEffect(() => {
    if (!open || mapsReady || mapsFailed) return;
    let cancelled = false;
    waitForGoogleMaps(10_000).then((ok) => {
      if (cancelled) return;
      setMapsReady(ok);
      setMapsFailed(!ok);
    });
    return () => {
      cancelled = true;
    };
  }, [open, mapsReady, mapsFailed]);

  // Map + autocomplete initializer — runs when the map step is visible AND
  // the script is ready (fixes the blank-map race).
  useEffect(() => {
    if (step !== "map" || !mapsReady) {
      if (step !== "map") {
        mapRef.current = null;
        autocompleteRef.current = null;
      }
      return;
    }
    if (!mapDivRef.current || mapRef.current) return;

    const g = (window as any).google;
    // NOTHING in here may throw uncaught — an effect throw unmounts the
    // whole page into the root ErrorBoundary ("Something went wrong").
    try {
      const map = new g.maps.Map(mapDivRef.current, {
        center: coords,
        zoom: 15,
        disableDefaultUI: true,
        zoomControl: false,
        gestureHandling: "greedy",
      });

      // Re-geocode on ANY settled movement (drag, pinch-zoom, double-tap —
      // the old dragstart-gated version left a stale address after zooms).
      map.addListener("idle", () => {
        try {
          const center = map.getCenter();
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
        } catch {
          // never let a map event take down the page
        }
      });

      mapRef.current = map;
      reverseGeocode(coords.lat, coords.lng);
    } catch (err) {
      console.error("[address-picker] map init failed", err);
      setMapsReady(false);
      setMapsFailed(true);
      return;
    }

    // Autocomplete binds here (not in a ref callback) so it works even
    // when the input mounted before the script finished loading. Its
    // constructor THROWS on keys created after Mar 2025 ("not available
    // to new customers") — degrade to Enter-to-search, never crash.
    if (searchInputRef.current && !autocompleteRef.current && g.maps.places) {
      try {
        const autocomplete = new g.maps.places.Autocomplete(searchInputRef.current, {
          componentRestrictions: { country: "in" },
          fields: ["geometry", "formatted_address", "address_components"],
        });
        autocomplete.addListener("place_changed", () => {
          try {
            const place = autocomplete.getPlace();
            if (place.geometry?.location && mapRef.current) {
              const loc = place.geometry.location;
              const next = { lat: loc.lat(), lng: loc.lng() };
              lastGeocodedRef.current = next;
              mapRef.current.setCenter(loc);
              mapRef.current.setZoom(16);
              setCoords(next);
              parseAddressComponents(place.address_components || []);
              setLocality(place.formatted_address || "");
            }
          } catch {
            // ignore malformed place payloads
          }
        });
        autocompleteRef.current = autocomplete;
      } catch (err) {
        console.warn("[address-picker] Places Autocomplete unavailable — using Enter-to-search", err);
        setPlainSearch(true);
      }
    } else if (!g.maps.places) {
      setPlainSearch(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, mapsReady]);

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
                onClick={() => setStep(mapsFailed ? "details" : "map")}
                className="w-full h-11 border-clinical-border text-white hover:bg-white/5 font-semibold text-sm"
              >
                Enter address manually
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Map Selector */}
        {step === "map" && (
          <div className="flex-1 flex flex-col relative">
            <div className="absolute top-4 inset-x-4 z-10 flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setStep("prompt")}
                className="h-10 w-10 bg-clinical-surface/85 backdrop-blur-sm border border-clinical-border rounded-lg text-white hover:bg-clinical-surface"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="relative flex-1">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-clinical-zinc" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={plainSearch ? "Type your area and press Enter…" : "Search area, sector, locality…"}
                  onKeyDown={(e) => {
                    if (plainSearch && e.key === "Enter") {
                      e.preventDefault();
                      handlePlainSearch((e.target as HTMLInputElement).value);
                    }
                  }}
                  disabled={!mapsReady}
                  className="w-full h-10 pl-9 pr-4 rounded-lg bg-clinical-surface/85 backdrop-blur-sm border border-clinical-border text-white text-xs placeholder:text-clinical-zinc focus:outline-none focus:ring-2 focus:ring-clinical-gold/50 disabled:opacity-60"
                />
              </div>
            </div>

            {/* Google Map Container */}
            <div ref={mapDivRef} className="flex-1 w-full bg-clinical-dark relative">
              {/* Script still loading / failed states */}
              {!mapsReady && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-clinical-dark">
                  {!mapsFailed ? (
                    <>
                      <CircleNotch className="w-7 h-7 text-clinical-gold animate-spin" />
                      <p className="text-xs text-clinical-zinc">Loading map…</p>
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

              {/* Locating chip while GPS resolves — the map stays usable. */}
              {locating && mapsReady && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-black/80 border border-clinical-border rounded-full px-3 py-1.5">
                  <CircleNotch className="w-3.5 h-3.5 text-clinical-gold animate-spin" />
                  <span className="text-[11px] text-white">Finding you…</span>
                </div>
              )}

              {/* Fixed Center Pin */}
              {mapsReady && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[100%] z-10 pointer-events-none flex flex-col items-center">
                  <div className="bg-black/80 text-[10px] text-white px-2 py-1 rounded shadow-md mb-2 border border-clinical-border font-semibold">
                    Move the map to position the pin
                  </div>
                  <div className="w-8 h-8 rounded-full bg-clinical-gold/25 flex items-center justify-center border border-clinical-gold/50 animate-pulse absolute -bottom-1"></div>
                  <MapPin className="w-10 h-10 text-clinical-gold relative z-20 drop-shadow-lg" weight="fill" />
                </div>
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
                <Label className="text-[11px] text-clinical-zinc">Area / Sector / Locality *</Label>
                {mapsFailed ? (
                  // Manual fallback when the map never loaded — an editable
                  // field instead of a read-only dead end.
                  <Input
                    placeholder="e.g. Sector 62, Noida"
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                    className="h-9 text-xs bg-clinical-dark border-clinical-border"
                  />
                ) : (
                  <div className="flex gap-2 p-3 bg-clinical-dark rounded-lg border border-clinical-border">
                    <div className="flex-1 text-xs text-white truncate pr-2">
                      {locality || "No location selected"}
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep("map")}
                      className="text-xs text-clinical-gold hover:underline font-semibold"
                    >
                      Change
                    </button>
                  </div>
                )}
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
