import { Link } from "react-router";

/* Viewport 3 — Circular category badges.
 * Each deep-links into the real Menu filters (category / q / quick), which
 * Menu.tsx hydrates from the URL on load. Fixed badge sizes → CLS-safe. */

interface Badge {
  label: string;
  icon: string;
  to: string;
}

const BADGES: Badge[] = [
  { label: "Smoothies", icon: "ph-blueprint", to: "/menu?category=beverages" },
  { label: "Wraps & Rolls", icon: "ph-scroll", to: "/menu?q=wrap" },
  { label: "Clinical Salads", icon: "ph-plant", to: "/menu?q=salad" },
  { label: "High-Protein", icon: "ph-barbell", to: "/menu?quick=high-protein" },
];

export default function CategoryBadges() {
  return (
    <div className="catrow" role="list" aria-label="Shop by category">
      {BADGES.map((b) => (
        <Link key={b.label} to={b.to} className="catbadge" role="listitem">
          <span className="catcirc">
            <i className={`ph-bold ${b.icon}`} />
          </span>
          <span className="catlbl">{b.label}</span>
        </Link>
      ))}
    </div>
  );
}
