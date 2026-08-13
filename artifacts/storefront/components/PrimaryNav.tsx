"use client";
// Client: usePathname() for active-state highlighting, same pattern as
// MobileBottomNav's isTabActive — the header itself stays a server component.
import { usePathname } from "next/navigation";
import Link from "next/link";
import { TopNavItem } from "@astryxdesign/core/TopNav";
import { PRIMARY_NAV } from "@/lib/nav";

/** Account already has its own icon in the header's end cluster (Header.tsx) —
 *  repeating it here would put the same destination in the row twice. */
const DESKTOP_LINKS = PRIMARY_NAV.filter((link) => link.href !== "/account");

function isActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Desktop primary nav — TopNav's `centerContent` slot, NOT `startContent`.
 * TopNav gives `centerContent` its own CSS grid track
 * (`grid-template-columns: 1fr auto 1fr`, heading and endContent share the
 * two 1fr columns), so these links get dedicated space that can never be
 * overlapped by the header's end cluster. `startContent` shares a flex
 * cluster with `heading` instead — tried that first, and at 1280px width
 * "Corporate Wellness" collided with DeliveryAddressBar because
 * `endContent` is flex-shrink:0 while the start cluster has nowhere left to
 * shrink to once its items hit min-content and start wrapping.
 *
 * Renders no `<nav>` of its own: TopNav's root element already is one
 * (`label="Primary navigation"`, set where Header.tsx renders `<TopNav>`),
 * so wrapping these items in a second nav landmark would nest two
 * "primary"-ish regions inside one another.
 */
export function PrimaryNav() {
  const pathname = usePathname();
  return (
    <div className="hidden md:flex items-center gap-1">
      {DESKTOP_LINKS.map((link) => (
        <TopNavItem
          key={link.href}
          as={Link}
          href={link.href}
          label={link.label}
          isSelected={isActive(link.href, pathname)}
        />
      ))}
    </div>
  );
}
