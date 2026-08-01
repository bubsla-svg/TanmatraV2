import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft, LayoutGrid, LogOut } from "lucide-react";
import { apiPath } from "@/lib/apiBase";
import {
  ALL_ADMIN_CONSOLES,
  consoleForPath,
} from "@/lib/adminConsoles";

/**
 * The Admin ERP's own chrome.
 *
 * `root.tsx` no longer mounts the consumer Header/Footer/BottomNav on internal
 * routes (see lib/internalSurfaces.ts for why), which removed a nav bar whose
 * every link 404'd — but removing it left the console with NO navigation at
 * all: once an operator opened /admin/ops the only way to another console was
 * the browser back button. This is the replacement, and unlike the consumer
 * header it links only at routes this app actually serves.
 *
 * `sticky`, deliberately not `fixed`. The consumer header was
 * `fixed top-3` over a <main> with no top padding, which is why the header pill
 * was painted straight through the "Admin Console" and "AI Runs" headings in
 * every screenshot. A sticky bar occupies real flow space, so a page cannot be
 * laid out underneath it — the overlap class of bug is gone by construction
 * rather than by remembering to add matching padding to nineteen pages.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const current = consoleForPath(location.pathname);
  const onIndex = location.pathname === "/" || location.pathname === "/admin";

  const signOut = async () => {
    setSigningOut(true);
    try {
      await fetch(apiPath("/admin/logout"), {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Even if the call fails the local view must not keep claiming a
      // session — the auth layout re-checks /admin/me on the next mount and
      // will bounce to login if the cookie really is still live.
    } finally {
      setSigningOut(false);
      navigate("/admin/login", { replace: true });
    }
  };

  return (
    // Plain <div>s throughout: root.tsx already opens the one <main> for the
    // document, and nesting a second is invalid HTML. For the same reason the
    // bar below is a <div role="banner">-free <header>, which inside <main>
    // is valid and simply is not a landmark.
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-nn-surface/95 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link
            to="/admin"
            className="flex items-center gap-2 shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nn-primary/50"
          >
            <span className="text-sm font-serif font-medium text-white">
              Tanmatra
            </span>
            <span className="text-[9px] uppercase tracking-[0.16em] text-nn-primary font-semibold border border-nn-primary/30 rounded px-1.5 py-0.5">
              Ops ERP
            </span>
          </Link>

          {/* Current console, so a deep link tells you where you are without
              relying on the page's own <h1> being above the fold. */}
          {current && (
            <>
              <span aria-hidden className="text-white/20 text-sm">
                /
              </span>
              <span className="text-sm text-white/80 truncate">
                {current.title}
              </span>
            </>
          )}

          <div className="ml-auto flex items-center gap-2 shrink-0">
            {!onIndex && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-white/10 text-xs text-white/70 hover:text-white hover:border-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nn-primary/50"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
                Console
              </Link>
            )}
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-white/10 text-xs text-white/70 hover:text-white hover:border-white/20 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nn-primary/50"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>

        {/* Horizontal console rail. Scrolls rather than wraps so the bar keeps
            a fixed height on narrow ops tablets (the KDS runs on one). */}
        <nav
          aria-label="Admin consoles"
          className="max-w-6xl mx-auto px-4 pb-2 flex items-center gap-1 overflow-x-auto scrollbar-none"
        >
          <Link
            to="/admin"
            aria-current={onIndex ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nn-primary/50 ${
              onIndex
                ? "bg-nn-primary/15 text-nn-primary border border-nn-primary/30"
                : "text-white/60 hover:text-white hover:bg-white/10 border border-transparent"
            }`}
          >
            <LayoutGrid className="w-3 h-3" aria-hidden />
            All
          </Link>
          {ALL_ADMIN_CONSOLES.map((item) => {
            const active = current?.path === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nn-primary/50 ${
                  active
                    ? "bg-nn-primary/15 text-nn-primary border border-nn-primary/30"
                    : "text-white/60 hover:text-white hover:bg-white/10 border border-transparent"
                }`}
              >
                <Icon className="w-3 h-3" aria-hidden />
                {item.navLabel}
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="flex-1">{children}</div>
    </div>
  );
}

export default AdminShell;
