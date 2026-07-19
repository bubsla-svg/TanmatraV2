import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
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
  MagnifyingGlass,
  ArrowRight,
} from "@phosphor-icons/react";

// Zomato-grade two-tier header: a location-first top row (deliver-to city,
// profile, cart) and a prominent search field that drops the user straight
// into menu discovery. The chosen city persists per browser; exact pincode
// serviceability is still confirmed at checkout.
const SERVED_CITIES = ["Noida", "Delhi", "Gurgaon"] as const;
const CITY_KEY = "tanmatra:deliver-city";

// Rotating search hints — concrete, food-first, conversion-oriented.
const SEARCH_HINTS = [
  '"high-protein bowl"',
  '"diabetic-friendly dinner"',
  '"paneer tikka wrap"',
  '"low-GI breakfast"',
];

export default function HomeHeader() {
  const navigate = useNavigate();
  const { unauthorized, loading } = usePreferences();
  const isLoggedIn = !unauthorized && !loading;
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));

  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [city, setCity] = useState<string>("Noida");
  const [hintIdx, setHintIdx] = useState(0);
  const [query, setQuery] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CITY_KEY);
      if (saved) setCity(saved);
    } catch {
      /* private mode — default city */
    }
  }, []);

  // Rotate the search placeholder gently (reduced-motion users keep the first).
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setHintIdx((i) => (i + 1) % SEARCH_HINTS.length), 3500);
    return () => clearInterval(t);
  }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Fall back to the currently displayed hint (unquoted) rather than
    // discarding the user's tap on an empty field — they were shown a
    // concrete example, so honor it as the query instead of dumping them
    // onto an unfiltered menu (impeccable critique P1, 2026-07-17).
    const term = query.trim() || SEARCH_HINTS[hintIdx].replace(/^"|"$/g, "");
    navigate(`/menu?q=${encodeURIComponent(term)}`);
  };

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
    const onScroll = () => setScrolled(window.scrollY > 24);
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
        className={`fixed top-0 left-0 right-0 z-[800] transition-colors duration-300 ${
          scrolled
            ? "bg-[color-mix(in_srgb,var(--tnm-surface-ink)_92%,transparent)] backdrop-blur-xl border-b border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.45)]"
            : "bg-gradient-to-b from-black/70 via-black/35 to-transparent border-b border-transparent"
        }`}
      >
        <div className="mx-auto max-w-[820px] px-4 md:px-6 pt-2.5 pb-3 flex flex-col gap-2.5">
          {/* Tier 1 — location · profile · cart · menu */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setCityOpen(true)}
              className="flex items-center gap-2 min-w-0 rounded-xl -ml-1 pl-1 pr-2 py-1 hover:bg-white/5 active:scale-[0.98] transition-all text-left"
              style={{ minHeight: 44 }}
              aria-label={`Delivering to ${city} — tap to change city`}
            >
              <MapPin size={22} weight="fill" className="text-[var(--tnm-action)] shrink-0" />
              <span className="flex flex-col min-w-0 leading-tight">
                <span className="flex items-center gap-1 text-[15px] font-extrabold text-white">
                  {city}
                  <CaretDown size={12} weight="bold" className="text-white/60 shrink-0" />
                </span>
                <span className="text-[11px] text-white/55 font-medium truncate">
                  Dietitian meals, delivered fresh daily
                </span>
              </span>
            </button>

            <div className="flex items-center gap-0.5 shrink-0">
              <Link
                to="/cart"
                aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
                className="relative inline-flex items-center justify-center rounded-full text-white/90 hover:text-white hover:bg-white/5 active:scale-[0.96] transition-all"
                style={{ minHeight: 44, minWidth: 44 }}
              >
                <ShoppingBag size={22} weight="regular" />
                {cartCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[var(--tnm-action)] text-black text-[10px] font-bold leading-4 text-center tabular-nums">
                    {cartCount}
                  </span>
                )}
              </Link>
              <Link
                to={isLoggedIn ? "/account" : "/login"}
                aria-label={isLoggedIn ? "Your account" : "Sign in"}
                className="inline-flex items-center justify-center rounded-full active:scale-[0.96] transition-all"
                style={{ minHeight: 44, minWidth: 44 }}
              >
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                    isLoggedIn
                      ? "bg-[var(--tnm-action)]/15 border-[var(--tnm-action)]/40 text-[var(--tnm-action)]"
                      : "bg-white/8 border-white/15 text-white/85"
                  }`}
                >
                  <UserCircle size={20} weight={isLoggedIn ? "fill" : "regular"} />
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="inline-flex items-center justify-center rounded-full text-white/90 hover:text-white hover:bg-white/5 active:scale-[0.96] transition-all"
                style={{ minHeight: 44, minWidth: 44 }}
                aria-label="Open menu"
                aria-expanded={menuOpen}
              >
                <List size={22} weight="bold" />
              </button>
            </div>
          </div>

          {/* Tier 2 — search, straight into discovery */}
          <form
            role="search"
            onSubmit={submitSearch}
            className="w-full flex items-center gap-2.5 h-11 px-3.5 rounded-xl bg-white/[0.07] border border-white/12 backdrop-blur-md hover:bg-white/10 hover:border-white/20 transition-all focus-within:bg-white/10 focus-within:border-white/25"
            style={{ minHeight: 44 }}
          >
            <MagnifyingGlass size={18} weight="bold" className="text-[var(--tnm-action)] shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${SEARCH_HINTS[hintIdx]}`}
              aria-label="Search dishes"
              enterKeyHint="search"
              className="flex-1 min-w-0 bg-transparent text-[13.5px] text-white placeholder:text-white/55 placeholder:font-medium truncate outline-none"
            />
            <button
              type="submit"
              aria-label="Search"
              className="shrink-0 inline-flex items-center justify-center text-white/60 hover:text-white transition-colors"
              style={{ minHeight: 44, minWidth: 32 }}
            >
              <ArrowRight size={16} weight="bold" />
            </button>
          </form>
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
              Fresh daily delivery across Noida. Exact serviceability is
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
