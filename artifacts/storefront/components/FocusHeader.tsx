"use client";
// Client: the back action inspects navigation history.
import { useRouter } from "next/navigation";

/**
 * FocusHeader — the compact route header every FocusLayout flow must carry
 * (UX/UI Architecture Phase 1 §6.7: `<FocusHeader> <BackButton/> <FocusTitle/>
 * <OptionalTrustSignal/> </FocusHeader>`). The focus shell strips ALL global
 * chrome, so without this a high-intent page is a literal dead end — the
 * defect class that shipped twice (PDP, then checkout) before this component
 * existed.
 *
 * BackButton contract, verbatim from the doc: "Left chevron inside 36px touch
 * target. Action: Goes back to previous route if history exists. Fallback
 * Action: Pushes to /".
 */
export function FocusHeader({
  title,
  backLabel = "Back",
  trustSignal,
}: {
  /** Route title (the doc's FocusTitle — e.g. "Checkout"). Rendered as the
   *  page h1; pages using this must not render a second one. Omit ONLY when
   *  the page already renders its own h1 immediately below (e.g. a marketing
   *  hero) — the back button and trust signal still render either way, since
   *  those are the part of this contract that actually prevents a dead end. */
  title?: string;
  /** Accessible + visible label for the back affordance (e.g. "Back to cart"). */
  backLabel?: string;
  /** Optional right-aligned trust microcopy (e.g. "Secure UPI checkout"). */
  trustSignal?: string;
}) {
  const router = useRouter();

  function goBack() {
    // history.length 1 = this tab has nowhere to go back to (deep link /
    // fresh tab) — the doc's fallback is Home, never a dead click.
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  return (
    <header className="mb-5 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          className="-ml-2 inline-flex min-h-9 items-center gap-1 rounded-full px-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0">
            <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {backLabel}
        </button>
        {trustSignal && (
          <span className="text-2xs font-medium uppercase tracking-widest text-ink-faint">
            {trustSignal}
          </span>
        )}
      </div>
      {title && <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>}
    </header>
  );
}
