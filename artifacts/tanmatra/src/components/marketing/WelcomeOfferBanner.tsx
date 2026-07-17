import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Gift, X, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useOrders } from "@/lib/ordersContext";
import { track } from "@/lib/analytics";
import { loyaltyApi } from "@/lib/loyaltyApi";
import { formatPrice } from "@/lib/api/adapter";

/**
 * First-order welcome banner.
 *
 * Surfaces the first-order offer (flat 25% off, capped at the configured cap) to
 * visitors with no order history. No code to type: the discount is
 * auto-applied server-side by loyaltyEngine.finalizeOrder, which is
 * the single source of truth for eligibility and the amount. This
 * banner is display-only.
 */

const DISMISS_KEY = "tanmatra:welcome-banner-dismissed-at:v1";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isDismissed(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  return Number.isFinite(ts) && Date.now() - ts < DISMISS_TTL_MS;
}

export default function WelcomeOfferBanner() {
  const { orders } = useOrders();
  const [visible, setVisible] = useState(false);

  const { data: offer } = useQuery({
    queryKey: ["firstOrderOffer"],
    queryFn: loyaltyApi.getFirstOrderOffer,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (orders.length > 0) {
      setVisible(false);
      return;
    }
    const show = !isDismissed();
    setVisible(show);
    if (show) track("first_order_offer_shown");
  }, [orders.length]);

  const eligible = offer ? offer.eligible : true;
  if (!visible || !eligible) return null;

  const percent = offer ? offer.percentBps / 100 : 25;
  const capFormatted = offer ? formatPrice(offer.capPaise) : formatPrice(8000);
  const offerLabel = `flat ${percent}% off (up to ${capFormatted})`;

  const dismiss = () => {
    setVisible(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
  };

  return (
    <div className="relative bg-gradient-to-r from-nn-primary/15 via-nn-primary/10 to-clinical-sage/10 border-b border-nn-primary/30">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs">
        <Gift className="w-4 h-4 text-nn-primary shrink-0" aria-hidden />
        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-semibold text-white">
            First order?{" "}
            <span className="text-nn-primary">{offerLabel}</span>
          </span>
          <span className="text-nn-on-surface-variant hidden sm:inline">
            · auto-applied at checkout, no code needed
          </span>
        </div>
        <Link
          to={`/menu`}
          className="hidden sm:inline-flex items-center gap-1 text-nn-primary hover:text-white font-semibold whitespace-nowrap min-h-9"
        >
          Browse menu <ArrowRight className="w-3 h-3" />
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss welcome offer"
          className="shrink-0 w-9 h-9 -mr-2 rounded-md text-nn-on-surface-variant hover:text-white hover:bg-white/5 flex items-center justify-center"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
