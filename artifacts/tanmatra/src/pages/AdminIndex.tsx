import { Link, type MetaFunction } from "react-router";
import {
  Activity,
  BarChart3,
  Bot,
  Brain,
  ClipboardList,
  FileText,
  LineChart,
  LifeBuoy,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  Store,
  Users,
  UtensilsCrossed,
} from "lucide-react";

type AdminLink = {
  path: string;
  title: string;
  description: string;
  icon: typeof Activity;
};

const ADMIN_LINKS: Array<{ section: string; items: AdminLink[] }> = [
  {
    section: "Operations",
    items: [
      {
        path: "/admin/ops",
        title: "Ops Dashboard",
        description: "Live order flow, dispatch, ETA accuracy, anomalies.",
        icon: Activity,
      },
      {
        path: "/admin/compliance",
        title: "Compliance & Audits",
        description: "Daily ISO 22000 hygiene statements, cold storage, and supplier origins.",
        icon: ClipboardList,
      },
      {
        path: "/admin/forecasting",
        title: "Demand Forecasting",
        description: "Predicted volumes per dish, kitchen, and slot.",
        icon: LineChart,
      },
      {
        path: "/admin/menu-engineering",
        title: "Menu Engineering",
        description: "Margin × velocity matrix to prune and promote dishes.",
        icon: UtensilsCrossed,
      },
    ],
  },
  {
    section: "Analytics & AI",
    items: [
      {
        path: "/admin/analytics",
        title: "Analytics",
        description: "Revenue, retention, cohort and protocol metrics.",
        icon: BarChart3,
      },
      {
        path: "/admin/ai-runs",
        title: "AI Runs",
        description: "Telemetry of every agent invocation, latency and cost.",
        icon: Brain,
      },
      {
        path: "/admin/ops-agent",
        title: "Ops Agent",
        description: "Conversational console for the ops support agent.",
        icon: Bot,
      },
      {
        path: "/admin/cms-agent",
        title: "CMS Agent",
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
        description: "Queue of flagged dish reviews awaiting decision.",
        icon: ShieldAlert,
      },
      {
        path: "/admin/community-moderation",
        title: "Community Moderation",
        description: "Cohort posts, comments, and member reports.",
        icon: MessageSquare,
      },
      {
        path: "/admin/support-tickets",
        title: "Support Tickets",
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
        description: "Registered Dietitian onboarding applications.",
        icon: FileText,
      },
      {
        path: "/admin/sales-console",
        title: "B2B Sales Console",
        description: "Corporate accounts pipeline and per-company drilldown.",
        icon: Store,
      },
      {
        path: "/rd-console",
        title: "RD Console",
        description: "Dietitian workspace (RD or admin only).",
        icon: ClipboardList,
      },
    ],
  },
];

export const meta: MetaFunction = () => [
  { title: "Admin | Tanmatra" },
  { name: "robots", content: "noindex, nofollow" },
];

export default function AdminIndex() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <header className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.18em] text-nn-primary font-semibold">
          Internal
        </p>
        <h1 className="text-3xl font-serif font-medium text-white">
          Admin Console
        </h1>
        <p className="text-sm text-nn-on-surface-variant max-w-2xl">
          Operational, analytical, and trust &amp; safety surfaces for the
          Tanmatra team. Pages requiring server data also need
          {" "}
          <code className="text-nn-primary">RD_ADMIN_TOKEN</code> set on the
          server and matched in browser localStorage as{" "}
          <code className="text-nn-primary">tanmatra:admin-token:v1</code>.
        </p>
        <div className="flex items-center gap-2 pt-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border border-clinical-sage/40 bg-clinical-sage/10 text-clinical-sage text-[10px] uppercase tracking-[0.12em] font-semibold">
            <Users className="w-3 h-3" />
            Admin mode active
          </span>
        </div>
      </header>

      {ADMIN_LINKS.map((group) => (
        <section key={group.section} className="space-y-3">
          <h2 className="text-[11px] uppercase tracking-[0.18em] text-nn-on-surface-variant font-semibold">
            {group.section}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="group rounded-xl border border-white/[0.08] bg-nn-surface p-4 hover:border-nn-primary/50 hover:bg-nn-surface-high transition-all"
                >
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 w-9 h-9 rounded-lg bg-nn-primary/10 border border-nn-primary/30 flex items-center justify-center group-hover:bg-nn-primary/15">
                      <Icon className="w-4 h-4 text-nn-primary" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white group-hover:text-nn-primary transition-colors">
                        {item.title}
                      </p>
                      <p className="text-xs text-nn-on-surface-variant mt-1 leading-relaxed">
                        {item.description}
                      </p>
                      <p className="text-[10px] text-nn-secondary mt-2 font-mono">
                        {item.path}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
