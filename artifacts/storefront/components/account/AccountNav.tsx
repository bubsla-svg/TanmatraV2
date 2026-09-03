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
      className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors ${
        active === key ? "border-gold bg-primary/10 text-primary" : "border-transparent bg-secondary text-ink-muted hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <Rail as="nav" snap="none" aria-label="Account" className="mb-6 gap-2 py-1">
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
