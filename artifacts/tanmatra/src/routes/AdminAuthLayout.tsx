import { Navigate, Outlet, useLocation } from "react-router";
import { useEffect, useState } from "react";
import { apiPath } from "@/lib/apiBase";
import { AdminShell } from "@/components/layout/AdminShell";

type AdminAuthState = "checking" | "authed" | "anon";

function useAdminAuth(): AdminAuthState {
  const [state, setState] = useState<AdminAuthState>("checking");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiPath("/admin/me"), {
          credentials: "include",
        });
        if (cancelled) return;
        // Trust only the server session cookie via /admin/me. A client-set
        // localStorage flag is not an auth signal (the API enforces admin
        // scope independently), so never fall back to it.
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

export default function AdminAuthLayout() {
  const location = useLocation();
  const state = useAdminAuth();
  if (state === "checking") {
    return (
      <div className="px-4 py-12 text-center text-sm text-[var(--color-nn-secondary)]">
        <h1 className="text-base font-medium">Checking admin session…</h1>
      </div>
    );
  }
  if (state !== "authed") {
    return (
      <Navigate
        to={`/admin/login?next=${encodeURIComponent(
          location.pathname + location.search,
        )}`}
        replace
      />
    );
  }
  // The console's own chrome. root.tsx suppresses the consumer Header/Footer/
  // BottomNav on every internal route (lib/internalSurfaces.ts) — mounting the
  // shell HERE, inside the authed branch, means the nav appears only once a
  // session is confirmed and never frames the login or the auth-check state.
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
