import { Link, useLocation } from "react-router";

/**
 * V2 persistent bottom navigation dock (thumb-zone).
 *
 * A fixed, semi-transparent/blurred bar over the dark .tnm2 ground. Mounted
 * once in root.tsx and shown only on the primary browse/dashboard routes (the
 * show/hide decision lives in root.tsx so this component stays a pure view).
 *
 * The nav carries the `tnm2` class itself so the v2 design-token custom
 * properties (--bg, --saf, --mut, --ln …) resolve here even though the dock is
 * rendered outside any page's `.tnm2` wrapper.
 */

interface DockItem {
  to: string;
  label: string;
  icon: string;
  /** Returns true when the current location should highlight this item. */
  isActive: (pathname: string, search: string) => boolean;
}

const ITEMS: DockItem[] = [
  {
    to: "/",
    label: "Home",
    icon: "ph-house",
    isActive: (p) => p === "/",
  },
  {
    to: "/subscriptions",
    label: "My Plans",
    icon: "ph-clipboard-text",
    isActive: (p) => p === "/subscriptions" || p.startsWith("/subscriptions/"),
  },
  {
    to: "/wellness",
    label: "Track Data",
    icon: "ph-chart-line-up",
    isActive: (p) => p === "/wellness" || p.startsWith("/wellness/"),
  },
  {
    // Toggle-style entry into "Healthy Mode" — the /menu side is owned by
    // another agent; we simply navigate there with the query flag and reflect
    // the toggled/active visual state when already on /menu?healthy=1.
    to: "/menu?healthy=1",
    label: "Healthy Mode",
    icon: "ph-heart",
    isActive: (p, search) =>
      p === "/menu" && new URLSearchParams(search).get("healthy") === "1",
  },
];

export default function BottomDock() {
  const { pathname, search } = useLocation();

  return (
    <nav className="tnm2 nn bdock" aria-label="Primary">
      <ul className="bdock-list">
        {ITEMS.map((item) => {
          const active = item.isActive(pathname, search);
          return (
            <li key={item.to} className="bdock-item">
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`bdock-link${active ? " on" : ""}`}
              >
                <i className={`ph-bold ${item.icon} bdock-icon`} aria-hidden="true" />
                <span className="bdock-label">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
