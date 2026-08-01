import { Link, type MetaFunction } from "react-router";
import { Users } from "lucide-react";
// The catalogue moved to lib/ so this grid and the persistent nav in
// AdminShell render the SAME list — see lib/adminConsoles.ts. While it was a
// private const here it had already drifted from routes.ts: /admin/kds and
// /admin/supplier were routed and shipped but listed nowhere, so neither was
// reachable without typing the URL. adminConsoles.test.ts now fails CI on that.
import { ADMIN_CONSOLES } from "@/lib/adminConsoles";

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

      {ADMIN_CONSOLES.map((group) => (
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
