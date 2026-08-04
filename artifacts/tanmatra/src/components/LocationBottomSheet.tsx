import React, { useState } from "react";
import { LocationService, DeliveryLocation } from "../services/LocationService";
import { PrimaryCTA } from "./CTA";

interface LocationBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationUpdated: (location: DeliveryLocation) => void;
}

export const LocationBottomSheet: React.FC<LocationBottomSheetProps> = ({
  isOpen,
  onClose,
  onLocationUpdated,
}) => {
  const [pincodeInput, setPincodeInput] = useState("");
  const [result, setResult] = useState<DeliveryLocation | null>(null);

  if (!isOpen) return null;

  const handleCheck = () => {
    if (!pincodeInput.trim()) return;
    const loc = LocationService.checkServiceability(pincodeInput);
    setResult(loc);
    if (loc.isServiceable) {
      onLocationUpdated(loc);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-lg bg-slate-900 border-t border-slate-800 rounded-t-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-100">Set Delivery Location</h3>
            <p className="text-xs text-slate-400">Check serviceability for therapeutic meal dispatch</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-200 min-h-[44px] min-w-[44px] flex items-center justify-center">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-2 tracking-wider">
              Pincode / Postal Code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. 560034"
                value={pincodeInput}
                onChange={(e) => setPincodeInput(e.target.value)}
                className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
              <PrimaryCTA onClick={handleCheck}>
                Check
              </PrimaryCTA>
            </div>
          </div>

          {result && (
            <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-3 ${
              result.isServiceable 
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full ${result.isServiceable ? "bg-emerald-400" : "bg-rose-400"}`} />
              <div>
                <p className="font-bold">{result.isServiceable ? `Serviceable: ${result.city}` : "Location Unserviceable"}</p>
                <p className="font-normal opacity-80 mt-0.5">
                  {result.isServiceable 
                    ? `Estimated dispatch window: ${result.estimatedDeliveryTimeMinutes} mins`
                    : "Tanmatra is currently expanding to this zone."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
