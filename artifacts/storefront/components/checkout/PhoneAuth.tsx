"use client";

import React from "react";

export interface PhoneAuthProps {
  startExpanded?: boolean;
  onVerified?: () => void;
}

export function PhoneAuth({ startExpanded, onVerified }: PhoneAuthProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">Phone Auth Placeholder</p>
      <button 
        type="button"
        onClick={onVerified}
        className="px-4 py-2 bg-[#D4AF37] text-[#0A0A0A] rounded-full font-semibold"
      >
        Simulate Verified
      </button>
    </div>
  );
}
