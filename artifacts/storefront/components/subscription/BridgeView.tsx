"use client";
// Client: interactive conversion bridge for 3-day trial pack graduates.
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export function BridgeView() {
  const searchParams = useSearchParams();
  const subscriptionId = searchParams.get("subscription_id");

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-line bg-surface p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
            Trial Complete &mdash; Step Up
          </span>
          {subscriptionId && (
            <span className="text-xs text-ink-muted">Ref: #{subscriptionId}</span>
          )}
        </div>
        <h2 className="text-xl font-semibold text-ink">
          Your ₹399 Trial Credit is Reserved
        </h2>
        <p className="text-sm leading-relaxed text-ink-muted">
          You have successfully experienced our clinical culinary standards. When you activate your monthly or fortnightly meal subscription today, your full trial payment of ₹399 will automatically be credited against your very first bill.
        </p>
      </div>

      <div className="rounded-xl border border-line bg-surface p-5 flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-ink">What unlocks with your full subscription</h3>
        <ul className="flex flex-col gap-2.5 text-sm text-ink-muted">
          <li className="flex items-start gap-2">
            <span className="text-gold-text font-bold">&check;</span>
            <span>Dedicated Registered Dietitian consultation & weekly meal schedule oversight.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gold-text font-bold">&check;</span>
            <span>Flexible pause and calendar skipping up to 24 hours before delivery.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gold-text font-bold">&check;</span>
            <span>Strict macro calorie targets and medical condition contraindication gates.</span>
          </li>
        </ul>

        <Link
          href="/plans"
          className="mt-2 flex w-full items-center justify-center rounded-xl bg-gold py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-gold/90 transition-colors"
        >
          Explore Dietitian Meal Plans &mdash; Claim ₹399 Credit
        </Link>
      </div>
    </div>
  );
}
