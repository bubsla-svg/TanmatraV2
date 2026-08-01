"use client"; // Justification: reads the session-scoped address list, holds the active-address choice, and owns the switcher sheet.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { getAddresses, type Address } from "@/lib/api";
import {
  pickActiveAddress,
  formatDeliveryLabel,
  loadActiveAddressId,
  saveActiveAddressId,
} from "@/lib/activeAddress";
import { ServiceabilityBar } from "./ServiceabilityBar";

/**
 * Ambient delivery-address bar — Vector 3 of the location-onboarding brief.
 *
 * ISLAND, NOT A GATE. It tries `getAddresses()` and, on a 401 or an empty
 * list, renders the existing `ServiceabilityBar` untouched. A signed-out
 * visitor therefore sees exactly what they saw before: the pincode/location
 * picker, never a redirect to `/login`. That is the repo's standing rule for
 * auth-gated surfaces and it is NOT among the DS-0 revocations.
 *
 * It also preserves ServiceabilityBar's "exactly one instance per page"
 * invariant: this component renders it conditionally, in the one slot the
 * Header already owned, rather than adding a second copy that would learn its
 * own verdict and disagree with the first.
 */
export function DeliveryAddressBar() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setActiveId(loadActiveAddressId());
  }, []);

  // `retry: false` because the expected failure here is a 401, and retrying an
  // unauthenticated read three times just delays the fallback the signed-out
  // visitor is waiting to see.
  const { data, isPending, isError } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => getAddresses(),
    retry: false,
    staleTime: 60_000,
  });

  const addresses: Address[] = data?.addresses ?? [];
  const active = pickActiveAddress(addresses, activeId);

  // Signed out, errored, still loading, or signed in with nothing saved yet —
  // all four are the same answer: there is no address to be ambient about.
  if (isPending || isError || active === null) {
    return <ServiceabilityBar placement="menu" />;
  }

  function choose(id: string): void {
    setActiveId(id);
    saveActiveAddressId(id);
    setSwitcherOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setSwitcherOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={switcherOpen}
        className="flex min-w-0 max-w-[13rem] items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-left text-sm text-ink shadow-sm transition-colors hover:border-line-strong sm:max-w-xs"
      >
        <svg className="h-4 w-4 shrink-0 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.242-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="min-w-0 flex-1 truncate">
          <span className="text-ink-muted">Delivering to: </span>
          <span className="font-semibold">{formatDeliveryLabel(active)}</span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-ink-muted">▾</span>
      </button>

      {switcherOpen && mounted
        ? createPortal(
            <AddressSwitcherSheet
              addresses={addresses}
              activeId={active.id}
              onChoose={choose}
              onClose={() => setSwitcherOpen(false)}
            />,
            document.body,
          )
        : null}
    </>
  );
}

/**
 * Portalled to `document.body` for the same reason `LocationPickerFlow` is,
 * and that file's header documents it in full: the Header is `sticky` with a
 * `backdrop-blur`, and BOTH of those open a stacking context. A `fixed` child
 * cannot escape one — its z-index resolves inside the header's context, so the
 * bottom nav paints straight over the sheet on a phone.
 */
function AddressSwitcherSheet({
  addresses,
  activeId,
  onChoose,
  onClose,
}: {
  addresses: readonly Address[];
  activeId: string;
  onChoose: (id: string) => void;
  onClose: () => void;
}) {
  // Escape closes, matching every other dismissible surface in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-end sm:items-center sm:justify-center">
      <button
        type="button"
        aria-label="Close address switcher"
        onClick={onClose}
        className="absolute inset-0 bg-[var(--ink)]/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a delivery address"
        className="relative w-full rounded-t-3xl border border-line bg-surface p-5 shadow-2xl sm:max-w-md sm:rounded-3xl"
      >
        <h2 className="text-base font-bold text-ink">Deliver to</h2>
        <ul className="mt-4 flex flex-col gap-2">
          {addresses.map((a) => {
            const isActive = a.id === activeId;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => onChoose(a.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                    isActive
                      ? "border-gold bg-surface-raised"
                      : "border-line bg-bg hover:border-line-strong"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{a.label}</span>
                    {/* Selection is carried by text, not colour alone. */}
                    {isActive && <span className="text-xs font-semibold text-gold-text">Current</span>}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-muted">
                    {[a.line1, a.line2, a.city, a.pincode].filter(Boolean).join(", ")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <a
          href="/account/addresses"
          className="mt-4 inline-block text-sm font-semibold text-gold-text hover:underline"
        >
          Manage addresses
        </a>
      </div>
    </div>
  );
}
