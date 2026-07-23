import Link from "next/link";

type Tab = "subscriptions" | "orders" | "addresses";

/**
 * Account section tabs. Server component (no client JS) — each page passes its
 * own `active` tab. Extend here as account surfaces land (orders, etc.).
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
    <nav aria-label="Account" className="mb-6 flex gap-5 border-b border-line">
      {link("/account/subscriptions", "subscriptions", "Plans")}
      {link("/account/orders", "orders", "Orders")}
      {link("/account/addresses", "addresses", "Addresses")}
    </nav>
  );
}
