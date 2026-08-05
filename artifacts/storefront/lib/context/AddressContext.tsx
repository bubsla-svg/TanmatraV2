"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface Address {
  id: string;
  street: string;
  city: string;
  pincode: string;
  isDeliverable: boolean;
}

interface AddressContextType {
  selectedAddress: Address | null;
  setAddress: (address: Address) => void;
  openLocationSheet: () => void;
}

const AddressContext = createContext<AddressContextType | undefined>(undefined);

export function SharedAddressProvider({ children }: { children: React.ReactNode }) {
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [isSheetOpen, setSheetOpen] = useState(false);

  // Simplified context provider
  return (
    <AddressContext.Provider value={{
      selectedAddress,
      setAddress: setSelectedAddress,
      openLocationSheet: () => setSheetOpen(true)
    }}>
      {children}
      {isSheetOpen && (
        <LocationBottomSheet onClose={() => setSheetOpen(false)} />
      )}
    </AddressContext.Provider>
  );
}

export function useAddress() {
  const context = useContext(AddressContext);
  if (!context) throw new Error("useAddress must be used within a SharedAddressProvider");
  return context;
}

// Inline definition to satisfy dependencies for scaffolding, 
// normally this would be in components/location/LocationBottomSheet.tsx
function LocationBottomSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#171717] w-full rounded-t-3xl border-t border-white/10 p-6">
        <h2 className="text-xl font-bold text-[#F5F5F4] mb-4">Select Delivery Location</h2>
        <p className="text-[#A3A3A3]">This is the single source of truth for location across the app.</p>
        <button onClick={onClose} className="mt-6 w-full px-8 py-4 rounded-full bg-[#D4AF37] text-[#111318] font-bold">
          Confirm Location
        </button>
      </div>
    </div>
  );
}
