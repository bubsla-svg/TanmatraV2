import Link from "next/link";
import { Users } from "lucide-react";
import { ADMIN_CONSOLES } from "@/lib/adminConsoles";

export default function AdminIndexPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-text">
          Internal
        </p>
        <h1 className="font-serif text-3xl font-medium text-ink">
          Admin Console
        </h1>
        <p className="max-w-2xl text-sm text-ink-muted">
          Operational, analytical, and trust &amp; safety surfaces for the Tanmatra team.
        </p>
        <div className="flex items-center gap-2 pt-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sage/40 bg-sage/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sage-text">
            <Users className="h-3 w-3" />
            Admin mode active
          </span>
        </div>
      </header>

      {ADMIN_CONSOLES.map((group) => (
        <section key={group.section} className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
            {group.section}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className="group rounded-xl border border-line bg-surface p-4 transition-all hover:border-gold-text/50 hover:bg-surface-raised"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold-text/30 bg-gold-text/10 group-hover:bg-gold-text/15">
                      <Icon className="h-4 w-4 text-gold-text" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink transition-colors group-hover:text-gold-text">
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                        {item.description}
                      </p>
                      <p className="mt-2 font-mono text-[10px] text-ink-faint">
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
