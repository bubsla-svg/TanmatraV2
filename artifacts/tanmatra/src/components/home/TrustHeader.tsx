import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { addressesApi } from "@/lib/userAddressesApi";
import { usePreferences } from "@/lib/preferencesContext";
import { DELIVERY_ETA_TEXT } from "@/lib/deliveryPromise";

/* Viewport 1 — Trust header.
 * Location selector (real default address area if saved, else neutral
 * "Noida" that routes to address entry), a search bar with a rotating
 * placeholder that routes to /menu?q=<term>, and a Veg-Only toggle that
 * routes to /menu?diet=veg. All fixed-height → CLS-safe. */

const ROTATING_TERMS = [
  "Low-GI Breakfast",
  "High-Protein Wrap",
  "Clinical Salad",
  "Post-Workout Smoothie",
];

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function TrustHeader() {
  const navigate = useNavigate();
  const { unauthorized, loading } = usePreferences();
  const [area, setArea] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [termIdx, setTermIdx] = useState(0);
  const cancelled = useRef(false);

  // Real selected/default delivery area — never fabricate a sector.
  // Only query saved addresses once we know the visitor is signed in;
  // /addresses is auth-gated, so calling it as a guest just 401s (and WebKit
  // logs the failed fetch as a page error).
  useEffect(() => {
    if (loading || unauthorized) return;
    cancelled.current = false;
    addressesApi
      .list()
      .then((r) => {
        if (cancelled.current) return;
        const def = r.addresses.find((a) => a.isDefault) ?? r.addresses[0];
        if (def) setArea(`${def.label} · ${def.city}`);
      })
      .catch(() => {});
    return () => {
      cancelled.current = true;
    };
  }, [loading, unauthorized]);

  // Rotating placeholder — disabled under reduced motion.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const id = setInterval(() => setTermIdx((i) => (i + 1) % ROTATING_TERMS.length), 2600);
    return () => clearInterval(id);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim() || ROTATING_TERMS[termIdx];
    navigate(`/menu?q=${encodeURIComponent(term)}`);
  };

  const hasArea = Boolean(area);

  return (
    <div className="trusthead padx">
      <div className="fx ac jb" style={{ minHeight: 44 }}>
        <button
          type="button"
          className="loc"
          onClick={() => navigate("/account/addresses")}
          aria-label={hasArea ? `Deliver to ${area}` : "Set your delivery location"}
        >
          <i className="ph-fill ph-map-pin" />
          <span className="clamp1" style={{ maxWidth: 210 }}>
            {hasArea ? area : "Noida"}
          </span>
          <i className="ph-bold ph-caret-down cd" style={{ fontSize: 12 }} />
        </button>
        <Link to="/account" className="avatar" aria-label="Your account">
          <i className="ph-bold ph-user" />
        </Link>
      </div>

      <form className="inp mt10" onSubmit={submit} role="search">
        <i className="ph-bold ph-magnifying-glass" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search "${ROTATING_TERMS[termIdx]}"…`}
          aria-label="Search the menu"
          enterKeyHint="search"
        />
        <button type="submit" aria-label="Search" style={{ color: "var(--safb)", display: "flex" }}>
          <i className="ph-bold ph-arrow-right" />
        </button>
      </form>

      <div className="fx ac jb mt10">
        <span className="fine">
          <i className="ph-fill ph-shield-check" style={{ color: "var(--sage)" }} /> RD-verified kitchen ·
          Fresh in {DELIVERY_ETA_TEXT}
        </span>
        <button
          type="button"
          className="vegtgl"
          onClick={() => navigate("/menu?diet=veg")}
          aria-label="Show veg-only dishes"
        >
          <span className="vd" />
          Veg Only
        </button>
      </div>
    </div>
  );
}
