import { Link, useLocation } from "react-router";
import { useState } from "react";
import {
  House,
  ForkKnife,
  Calendar,
  Stethoscope,
  UsersThree,
  UserCircle,
  ShoppingCart,
  Package,
  Sparkle,
  Flag,
  HandHeart,
  BookOpen,
  Crown,
  Storefront,
  MapPin,
  SlidersHorizontal,
  Gift,
  Buildings,
  Users,
  ShieldCheck,
  EnvelopeSimple,
  Phone,
  SignIn,
  X,
  DotsThree,
} from "@phosphor-icons/react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/lib/cartContext";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/lib/preferencesContext";

interface NavItem {
  to: string;
  label: string;
  icon: typeof House;
  match?: (pathname: string) => boolean;
  showCartBadge?: boolean;
}

// Mobile primary IA mirrors desktop Header: Eat / Plan / Track / Community / Account
const PRIMARY: NavItem[] = [
  {
    to: "/menu",
    label: "Eat",
    icon: ForkKnife,
    match: (p) =>
      p.startsWith("/menu") ||
      p.startsWith("/dish") ||
      p.startsWith("/marketplace") ||
      p.startsWith("/recipes") ||
      p === "/cart" ||
      p === "/checkout",
    showCartBadge: true,
  },
  {
    to: "/meal-planner",
    label: "Plan",
    icon: Calendar,
    match: (p) =>
      p.startsWith("/meal-planner") ||
      p.startsWith("/subscriptions") ||
      p.startsWith("/plans") ||
      p.startsWith("/rd") ||
      p.startsWith("/appointments") ||
      p === "/subscribe",
  },
  {
    to: "/orders",
    label: "Orders",
    icon: Package,
    match: (p) => p.startsWith("/orders") || p === "/track",
  },
  {
    to: "/challenges",
    label: "Community",
    icon: UsersThree,
    match: (p) =>
      p.startsWith("/challenges") ||
      p.startsWith("/wellness") ||
      p.startsWith("/performance") ||
      p.startsWith("/clinical") ||
      p.startsWith("/corporate") ||
      p.startsWith("/team"),
  },
  {
    to: "/account",
    label: "Account",
    icon: UserCircle,
    match: (p) =>
      p.startsWith("/account") ||
      p.startsWith("/preferences") ||
      p.startsWith("/rewards") ||
      p.startsWith("/vouchers") ||
      p.startsWith("/premium") ||
      p === "/login",
  },
];

interface MoreLink {
  to: string;
  label: string;
  icon: typeof House;
  desc?: string;
}

const MORE_GROUPS: { title: string; items: MoreLink[] }[] = [
  {
    title: "Eat",
    items: [
      { to: "/", label: "Home", icon: House },
      { to: "/menu", label: "Browse menu", icon: ForkKnife },
      { to: "/marketplace", label: "Marketplace", icon: Storefront, desc: "RD-curated pantry & supplements" },
      { to: "/recipes", label: "Recipes", icon: BookOpen },
      { to: "/cart", label: "Cart", icon: ShoppingCart },
    ],
  },
  {
    title: "Plan",
    items: [
      { to: "/meal-planner", label: "Weekly Planner", icon: Sparkle, desc: "AI-personalized 7-day plan" },
      { to: "/subscriptions", label: "My Plans", icon: Calendar, desc: "Active subscriptions" },
      { to: "/plans", label: "RD Plans", icon: Stethoscope, desc: "Therapeutic protocols" },
      { to: "/rd", label: "Book a Dietitian", icon: HandHeart, desc: "1:1 consult" },
      { to: "/appointments", label: "My Care", icon: Calendar },
    ],
  },
  {
    title: "Track",
    items: [
      { to: "/orders", label: "My Orders", icon: Package },
      { to: "/track", label: "Live Order", icon: MapPin },
    ],
  },
  {
    title: "Community",
    items: [
      { to: "/challenges", label: "Challenges", icon: Flag },
      { to: "/wellness", label: "Wellness Protocol", icon: HandHeart },
      { to: "/performance", label: "Performance Protocol", icon: Sparkle },
      { to: "/clinical", label: "Clinical Protocol", icon: Stethoscope },
      { to: "/corporate", label: "Corporate", icon: Buildings },
      { to: "/team", label: "Team", icon: Users },
      { to: "/rd-partners", label: "For Dietitians", icon: Stethoscope, desc: "Become an RD partner" },
    ],
  },
  {
    title: "Account",
    items: [
      { to: "/account", label: "Account hub", icon: UserCircle, desc: "Profile, plan & benefits" },
      { to: "/account/addresses", label: "Address book", icon: MapPin, desc: "Saved delivery addresses" },
      { to: "/preferences", label: "Preferences", icon: SlidersHorizontal },
      { to: "/rewards", label: "Rewards", icon: Sparkle },
      { to: "/vouchers", label: "Vouchers", icon: Gift },
      { to: "/premium", label: "Premium", icon: Crown },
    ],
  },
];

