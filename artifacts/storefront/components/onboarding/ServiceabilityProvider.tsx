"use client";
// Client: the one shared copy of the delivery-location verdict.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  clearServiceabilityState,
  loadServiceabilityState,
  saveServiceabilityState,
  SERVICEABILITY_EVENT,
  type ServiceabilityState,
} from "@/lib/serviceabilityApi";

interface ServiceabilityContextValue {
  state: ServiceabilityState;
  /** True once localStorage has been read — before that, "unknown" is only
   *  the server render's placeholder, not the customer's answer. */
  hydrated: boolean;
  set: (next: ServiceabilityState) => void;
  clear: () => void;
}

const ServiceabilityContext = createContext<ServiceabilityContextValue | null>(null);
const UNKNOWN: ServiceabilityState = { verdict: "unknown", pincode: "" };

/**
 * T5 (CRO handoff 2026-09-17): "Set location" is a real gate now, and a gate
 * has to be answered in one place and honoured everywhere — the header pill,
 * every Add button, the cart's Checkout and the first-visit banner. Before
 * this each widget read localStorage once at mount and never heard another
 * widget's answer (ServiceabilityBar's own header comment records the bug).
 *
 * The provider is the reader; the WRITERS stay where they are
 * (saveServiceabilityState / clearServiceabilityState in lib), because the
 * QR landing, the plan gate and the location picker already call them — they
 * broadcast a window event and this subscribes to it. Mounted once, at the
 * root, inside CartProvider.
 */
export function ServiceabilityProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ServiceabilityState>(UNKNOWN);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(loadServiceabilityState());
    setHydrated(true);
    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent<ServiceabilityState>).detail;
      if (detail && typeof detail.verdict === "string") setState(detail);
    };
    window.addEventListener(SERVICEABILITY_EVENT, onEvent);
    return () => window.removeEventListener(SERVICEABILITY_EVENT, onEvent);
  }, []);

  const set = useCallback((next: ServiceabilityState) => saveServiceabilityState(next), []);
  const clear = useCallback(() => clearServiceabilityState(), []);

  return (
    <ServiceabilityContext.Provider value={{ state, hydrated, set, clear }}>
      {children}
    </ServiceabilityContext.Provider>
  );
}

/** The shared verdict. Outside the provider (a test render, a stray island)
 *  it degrades to "unknown" rather than throwing — a location gate must never
 *  take a page down. */
export function useServiceability(): ServiceabilityContextValue {
  const ctx = useContext(ServiceabilityContext);
  return ctx ?? { state: UNKNOWN, hydrated: false, set: saveServiceabilityState, clear: clearServiceabilityState };
}

/** True only for a customer whose PIN we have checked and do NOT serve. An
 *  unknown verdict is never treated as a refusal. */
export function useOutOfZone(): boolean {
  const { state } = useServiceability();
  return state.verdict === "unserviceable";
}
