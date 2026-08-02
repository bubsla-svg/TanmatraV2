import {
  Activity,
  BarChart3,
  Bot,
  Brain,
  ChefHat,
  ClipboardList,
  FileText,
  LineChart,
  LifeBuoy,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  Store,
  Truck,
  UtensilsCrossed,
} from "lucide-react";

/**
 * The Admin ERP's console catalogue — the single list of internal surfaces an
 * operator can reach.
 *
 * Lifted out of `pages/AdminIndex.tsx`, where it was a private const, because
 * two things now need it and they must not drift: the console index grid AND
 * the persistent admin nav (`components/layout/AdminShell.tsx`). While it was
 * private it had already drifted from `routes.ts` — /admin/kds (kitchen
 * display) and /admin/supplier were routed, rendered and shipped, but appeared
 * in no list anywhere, so the only way to reach either was to know the URL and
 * type it. `adminConsoles.test.ts` now asserts both directions of that parity
 * against routes.ts, so a route added without a link (or a link pointing at no
 * route) fails CI instead of quietly becoming unreachable.
 */
export type AdminConsole = {
  path: string;
  title: string;
  description: string;
  /** Short label for the persistent nav, where the full title is too long. */
  navLabel: string;
  icon: typeof Activity;
};

export type AdminConsoleGroup = {
  section: string;
  items: AdminConsole[];
};

export const ADMIN_CONSOLES: AdminConsoleGroup[] = [
  {
    section: "Operations",
    items: [
      {
        path: "/admin/ops",
        title: "Ops Dashboard",
        navLabel: "Ops",
        description: "Live order flow, dispatch, ETA accuracy, anomalies.",
        icon: Activity,
      },
      {
        path: "/admin/kds",
        title: "Kitchen Display",
        navLabel: "KDS",
        description:
          "Live order tickets for the kitchen pass, with portion-weight checks.",
        icon: ChefHat,
      },
      {
        path: "/admin/catalog",
        title: "Menu Catalog",
        navLabel: "Catalog",
        description: "Manage SKUs, categories, and availability.",
        icon: FileText,
      },
      {
        path: "/admin/compliance",
        title: "Compliance & Audits",
        navLabel: "Compliance",
        description:
          "Daily ISO 22000 hygiene statements, cold storage, and supplier origins.",
        icon: ClipboardList,
      },
      {
        path: "/admin/audit",
        title: "System Audit Trail",
        navLabel: "Audit Trail",
        description: "Immutable log of administrative and clinical actions.",
        icon: FileText,
      },
      {
        path: "/admin/forecasting",
        title: "Demand Forecasting",
        navLabel: "Forecasting",
        description: "Predicted volumes per dish, kitchen, and slot.",
        icon: LineChart,
      },
      {
        path: "/admin/menu-engineering",
        title: "Menu Engineering",
        navLabel: "Menu eng.",
        description: "Margin × velocity matrix to prune and promote dishes.",
        icon: UtensilsCrossed,
      },
      {
        path: "/admin/supplier",
        title: "Supplier & Purchasing",
        navLabel: "Suppliers",
        description:
          "Crate barcodes, farm-origin and batch traceability, inbound stock.",
        icon: Truck,
      },
    ],
  },
  {
    section: "Analytics & AI",
    items: [
      {
        path: "/admin/analytics",
        title: "Analytics",
        navLabel: "Analytics",
        description: "Revenue, retention, cohort and protocol metrics.",
        icon: BarChart3,
      },
      {
        path: "/admin/ai-runs",
        title: "AI Runs",
        navLabel: "AI runs",
        description: "Telemetry of every agent invocation, latency and cost.",
        icon: Brain,
      },
      {
        path: "/admin/ops-agent",
        title: "Ops Agent",
        navLabel: "Ops agent",
        description: "Conversational console for the ops support agent.",
        icon: Bot,
      },
      {
        path: "/admin/cms-agent",
        title: "CMS Agent",
        navLabel: "CMS agent",
        description: "Generate and edit menu copy, photos, and protocols.",
        icon: Sparkles,
      },
    ],
  },
  {
    section: "Trust & Safety",
    items: [
      {
        path: "/admin/moderation",
        title: "Review Moderation",
        navLabel: "Reviews",
        description: "Queue of flagged dish reviews awaiting decision.",
        icon: ShieldAlert,
      },
      {
        path: "/admin/community-moderation",
        title: "Community Moderation",
        navLabel: "Community",
        description: "Cohort posts, comments, and member reports.",
        icon: MessageSquare,
      },
      {
        path: "/admin/support-tickets",
        title: "Support Tickets",
        navLabel: "Support",
        description: "Customer support queue with agent suggestions.",
        icon: LifeBuoy,
      },
    ],
  },
  {
    section: "Partners & B2B",
    items: [
      {
        path: "/admin/rd-applications",
        title: "RD Applications",
        navLabel: "RD apps",
        description: "Registered Dietitian onboarding applications.",
        icon: FileText,
      },
      {
        path: "/admin/sales-console",
        title: "B2B Sales Console",
        navLabel: "Sales",
        description: "Corporate accounts pipeline and per-company drilldown.",
        icon: Store,
      },
      {
        path: "/rd-console",
        title: "RD Console",
        navLabel: "RD console",
        description: "Dietitian workspace (RD or admin only).",
        icon: ClipboardList,
      },
    ],
  },
];

/** Flat view of the catalogue, in the order the index renders it. */
export const ALL_ADMIN_CONSOLES: AdminConsole[] = ADMIN_CONSOLES.flatMap(
  (group) => group.items,
);

/**
 * The catalogue entry a pathname is "inside", longest match first so that
 * /admin/sales-console/acme resolves to the sales console rather than to
 * nothing. Returns null for the console index itself and for any path with no
 * catalogue entry (e.g. /admin/login).
 */
export function consoleForPath(pathname: string): AdminConsole | null {
  const normalised =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  let best: AdminConsole | null = null;
  for (const item of ALL_ADMIN_CONSOLES) {
    const matches =
      normalised === item.path || normalised.startsWith(item.path + "/");
    if (!matches) continue;
    if (!best || item.path.length > best.path.length) best = item;
  }
  return best;
}