export function MoreSheetTrigger({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Open all sections menu"
        className={
          className ??
          "inline-flex items-center justify-center h-12 w-12 rounded-md text-white/45 hover:text-[var(--tnm-action)] hover:bg-[var(--tnm-action)]/10 transition-colors touch-target-48"
        }
      >
        <DotsThree className="w-6 h-6" weight="bold" aria-hidden />
      </button>
      <MoreSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

function MoreSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[88vw] max-w-sm bg-[var(--tnm-surface-ink-2)] border-white/10 p-0 flex flex-col"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-white/10">
          <SheetTitle className="text-white text-base font-serif flex items-center justify-between">
            Explore Tanmatra
            <SheetClose
              aria-label="Close menu"
              className="text-white/45 hover:text-white -mr-1 inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[var(--tnm-action)]/40"
            >
              <X className="w-4 h-4" />
            </SheetClose>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          <Link
            to="/login"
            onClick={() => onOpenChange(false)}
            className="flex items-center gap-3 rounded-lg border border-[var(--tnm-action)]/30 bg-[var(--tnm-action)]/10 px-4 py-3 min-h-[52px] active:bg-[var(--tnm-action)]/15"
          >
            <SignIn className="w-4 h-4 text-[var(--tnm-action)]" />
            <div className="flex-1">
              <p className="text-sm text-white font-medium">Sign in</p>
              <p className="text-[11px] text-white/45">
                Save preferences, track orders, earn rewards
              </p>
            </div>
          </Link>

          {MORE_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="text-[10px] uppercase tracking-widest text-white/50 mb-2 px-1">
                {group.title}
              </p>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={() => onOpenChange(false)}
                        className="flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-md text-white hover:bg-white/5 active:bg-white/10 transition-colors"
                      >
                        <Icon className="w-4 h-4 text-[var(--tnm-action)] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-tight">{item.label}</p>
                          {item.desc && (
                            <p className="text-[11px] text-white/45 leading-tight mt-0.5">
                              {item.desc}
                            </p>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <div className="pt-4 mt-2 border-t border-white/10 space-y-2 text-[11px] text-white/45">
            <div className="flex items-center gap-2">
              <EnvelopeSimple className="w-3 h-3 text-[var(--tnm-action)]" />
              care@tanmatra.health
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-3 h-3 text-[var(--tnm-action)]" />
              +91 92892 13115
            </div>
            <div className="flex items-center gap-2 pt-1">
              <ShieldCheck className="w-3 h-3 text-[var(--tnm-sage)]" />
              ISO 22000 · FSSAI Lic. 22725926001018
            </div>
            <div className="flex items-center gap-3 pt-1 text-[10px] text-white/45">
              <Link to="/privacy" onClick={() => onOpenChange(false)} className="hover:text-[var(--tnm-action)]">
                Privacy
              </Link>
              <span>&middot;</span>
              <Link to="/terms" onClick={() => onOpenChange(false)} className="hover:text-[var(--tnm-action)]">
                Terms
              </Link>
            </div>
            <p className="pt-1 text-[10px] text-[var(--tnm-text-secondary)]">
              © {new Date().getFullYear()} Tanmatra Health Technologies
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function BottomNav() {
  const { pathname } = useLocation();
  const { totalQuantity } = useCart();
  const { unauthorized, loading } = usePreferences();
  const isLoggedIn = !unauthorized && !loading;

  const navItems = [
    ...PRIMARY.filter(
      (item) => item.to !== "/orders" && item.to !== "/account"
    ),
    ...(isLoggedIn
      ? [
          PRIMARY.find((item) => item.to === "/orders")!,
          PRIMARY.find((item) => item.to === "/account")!,
        ]
      : [
          {
            to: "/login",
            label: "Sign In",
            icon: UserCircle,
            match: (p: string) => p === "/login",
          },
        ]),
  ];

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-[color-mix(in_srgb,var(--tnm-surface-ink)_96%,transparent)] backdrop-blur-xl pb-[var(--safe-bottom)] min-h-[var(--bottom-nav-height)]"
    >
      <ul className={cn("grid", isLoggedIn ? "grid-cols-5" : "grid-cols-4")}>
        {navItems.map((item) => {
          const active = item.match
            ? item.match(pathname)
            : pathname === item.to;
          const showBadge = item.showCartBadge && totalQuantity > 0;
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-1.5 text-[10px] font-medium tracking-wide transition-colors ${
                  active
                    ? "text-[var(--tnm-action)]"
                    : "text-white/45 hover:text-white/70"
                }`}
              >
                <Icon
                  className="w-5 h-5"
                  weight={active ? "fill" : "regular"}
                  aria-hidden
                />
                <span>{item.label}</span>
                {showBadge && (
                  <Badge
                    className="absolute top-1 right-[22%] h-4 min-w-4 px-1 text-[9px] bg-[var(--tnm-action)] text-black border-0 font-bold leading-none"
                    aria-label={`${totalQuantity} items in cart`}
                  >
                    {totalQuantity}
                  </Badge>
                )}
                {active && (
                  <span className="absolute top-0 inset-x-6 h-0.5 rounded-b bg-[var(--tnm-action)]" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
