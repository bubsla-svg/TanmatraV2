import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  MagnifyingGlass,
  X,
  ClockCounterClockwise,
  ForkKnife,
  HandHeart,
  Sparkle,
  Stethoscope,
} from "@phosphor-icons/react";
import { type DishData } from "@/lib/menuData";
import { type UserPreferences } from "@/lib/preferencesApi";
import { evaluateDishForPreferences } from "@/lib/preferencesMatch";
import {
  PROTOCOLS,
  PROTOCOL_LABELS,
  PROTOCOL_TAGLINES,
  matchesProtocol,
  type Protocol,
} from "@/lib/protocols";
import { cn } from "@/lib/utils";
import { type RouteEntry } from "./CommandPalette";

const RECENT_SEARCHES_KEY = "tanmatra:recent-searches:v1";

export interface MobileSearchSheetProps {
  open: boolean;
  setOpen: (next: boolean) => void;
  dishes: DishData[];
  preferences: UserPreferences | null;
  groupedRoutes: Record<string, RouteEntry[]>;
}

export default function MobileSearchSheet({
  open,
  setOpen,
  dishes,
  preferences,
  groupedRoutes,
}: MobileSearchSheetProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load recent searches from localStorage when sheet opens
  useEffect(() => {
    if (open && typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setRecentSearches(
              parsed.filter((item): item is string => typeof item === "string").slice(0, 8)
            );
          }
        }
      } catch {
        // Fallback on storage error
      }
    }
  }, [open]);

  // Handle instant focus when opening and clean state when closing
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
    setQuery("");
    setSelectedProtocol(null);
    return undefined;
  }, [open]);

  const saveRecentSearch = (item: string) => {
    if (typeof window === "undefined" || !item.trim()) return;
    try {
      const clean = item.trim();
      const updated = [
        clean,
        ...recentSearches.filter((s) => s.toLowerCase() !== clean.toLowerCase()),
      ].slice(0, 8);
      setRecentSearches(updated);
      window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {
      // Ignore localStorage errors
    }
  };

  const removeRecentSearch = (itemToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = recentSearches.filter((s) => s !== itemToRemove);
      setRecentSearches(updated);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      }
    } catch {
      // Ignore storage errors
    }
  };

  const clearAllRecentSearches = () => {
    setRecentSearches([]);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(RECENT_SEARCHES_KEY);
      } catch {
        // Ignore storage errors
      }
    }
  };

  const go = (to: string, labelForHistory?: string) => {
    if (labelForHistory) {
      saveRecentSearch(labelForHistory);
    }
    setOpen(false);
    navigate(to);
  };

  // Evaluate and filter dishes
  const dishItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return (dishes ?? [])
      .filter((d) => {
        if (selectedProtocol && !matchesProtocol(d, selectedProtocol)) {
          return false;
        }
        if (!normalizedQuery) return true;
        const matchName = d.name.toLowerCase().includes(normalizedQuery);
        const matchKitchen = d.kitchen.toLowerCase().includes(normalizedQuery);
        const matchCategory = d.category.toLowerCase().includes(normalizedQuery);
        return matchName || matchKitchen || matchCategory;
      })
      .slice(0, 50)
      .map((d) => {
        const match = evaluateDishForPreferences(d, preferences);
        return {
          slug: d.slug,
          name: d.name,
          kitchen: d.kitchen,
          blocked: match.blocked,
        };
      });
  }, [dishes, preferences, selectedProtocol, query]);

  // Filter routes
  const filteredRouteGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const groups: Record<string, RouteEntry[]> = {};

    for (const [groupName, routes] of Object.entries(groupedRoutes)) {
      const matchingRoutes = routes.filter((r) => {
        if (normalizedQuery) {
          const matchLabel = r.label.toLowerCase().includes(normalizedQuery);
          const matchKeywords = r.keywords?.toLowerCase().includes(normalizedQuery) ?? false;
          return matchLabel || matchKeywords;
        }
        if (selectedProtocol) {
          if (r.to === `/${selectedProtocol}`) return true;
          if (groupName === "Eat" || groupName === "Plan") return true;
          return false;
        }
        return true;
      });

      if (matchingRoutes.length > 0) {
        groups[groupName] = matchingRoutes;
      }
    }
    return groups;
  }, [groupedRoutes, query, selectedProtocol]);

  const getProtocolIcon = (proto: Protocol) => {
    switch (proto) {
      case "wellness":
        return <HandHeart className="w-3.5 h-3.5" />;
      case "performance":
        return <Sparkle className="w-3.5 h-3.5" />;
      case "clinical":
        return <Stethoscope className="w-3.5 h-3.5" />;
    }
  };

  const protocolActionRoute = useMemo(() => {
    if (!selectedProtocol) return null;
    return {
      label: `Explore ${PROTOCOL_LABELS[selectedProtocol]} Protocol`,
      to: `/${selectedProtocol}`,
      tagline: PROTOCOL_TAGLINES[selectedProtocol],
    };
  }, [selectedProtocol]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="bottom"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
        className="h-[92dvh] max-h-[92dvh] w-full bg-clinical-dark border-t border-clinical-border p-0 flex flex-col rounded-t-2xl overflow-hidden focus:outline-none [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Mobile search</SheetTitle>
        <SheetDescription className="sr-only">
          Search dishes, protocols, and pages across Tanmatra.
        </SheetDescription>

        {/* Visual drag indicator */}
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-clinical-border shrink-0" />

        {/* Search Header */}
        <div className="px-4 pt-2 pb-3 border-b border-clinical-border/80 flex items-center gap-3 shrink-0">
          <div className="relative flex-1 flex items-center bg-white/5 border border-clinical-border rounded-xl px-3 h-11 focus-within:border-clinical-gold/50 focus-within:bg-white/[0.07] transition-all">
            <MagnifyingGlass className="w-5 h-5 text-clinical-zinc shrink-0 mr-2.5" />
            <input
              ref={inputRef}
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) {
                  saveRecentSearch(query.trim());
                }
              }}
              placeholder="Search dishes, protocols, pages…"
              className="w-full bg-transparent text-sm text-white placeholder:text-clinical-zinc-muted focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search query"
                className="p-1 text-clinical-zinc hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm font-medium text-clinical-zinc hover:text-white px-2 py-2 shrink-0 transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Protocol Filter Pills */}
        <div className="overflow-x-auto no-scrollbar py-2.5 px-4 flex items-center gap-2 border-b border-clinical-border/60 shrink-0 bg-clinical-surface/40">
          <span className="text-[11px] font-medium uppercase tracking-wider text-clinical-zinc-muted mr-1 shrink-0">
            Filter:
          </span>
          <button
            type="button"
            onClick={() => setSelectedProtocol(null)}
            className={`min-h-[34px] px-3.5 rounded-full text-xs font-medium transition-all shrink-0 ${
              selectedProtocol === null
                ? "bg-clinical-gold text-action-text font-semibold shadow-sm"
                : "bg-white/5 text-clinical-zinc border border-clinical-border hover:text-white hover:bg-white/10"
            }`}
          >
            All
          </button>
          {PROTOCOLS.map((proto) => {
            const active = selectedProtocol === proto;
            return (
              <button
                key={proto}
                type="button"
                onClick={() => setSelectedProtocol(active ? null : proto)}
                className={`min-h-[34px] px-3.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all shrink-0 ${
                  active
                    ? "bg-clinical-gold text-action-text font-semibold shadow-sm"
                    : "bg-white/5 text-clinical-zinc border border-clinical-border hover:text-white hover:bg-white/10"
                }`}
              >
                {getProtocolIcon(proto)}
                <span>{PROTOCOL_LABELS[proto]}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Results Area */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-6 overscroll-contain pb-[env(safe-area-inset-bottom,20px)]">
          {/* Recent Searches Section */}
          {!query && recentSearches.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-clinical-zinc-muted">
                  Recent Searches
                </span>
                <button
                  type="button"
                  onClick={clearAllRecentSearches}
                  className="text-[11px] text-clinical-zinc hover:text-clinical-gold transition-colors"
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((item) => (
                  <div
                    key={item}
                    onClick={() => setQuery(item)}
                    className="group inline-flex items-center gap-2 min-h-[36px] pl-3 pr-2 rounded-lg bg-white/5 border border-clinical-border/80 text-xs text-clinical-zinc hover:text-white hover:border-clinical-gold/40 cursor-pointer transition-all active:scale-95"
                  >
                    <ClockCounterClockwise className="w-3.5 h-3.5 text-clinical-gold/80 shrink-0" />
                    <span>{item}</span>
                    <button
                      type="button"
                      onClick={(e) => removeRecentSearch(item, e)}
                      aria-label={`Remove recent search ${item}`}
                      className="p-1 rounded hover:bg-white/10 text-clinical-zinc-muted hover:text-white transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dedicated Protocol Action Banner if active */}
          {protocolActionRoute && (
            <div
              onClick={() => go(protocolActionRoute.to, protocolActionRoute.label)}
              className="p-3.5 rounded-xl bg-gradient-to-r from-clinical-gold/15 via-clinical-gold/10 to-transparent border border-clinical-gold/30 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform"
            >
              <div>
                <p className="text-sm font-semibold text-clinical-gold flex items-center gap-1.5">
                  {getProtocolIcon(selectedProtocol!)}
                  {protocolActionRoute.label}
                </p>
                <p className="text-xs text-clinical-zinc mt-0.5 line-clamp-1">
                  {protocolActionRoute.tagline}
                </p>
              </div>
              <span className="text-xs font-bold text-clinical-gold ml-2 shrink-0">
                Explore →
              </span>
            </div>
          )}

          {/* Dishes List */}
          {dishItems.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-clinical-zinc-muted mb-2 px-1">
                Dishes {selectedProtocol ? `(${PROTOCOL_LABELS[selectedProtocol]})` : ""}
              </p>
              <ul className="space-y-1">
                {dishItems.map((d) => (
                  <li key={d.slug}>
                    <button
                      type="button"
                      disabled={d.blocked}
                      onClick={() => {
                        if (d.blocked) return;
                        go(`/dish/${d.slug}`, d.name);
                      }}
                      className={cn(
                        "w-full min-h-[48px] px-3 py-2.5 rounded-xl flex items-center gap-3 text-left transition-colors",
                        d.blocked
                          ? "opacity-50 cursor-not-allowed bg-white/[0.02]"
                          : "hover:bg-white/5 active:bg-white/10 text-white"
                      )}
                    >
                      <div className="h-9 w-9 rounded-lg bg-clinical-surface-elevated border border-clinical-border flex items-center justify-center text-clinical-gold shrink-0">
                        <ForkKnife className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight truncate">
                          {d.name}
                        </p>
                        <p className="text-[11px] text-clinical-zinc capitalize mt-0.5">
                          {d.kitchen} kitchen
                        </p>
                      </div>
                      {d.blocked ? (
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider bg-red-950/80 text-red-400 border border-red-500/50 px-1.5 py-0.5 rounded">
                          [BLOCKED]
                        </span>
                      ) : (
                        <span className="text-xs text-clinical-zinc-muted capitalize shrink-0">
                          {d.kitchen}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Route Groups */}
          {Object.entries(filteredRouteGroups).map(([groupName, items]) => (
            <div key={groupName}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-clinical-zinc-muted mb-2 px-1">
                {groupName}
              </p>
              <ul className="space-y-1">
                {items.map((r) => {
                  const RouteIcon = r.icon;
                  return (
                    <li key={r.to}>
                      <button
                        type="button"
                        onClick={() => go(r.to, r.label)}
                        className="w-full min-h-[48px] px-3 py-2.5 rounded-xl flex items-center gap-3 text-left text-white hover:bg-white/5 active:bg-white/10 transition-colors"
                      >
                        <div className="h-9 w-9 rounded-lg bg-clinical-surface-elevated border border-clinical-border flex items-center justify-center text-clinical-gold shrink-0">
                          <RouteIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight truncate">
                            {r.label}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {/* Empty State */}
          {dishItems.length === 0 && Object.keys(filteredRouteGroups).length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-clinical-zinc">
                No matches found{query ? ` for "${query}"` : ""}.
              </p>
              {selectedProtocol && (
                <button
                  type="button"
                  onClick={() => setSelectedProtocol(null)}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-clinical-gold hover:underline"
                >
                  Clear {PROTOCOL_LABELS[selectedProtocol]} protocol filter
                </button>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
