import Link from "next/link";
import { Rail } from "@/components/primitives/Rail";

type Tab =
  | "subscriptions"
  | "orders"
  | "billing"
  | "addresses"
  | "preferences"
  | "health"
  | "connections"
  | "loyalty"
  | "appointments"
  | "symptoms"
  | "history";

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
    <Rail as="nav" snap="none" aria-label="Account" className="mb-6 gap-5 border-b border-line">
      {link("/account/subscriptions", "subscriptions", "Plans")}
      {link("/account/orders", "orders", "Orders")}
      {link("/account/appointments", "appointments", "Consults")}
      {link("/account/billing", "billing", "Billing")}
      {link("/account/addresses", "addresses", "Addresses")}
      {link("/account/preferences", "preferences", "Preferences")}
      {link("/account/health-information", "health", "Health")}
      {link("/account/connections", "connections", "Connections")}
      {link("/account/loyalty", "loyalty", "Rewards")}
      {link("/account/symptoms", "symptoms", "Symptoms")}
      {link("/account/history", "history", "History")}
    </Rail>
  );
}
