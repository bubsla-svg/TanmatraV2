import { Link, useLocation } from "react-router";
import { Badge } from "@/components/ui/badge";
import {
  ForkKnife,
  Calendar,
  Package,
  UsersThree,
  UserCircle,
  ShoppingCart,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { useCart, useCartDrawer } from "@/lib/cartContext";
import Logo from "./Logo";
import CommandPalette, { useCommandPaletteHotkey } from "@/components/CommandPalette";
import { MoreSheetTrigger } from "@/components/layout/BottomNav";
import { usePreferences } from "@/lib/preferencesContext";

export default function Header() {
  const location = useLocation();
  const { totalQuantity } = useCart();
  const { open: openCart } = useCartDrawer();
  const palette = useCommandPaletteHotkey();
  const { unauthorized, loading } = usePreferences();
  const isLoggedIn = !unauthorized && !loading;

  const isActive = (path: string) =>
    path === "/"
      ? location.pathname === "/"
      : location.pathname === path || location.pathname.startsWith(path + "/");

  // Customer nav grouping: Eat / Plan / Track / Community / Account
  const navItems = [
    { path: "/menu", label: "Eat", icon: ForkKnife, match: ["/menu", "/dish", "/marketplace", "/recipes"] },
    { path: "/meal-planner", label: "Plan", icon: Calendar, match: ["/meal-planner", "/subscriptions", "/plans", "/rd", "/appointments", "/subscribe"] },
    ...(isLoggedIn
      ? [
          { path: "/orders", label: "Orders", icon: Package, match: ["/orders", "/track"] },
          { path: "/challenges", label: "Community", icon: UsersThree, match: ["/challenges", "/wellness", "/performance", "/clinical", "/metabolic", "/care", "/corporate", "/corporate-wellness", "/team"] },
          { path: "/account", label: "Account", icon: UserCircle, match: ["/account", "/preferences", "/rewards", "/vouchers", "/premium", "/login"] },
        ]
      : [
          { path: "/challenges", label: "Community", icon: UsersThree, match: ["/challenges", "/wellness", "/performance", "/clinical", "/metabolic", "/care", "/corporate", "/corporate-wellness", "/team"] },
          { path: "/login", label: "Sign In", icon: UserCircle, match: ["/login"] },
        ]),
  ];

  const isGroupActive = (matchPaths: string[]) =>
    matchPaths.some((p) => location.pathname === p || location.pathname.startsWith(p + "/"));

  return (
    <>
      <header className="fixed top-3 inset-x-0 z-50 mx-auto w-[calc(100%-2rem)] max-w-6xl pointer-events-auto">
        <div className="p-1 rounded-full bg-black/60 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]">
          <div className="px-4 h-12 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-between gap-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
            <Link to="/" className="flex items-center gap-2 shrink-0 pl-1" aria-label="Tanmatra">
              <Logo className="h-8 w-auto" aria-hidden="true" />
            </Link>

            <nav className="hidden md:flex items-center gap-1 bg-black/30 p-1 rounded-full border border-white/5" aria-label="Primary">
              {navItems.map((item) => {
                const onExactPath = isActive(item.path);
                const active = isGroupActive(item.match) || onExactPath;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tnm-action)]/50 ${
                      active
                        ? "bg-[var(--tnm-action)] text-black shadow-[0_2px_8px_color-mix(in_srgb,var(--tnm-action)_30%,transparent)]"
                        : "text-white/70 hover:text-white hover:bg-white/10"
                    }`}
                    aria-current={onExactPath ? "page" : undefined}
                  >
                    <Icon className="w-3.5 h-3.5" weight={active ? "bold" : "regular"} aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-1.5 pr-1">
              {/* ⌘K command palette trigger */}
              <button
                type="button"
                onClick={() => palette.setOpen(true)}
                aria-label="Open command palette"
                className="hidden md:inline-flex items-center gap-2 h-8 px-3 rounded-full border border-white/10 bg-white/5 text-xs text-white/70 hover:text-white hover:border-white/20 transition-all touch-target-48 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tnm-action)]/50"
              >
                <MagnifyingGlass className="w-3.5 h-3.5" aria-hidden />
                <span>Search</span>
                <kbd className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-white/60">
                  ⌘K
                </kbd>
              </button>

              <button
                type="button"
                onClick={() => palette.setOpen(true)}
                aria-label="Open command palette"
                className="md:hidden inline-flex items-center justify-center h-8 w-8 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors touch-target-48 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tnm-action)]/50"
              >
                <MagnifyingGlass className="w-4 h-4" aria-hidden />
              </button>

              <button
                type="button"
                onClick={openCart}
                aria-label={`Open cart${totalQuantity > 0 ? ` (${totalQuantity} items)` : ""}`}
                className="relative inline-flex items-center justify-center h-8 sm:px-3 rounded-full bg-white/5 border border-white/10 text-white/90 hover:bg-white/10 transition-colors touch-target-48 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tnm-action)]/50"
              >
                <ShoppingCart className="w-4 h-4" aria-hidden />
                <span className="hidden sm:inline ml-1.5 text-xs font-medium">Cart</span>
                {totalQuantity > 0 && (
                  <Badge className="absolute -top-1 -right-1 sm:static sm:ml-1.5 h-4 min-w-4 px-1 text-[10px] bg-[var(--tnm-action)] text-black border-0 font-bold leading-none rounded-full">
                    {totalQuantity}
                  </Badge>
                )}
              </button>

              {/* Mobile-only "more" hamburger to open the full Explore sheet. */}
              <span className="md:hidden">
                <MoreSheetTrigger />
              </span>
            </div>
          </div>
        </div>
      </header>

      <CommandPalette open={palette.open} setOpen={palette.setOpen} />
    </>
  );
}
