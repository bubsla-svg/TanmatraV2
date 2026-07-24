import Link from "next/link";

type Tab = "subscriptions" | "orders" | "billing" | "addresses" | "preferences" | "health" | "loyalty";

/**
 * Account section tabs. Server component (no client JS) — each page passes its
 * own `active` tab. Extend here as account surfaces land.
 */
export function AccountNav({ active }: { active: Tab }) {
  const link = (href: string, key: Tab, label: string) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium ${
        active === key ? "border-gold text-ink" : "border-transparent text-ink-muted hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Account" className="mb-6 flex gap-5 overflow-x-auto border-b border-line">
      {link("/account/subscriptions", "subscriptions", "Plans")}
      {link("/account/orders", "orders", "Orders")}
      {link("/account/billing", "billing", "Billing")}
      {link("/account/addresses", "addresses", "Addresses")}
      {link("/account/preferences", "preferences", "Preferences")}
      {link("/account/health-information", "health", "Health")}
      {link("/account/loyalty", "loyalty", "Rewards")}
    </nav>
  );
}
