import { Navigate, Outlet, useLocation } from "react-router";
import { useEffect, useState } from "react";
import { apiPath } from "@/lib/apiBase";
import { AdminShell } from "@/components/layout/AdminShell";

type RdAuthState = "checking" | "authed" | "anon" | "error";

function useRdAuth(): RdAuthState {
  const [state, setState] = useState<RdAuthState>("checking");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Two distinct identities can legitimately reach this console:
        // (1) internal staff, holding the shared admin-session cookie
        //     (/admin/me) — the "reached from the admin console index" path
        //     the comment below describes, and
        // (2) the dietitian themselves, signed in through the ordinary
        //     customer phone-OTP flow with their own account mapped to an
        //     rd_users row (/rd/console/me returns a non-null rdSlug).
        // Gating on /admin/me alone meant a real RD — who has no admin
        // password and never will — could never get past this layout to
        // reach a console every downstream route (requireRdRole in
        // rdAdvisory.ts) already expects THEM, not staff, to use.
        const [adminRes, rdRes] = await Promise.all([
          fetch(apiPath("/admin/me"), { credentials: "include" }).catch(
            () => null,
          ),
          fetch(apiPath("/rd/console/me"), { credentials: "include" }).catch(
            () => null,
          ),
        ]);
        if (cancelled) return;
        if (adminRes?.ok) {
          setState("authed");
          return;
        }
        if (rdRes?.ok) {
          const data = (await rdRes.json()) as { rdSlug: string | null };
          setState(data.rdSlug ? "authed" : "anon");
          return;
        }
        setState("anon");
      } catch {
        // Network error — redirect to login rather than trust any local state.
        if (!cancelled) setState("anon");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

export default function RdAuthLayout() {
  const location = useLocation();
  const state = useRdAuth();

  if (state === "checking") {
    return (
      <div className="px-4 py-12 text-center text-sm text-[var(--color-nn-secondary)]">
        Checking session…
      </div>
    );
  }
  // Same shell as the Admin ERP — the RD console is reached FROM the admin
  // console index and is gated by the same /admin/me session, so an operator
  // who lands there needs the same way back out. Before this it was the one
  // internal route with no navigation at all.
  if (state === "authed") {
    return (
      <AdminShell>
        <Outlet />
      </AdminShell>
    );
  }
  return (
    <Navigate
      to={`/login?next=${encodeURIComponent(location.pathname)}`}
      replace
    />
  );
}
