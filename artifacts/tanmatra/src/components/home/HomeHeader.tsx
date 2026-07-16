import { useEffect, useState } from "react";
import { Link } from "react-router";
import { usePreferences } from "@/lib/preferencesContext";
import { useCartStore } from "@/lib/cartContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import {
  ForkKnife,
  Calendar,
  Package,
  UsersThree,
  UserCircle,
  List,
  X,
  MapPin,
  CaretDown,
  ShoppingBag,
  Check,
} from "@phosphor-icons/react";
import Logo from "../layout/Logo";

// Tanmatra serves these three metros (see home + kitchen copy). The chosen city
// persists per browser so the above-the-fold "Deliver to" reflects the user's
// area on return. Exact pincode serviceability is still confirmed at checkout.
const SERVED_CITIES = ["Noida", "Delhi", "Gurgaon"] as const;
const CITY_KEY = "tanmatra:deliver-city";

export default function HomeHeader() {
  const { unauthorized, loading } = usePreferences();
  const isLoggedIn = !unauthorized && !loading;
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));

  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [city, setCity] = useState<string>("Noida");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CITY_KEY);
      if (saved) setCity(saved);
    } catch {
      /* private mode — default city */
    }
  }, []);

  const pickCity = (c: string) => {
    setCity(c);
    try {
      localStorage.setItem(CITY_KEY, c);
    } catch {
      /* non-fatal */
    }
    setCityOpen(false);
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navItems = [
    { to: "/menu", label: "Eat", icon: ForkKnife },
    { to: "/meal-planner", label: "Plan", icon: Calendar },
    ...(isLoggedIn
      ? [
          { to: "/orders", label: "Orders", icon: Package },
          { to: "/challenges", label: "Community", icon: UsersThree },
          { to: "/account", label: "Account", icon: UserCircle },
        ]
      : [
          { to: "/challenges", label: "Community", icon: UsersThree },
          { to: "/login", label: "Sign In", icon: UserCircle },
        ]),
  ];

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-[800] h-16 md:h-[72px] flex items-center justify-between gap-2 px-4 md:px-6 transition-colors duration-300 ${
          scrolled
            ? "bg-[color-mix(in_srgb,var(--tnm-surface-ink)_88%,transparent)] backdrop-blur-xl border-b border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
            : "bg-gradient-to-b from-black/55 to-transparent border-b border-transparent"
        }`}
      >
        {/* Left: brand + delivery-city selector */}
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/" aria-label="Tanmatra Home" className="shrink-0">
            <Logo className="h-8 md:h-10 w-auto" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={() => setCityOpen(true)}
            className="flex items-center gap-1.5 min-w-0 rounded-full pl-1 pr-2 hover:bg-white/5 active:scale-[0.98] transition-all"
            style={{ minHeight: 44 }}
            aria-label={`Delivering to ${city} — tap to change city`}
          >
            <MapPin size={16} weight="fill" className="text-[var(--tnm-action)] shrink-0" />
            <span className="flex flex-col items-start leading-none min-w-0">
              <span className="text-[9px] uppercase tracking-[0.12em] text-white/45 font-semibold">
                Deliver to
              </span>
              <span className="flex items-center gap-0.5 text-[13px] font-semibold text-white truncate max-w-[96px]">
                {city}
                <CaretDown size={11} weight="bold" className="text-white/50 shrink-0" />
              </span>
            </span>
          </button>
        </div>

        {/* Right: cart · profile · menu */}
        <div className="flex items-center gap-0.5">
          <Link
            to="/cart"
            aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
            className="relative inline-flex items-center justify-center rounded-full text-white/85 hover:text-white hover:bg-white/5 active:scale-[0.96] transition-all"
            style={{ minHeight: 44, minWidth: 44 }}
          >
            <ShoppingBag size={22} weight="regular" />
            {cartCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--tnm-action)] text-black text-[10px] font-bold leading-4 text-center tabular-nums">
                {cartCount}
              </span>
            )}
          </Link>
          <Link
            to={isLoggedIn ? "/account" : "/login"}
            aria-label={isLoggedIn ? "Your account" : "Sign in"}
            className="inline-flex items-center justify-center rounded-full text-white/85 hover:text-white hover:bg-white/5 active:scale-[0.96] transition-all"
            style={{ minHeight: 44, minWidth: 44 }}
          >
            <UserCircle
              size={24}
              weight={isLoggedIn ? "fill" : "regular"}
              className={isLoggedIn ? "text-[var(--tnm-action)]" : ""}
            />
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="inline-flex items-center justify-center rounded-full text-white/85 hover:text-white hover:bg-white/5 active:scale-[0.96] transition-all"
            style={{ minHeight: 44, minWidth: 44 }}
            aria-label="Open menu"
            aria-expanded={menuOpen}
          >
            <List size={22} weight="bold" />
          </button>
        </div>
      </header>

      {/* Delivery-city selector */}
      <Sheet open={cityOpen} onOpenChange={setCityOpen}>
        <SheetContent
          side="bottom"
          className="bg-[var(--tnm-surface-ink-2)] text-white border-t border-white/10 rounded-t-2xl p-0 z-[900]"
        >
          <SheetHeader className="p-4 border-b border-white/5 text-left">
            <SheetTitle className="text-white text-base font-semibold">
              Choose delivery city
            </SheetTitle>
          </SheetHeader>
          <nav className="p-2" aria-label="Delivery cities">
            {SERVED_CITIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => pickCity(c)}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-lg text-left hover:bg-white/5 active:scale-[0.99] transition-all"
                style={{ minHeight: 48 }}
              >
                <MapPin
                  size={18}
                  weight={c === city ? "fill" : "regular"}
                  className={c === city ? "text-[var(--tnm-action)]" : "text-white/50"}
                />
                <span className="flex-1 text-sm font-medium text-white/90">{c}</span>
                {c === city && <Check size={18} weight="bold" className="text-[var(--tnm-action)]" />}
              </button>
            ))}
            <p className="px-4 py-3 text-[11px] text-white/40 leading-relaxed">
              Fresh daily delivery across Noida, Delhi &amp; Gurgaon. Exact serviceability is
              confirmed at checkout by pincode.
            </p>
          </nav>
        </SheetContent>
      </Sheet>

      {/* Full navigation */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="right"
          className="bg-[var(--tnm-surface-ink-2)] text-white border-l border-white/5 w-[280px] p-0 z-[900]"
        >
          <SheetHeader className="p-4 border-b border-white/5 flex flex-row items-center justify-between">
            <SheetTitle className="text-white text-base font-semibold">Explore Tanmatra</SheetTitle>
            <SheetClose
              className="h-11 w-11 rounded-md flex items-center justify-center hover:bg-white/5 text-white/75 hover:text-white"
              style={{ minHeight: 44, minWidth: 44 }}
            >
              <X className="w-5 h-5" weight="bold" />
            </SheetClose>
          </SheetHeader>

          <nav className="p-2 flex flex-col gap-1" aria-label="Mobile Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3.5 px-4 py-3.5 rounded-lg text-sm font-medium text-white/80 hover:text-white hover:bg-white/5 transition-all"
                  style={{ minHeight: 48 }}
                >
                  <Icon className="w-5 h-5 text-white/60" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
