import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MapPin, Target, MagnifyingGlass, House, Buildings, Notepad, ArrowLeft, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { API_BASE } from "@/lib/apiBase";
import { checkPincode } from "@/lib/serviceablePincodes";

interface LocationPickerFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (addressData: any) => Promise<void>;
  initialData?: any;
}

export function LocationPickerFlow({ open, onOpenChange, onSave, initialData }: LocationPickerFlowProps) {
  const [step, setStep] = useState<"prompt" | "map" | "details">("prompt");
  
  // Geolocation / Geocoding states
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: 19.0760, lng: 72.8777 }); // Mumbai
  const [locality, setLocality] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  
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
  const mapRef = useRef<any>(null);
  const autocompleteRef = useRef<any>(null);
  const isDraggingRef = useRef(false);

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
      // Reset form states
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
  }, [open, initialData]);

  // Map Initializer
  useEffect(() => {
    if (step === "map" && mapDivRef.current && !mapRef.current) {
      if (typeof window !== "undefined" && (window as any).google?.maps) {
        const map = new (window as any).google.maps.Map(mapDivRef.current, {
          center: coords,
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: false,
        });

        // Trigger geocode on drag end
        map.addListener("dragstart", () => {
          isDraggingRef.current = true;
        });

        map.addListener("idle", () => {
          if (!isDraggingRef.current) return;
          isDraggingRef.current = false;
          const center = map.getCenter();
          if (center) {
            const newCoords = { lat: center.lat(), lng: center.lng() };
            setCoords(newCoords);
            reverseGeocode(newCoords.lat, newCoords.lng);
          }
        });

        mapRef.current = map;
        reverseGeocode(coords.lat, coords.lng);
      }
    }
    
    // Clean up when leaving map step
    if (step !== "map") {
      mapRef.current = null;
    }
  }, [step]);

  // Bind Autocomplete search input
  const searchInputRefCallback = (el: HTMLInputElement | null) => {
    if (el && !autocompleteRef.current) {
      if (typeof window !== "undefined" && (window as any).google?.maps?.places) {
        const autocomplete = new (window as any).google.maps.places.Autocomplete(el, {
          componentRestrictions: { country: "in" },
          fields: ["geometry", "formatted_address", "address_components"],
        });
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (place.geometry?.location && mapRef.current) {
            const loc = place.geometry.location;
            mapRef.current.setCenter(loc);
            mapRef.current.setZoom(16);
            setCoords({ lat: loc.lat(), lng: loc.lng() });
            
            // Extract components
            parseAddressComponents(place.address_components || []);
            setLocality(place.formatted_address || "");
          }
        });
        autocompleteRef.current = autocomplete;
      }
    } else if (!el) {
      autocompleteRef.current = null;
    }
  };

  const reverseGeocode = (lat: number, lng: number) => {
    if (typeof window !== "undefined" && (window as any).google?.maps?.Geocoder) {
      const geocoder = new (window as any).google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
        if (status === "OK" && results[0]) {
          const place = results[0];
          parseAddressComponents(place.address_components);
          setLocality(place.formatted_address);
        }
      });
    }
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

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newCoords = { lat: latitude, lng: longitude };
        setCoords(newCoords);
        if (mapRef.current) {
          mapRef.current.setCenter(newCoords);
          mapRef.current.setZoom(16);
        }
        reverseGeocode(latitude, longitude);
        setStep("map");
      },
      (error) => {
        console.error(error);
        toast.error("Could not get current location: " + error.message);
      }
    );
  };

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
    if (!pincode.trim()) {
      toast.error("Pincode could not be resolved from this location. Please search for your area.");
      return;
    }
    const pinCheck = checkPincode(pincode.trim());
    if (pinCheck.state === "unserviceable") {
      toast.error(`We do not deliver to pincode ${pincode} yet. We are expanding rapidly across Noida NCR!`);
      return;
    }

    setSaving(true);
    try {
      // Structure the final fields to match database schema
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
        city: city || "Noida",
        pincode: pincode || "201301",
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
      <DialogContent className="p-0 bg-clinical-surface border-clinical-border max-w-lg h-[90vh] sm:h-[80vh] flex flex-col overflow-hidden">
        
        {/* STEP 1: Initial Prompt */}
        {step === "prompt" && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
            <div className="w-24 h-24 rounded-full bg-clinical-gold/10 flex items-center justify-center border border-clinical-gold/20">
              <MapPin className="w-12 h-12 text-clinical-gold" weight="fill" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-serif font-semibold text-white">Where do you want us to deliver this order?</h3>
              <p className="text-xs text-clinical-zinc">This will help us find the nearest store for you</p>
            </div>
            <div className="w-full space-y-3">
              <Button
                variant="outline"
                onClick={() => setStep("map")}
                className="w-full h-11 border-clinical-border text-white hover:bg-white/5 font-semibold text-sm"
              >
                Away from my location
              </Button>
              <Button
                onClick={handleUseCurrentLocation}
                className="w-full h-11 bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90 font-semibold text-sm gap-2"
              >
                <Target className="w-4 h-4" weight="bold" />
                Use current location
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
                  ref={searchInputRefCallback}
                  type="text"
                  placeholder="Search for a new area, locality..."
                  className="w-full h-10 pl-9 pr-4 rounded-lg bg-clinical-surface/85 backdrop-blur-sm border border-clinical-border text-white text-xs placeholder:text-clinical-zinc focus:outline-none focus:ring-2 focus:ring-clinical-gold/50"
                />
              </div>
            </div>

            {/* Google Map Container */}
            <div ref={mapDivRef} className="flex-1 w-full bg-clinical-dark relative">
              {/* Fixed Center Pin */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[100%] z-10 pointer-events-none flex flex-col items-center">
                <div className="bg-black/80 text-[10px] text-white px-2 py-1 rounded shadow-md mb-2 animate-bounce border border-clinical-border font-semibold">
                  Move the pin to adjust your location
                </div>
                <div className="w-8 h-8 rounded-full bg-clinical-gold/25 flex items-center justify-center border border-clinical-gold/50 animate-pulse absolute -bottom-1"></div>
                <MapPin className="w-10 h-10 text-clinical-gold relative z-20 drop-shadow-lg" weight="fill" />
              </div>
            </div>

            {/* Bottom Preview Card */}
            <div className="bg-clinical-surface border-t border-clinical-border p-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-md bg-clinical-gold/10 border border-clinical-gold/20 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-clinical-gold" weight="bold" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-semibold text-white truncate">Delivering your order to</p>
                  <p className="text-[11px] text-clinical-zinc mt-0.5 line-clamp-2">
                    {locality || "Locating..."}
                  </p>
                </div>
              </div>
              
              <Button
                onClick={() => setStep("details")}
                disabled={!locality}
                className="w-full h-11 bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90 font-semibold text-sm"
              >
                Add more address details
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
                onClick={() => setStep("map")}
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
                  placeholder="e.g. Flat 403, Block B, Silver Oak Apartments"
                  value={flatNo}
                  onChange={(e) => setFlatNo(e.target.value)}
                  className="h-9 text-xs bg-clinical-dark border-clinical-border"
                />
              </div>

              {/* Floor (optional) */}
              <div className="space-y-1">
                <Label className="text-[11px] text-clinical-zinc">Floor (optional)</Label>
                <Input
                  placeholder="e.g. 4th floor"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  className="h-9 text-xs bg-clinical-dark border-clinical-border"
                />
              </div>

              {/* Area / Sector / Locality */}
              <div className="space-y-1">
                <Label className="text-[11px] text-clinical-zinc">Area / Sector / Locality *</Label>
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
              </div>

              {/* Landmark (optional) */}
              <div className="space-y-1">
                <Label className="text-[11px] text-clinical-zinc">Nearby landmark (optional)</Label>
                <Input
                  placeholder="e.g. Near Mother Dairy booth"
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
