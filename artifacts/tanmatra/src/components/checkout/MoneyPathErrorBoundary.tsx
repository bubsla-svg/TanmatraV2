import { Link, isRouteErrorResponse, useLocation, useRouteError } from "react-router";
import { track } from "@/lib/analytics";
import { useEffect } from "react";

/**
 * Route-level error boundary for the money CUJs (/cart, /checkout,
 * /subscribe, /subscriptions). React Router v7 renders this in place of a
 * route whose render threw — without it, a component crash on the money
 * path white-screens the buyer at the worst possible moment.
 *
 * The reassurance copy is TRUE by construction: the cart is Zustand-
 * persisted (tanmatra:cart:v1) and the checkout/subscribe drafts live in
 * sessionStorage (useWizardState), so a reload genuinely restores state —
 * "Try again" is a real recovery, not a shrug.
 */
export function MoneyPathErrorBoundary() {
  const error = useRouteError();
  const { pathname } = useLocation();

  const status = isRouteErrorResponse(error) ? error.status : undefined;
  const message =
    isRouteErrorResponse(error)
      ? `${error.status} ${error.statusText}`
      : error instanceof Error
        ? error.message
        : "Unknown render error";

  useEffect(() => {
    // Never silent: every boundary hit is an operator-visible event.
    track("money_path_error", {
      surface: pathname,
      status: status ?? 0,
      message: message.slice(0, 160),
    });
  }, [pathname, status, message]);

  return (
    <div className="tnm2 nn min-h-dvh bg-[var(--tnm-surface-ink)] text-white antialiased flex items-center justify-center px-5">
      <div
        role="alert"
        className="w-full max-w-[420px] rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] p-6 flex flex-col gap-4 text-center"
      >
        <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-white/45">
          Something broke on our side
        </p>
        <h1 className="text-lg font-semibold text-white/95">
          This screen hit an error — your cart and any payment are safe.
        </h1>
        <p className="text-sm text-white/60 leading-relaxed">
          Nothing was charged by this error, and your selections are saved on
          this device. Reloading usually fixes it.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn btn-p w-full min-h-[48px] active:scale-[0.98] transition-transform"
          style={{ transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)" }}
        >
          Try again
        </button>
        <Link
          to="/menu"
          className="btn btn-s w-full min-h-[44px] active:scale-[0.98] transition-transform"
          style={{ transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)" }}
        >
          Back to menu
        </Link>
        <a
          href="https://wa.me/919289213115"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-white/45 underline underline-offset-2 min-h-[44px] flex items-center justify-center"
        >
          Still stuck? WhatsApp support
        </a>
      </div>
    </div>
  );
}
