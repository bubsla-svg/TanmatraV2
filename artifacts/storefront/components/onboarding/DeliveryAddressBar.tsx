"use client"; // Justification: reads the session-scoped address list, holds the active-address choice, and owns the switcher sheet.
import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { getAddresses, type Address } from "@/lib/api";
import {
  pickActiveAddress,
  formatDeliveryLabel,
  loadActiveAddressId,
  saveActiveAddressId,
} from "@/lib/activeAddress";
import {
  deriveDeliveryState,
  isCheckablePincode,
  mirroredVerdict,
} from "@/lib/addressServiceability";
import { checkServiceability, saveServiceabilityState } from "@/lib/serviceabilityApi";
import { useOverlayHistory } from "@/components/ui/useOverlayHistory";
import { ServiceabilityBar } from "./ServiceabilityBar";
import { MarketplaceFallbackCta } from "./MarketplaceFallbackCta";
import Link from "next/link";

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

  // Back gesture closes the address switcher instead of leaving the page.
  useOverlayHistory(switcherOpen, () => setSwitcherOpen(false));

  useEffect(() => {
    setMounted(true);
    setActiveId(loadActiveAddressId());
  }, []);

  // `retry: false` because the expected failure here is a 401, and retrying an
  // unauthenticated read three times just delays the fallback the signed-out
  // visitor is waiting to see.
  //
  // `refetchOnReconnect: false` for the same reason, one layer out. This bar
  // is in the Header, so it mounts on every route: for a signed-out visitor
  // the 401 is the steady state, not a transient failure, and coming back
  // online cannot change it. The default (true) re-fired the request on every
  // network blip and put a second and third red 401 in the console of anyone
  // whose connection wavered, which reads like a bug in a surface that is
  // working exactly as designed.
  //
  // Deliberately scoped to THIS query rather than the QueryProvider default:
  // reconnect-refetch is right for most of what the client cache holds (an
  // order's live status, cart contents, wellness logs), where the answer
  // genuinely may have moved while the tab was offline. It is wrong only where
  // the failure is an auth verdict.
  const { data, isPending, isError } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => getAddresses(),
    retry: false,
    refetchOnReconnect: false,
    staleTime: 60_000,
  });

  const addresses: Address[] = data?.addresses ?? [];
  const active = pickActiveAddress(addresses, activeId);
  const pincode = active?.pincode ?? "";

  // Re-check the SERVICE AREA for whichever address is active. The bar reads
  // as authoritative ("Delivering to: Work (Sector 62)") but nothing re-ran
  // the pincode check when the active address changed, so a saved address
  // outside the service area was announced as deliverable and only failed at
  // checkout. Keyed on the pincode, so switching addresses re-derives; two
  // addresses in one pincode share the cached answer.
  const check = useQuery({
    queryKey: ["serviceability", pincode],
    queryFn: () => checkServiceability(pincode),
    enabled: isCheckablePincode(pincode),
    retry: false,
    staleTime: 5 * 60_000,
  });

  const delivery = deriveDeliveryState({
    pincode,
    isPending: check.isPending,
    isError: check.isError,
    verdict: check.data?.verdict,
  });

  // Mirror a definitive verdict onto the key `ServiceabilityBar` reads, so the
  // two widgets cannot contradict each other after a sign-out. The effect
  // depends on PRIMITIVES, not on `delivery` — that object is rebuilt every
  // render and would re-fire the write on each one.
  const deliveryKind = delivery.kind;
  const mirrorVerdict = mirroredVerdict(delivery)?.verdict ?? null;
  useEffect(() => {
    if (mirrorVerdict !== null) saveServiceabilityState({ verdict: mirrorVerdict, pincode });
  }, [mirrorVerdict, pincode]);

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
        // Same 9rem cap as ServiceabilityBar's MENU_FIT, and the same reason:
        // Astryx's TopNav endContent is flex-shrink:0, so this button's cap is
        // the ONLY thing keeping it from claiming its full ~13rem width and
        // squeezing the wordmark into overflow — see that file's comment for
        // the measured 360px budget this has to fit inside alongside it.
        className="flex min-w-0 max-w-[9rem] items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 text-left text-sm text-ink transition-colors hover:border-line-strong sm:max-w-xs"
      >
        <svg className="h-4 w-4 shrink-0 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.242-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="min-w-0 flex-1 truncate">
          {/* The verb changes with the verdict. Keeping "Delivering to:" over
              an address we do not serve is the claim this whole module exists
              to stop making. */}
          <span className="text-ink-muted">
            {deliveryKind === "undeliverable" ? "Saved: " : "Delivering to: "}
          </span>
          <span className="font-semibold">{formatDeliveryLabel(active)}</span>
        </span>
        {/* Carried by TEXT, not colour alone, and `shrink-0` so the label
            truncates around it rather than the chip wrapping out of the
            header's ~208px slot. The full explanation lives in the sheet this
            button already opens. */}
        {deliveryKind === "undeliverable" && (
          <span className="shrink-0 text-3xs font-bold uppercase tracking-wide text-danger">
            Not served
          </span>
        )}
        <span aria-hidden="true" className="shrink-0 text-ink-muted">▾</span>
      </button>

      {switcherOpen && mounted
        ? createPortal(
            <AddressSwitcherSheet
              addresses={addresses}
              activeId={active.id}
              undeliverablePincode={
                delivery.kind === "undeliverable" ? delivery.pincode : null
              }
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
  undeliverablePincode,
  onChoose,
  onClose,
}: {
  addresses: readonly Address[];
  activeId: string;
  /** Set only when the ACTIVE address is confirmed outside the service area. */
  undeliverablePincode: string | null;
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

  // Focus moves INTO the dialog on open and back to whatever opened it on
  // close. Role and aria-modal were already here; without this the chip that
  // opened the sheet kept focus behind the scrim (2026-09-06 audit).
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-end sm:items-center sm:justify-center">
      <button
        type="button"
        aria-label="Close address switcher"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-[var(--ink)]/40"
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Choose a delivery address"
        className="relative w-full outline-none animate-sheet-in rounded-t-2xl border border-line bg-surface p-5 shadow-[var(--shadow-raised)] sm:max-w-md sm:animate-dialog-in sm:rounded-2xl"
      >
        <h2 className="text-base font-bold text-ink">Deliver to</h2>

        {/* The explanation the header chip is too narrow to carry, with both
            onward routes attached. Picking another saved address is the
            primary way out and it is already the body of this sheet, so this
            block only has to name the problem and offer the second route —
            never a dead end, same rule as the out-of-zone pincode surface. */}
        {undeliverablePincode !== null && (
          <div
            role="status"
            className="mt-3 rounded-2xl bg-secondary p-3.5"
          >
            <p className="text-xs font-semibold leading-snug text-ink">
              We&rsquo;re not in {undeliverablePincode}{" "}
              yet, so we can&rsquo;t deliver hot meals to this address. Pick another saved
              address below &mdash; or browse the marketplace, which ships nationwide.
            </p>
            <MarketplaceFallbackCta />
          </div>
        )}

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
                      ? "border-gold bg-primary/10"
                      : "border-transparent bg-secondary hover:border-line-strong"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{a.label}</span>
                    {/* Selection is carried by text, not colour alone. */}
                    {isActive && <span className="text-xs font-semibold text-accent">Current</span>}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-muted">
                    {[a.line1, a.line2, a.city, a.pincode].filter(Boolean).join(", ")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <Link
          href="/account/addresses"
          className="mt-4 inline-block text-sm font-semibold text-primary hover:underline"
        >
          Manage addresses
        </Link>
      </div>
    </div>
  );
}
