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
        const res = await fetch(apiPath("/admin/me"), {
          credentials: "include",
        });
        if (cancelled) return;
        setState(res.ok ? "authed" : "anon");
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
