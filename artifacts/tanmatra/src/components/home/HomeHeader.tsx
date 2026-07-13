import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { usePreferences } from "@/lib/preferencesContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { ForkKnife, Calendar, Package, UsersThree, UserCircle, List, X } from "@phosphor-icons/react";
import Logo from "../layout/Logo";

export default function HomeHeader() {
  const navigate = useNavigate();
  const { unauthorized, loading } = usePreferences();
  const isLoggedIn = !unauthorized && !loading;
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 40) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
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
        className={`fixed top-0 left-0 right-0 z-[800] transition-colors duration-250 border-b border-transparent ${
          scrolled
            ? "bg-[var(--tnm-surface-ink)] border-white/5 shadow-md h-16 md:h-[72px]"
            : "bg-transparent h-16 md:h-[72px]"
        } flex items-center justify-between px-4 md:px-6`}
      >
        <Link to="/" className="flex items-center gap-2" aria-label="Tanmatra Home">
          <Logo className="h-9 md:h-11 w-auto" aria-hidden="true" />
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(true)}
            className="inline-flex items-center justify-center h-10 w-10 rounded-md text-white/80 hover:text-white hover:bg-white/5 transition-colors"
            style={{ minHeight: 44, minWidth: 44 }}
            aria-label="Open menu"
            aria-expanded={menuOpen}
          >
            <List className="w-6 h-6" weight="bold" />
          </button>
        </div>
      </header>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="right" className="bg-[var(--tnm-surface-ink-2)] text-white border-l border-white/5 w-[280px] p-0 z-[900]">
          <SheetHeader className="p-4 border-b border-white/5 flex flex-row items-center justify-between">
            <SheetTitle className="text-white text-base font-semibold">Explore Tanmatra</SheetTitle>
            <SheetClose className="h-10 w-10 rounded-md flex items-center justify-center hover:bg-white/5 text-white/75 hover:text-white" style={{ minHeight: 44, minWidth: 44 }}>
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
