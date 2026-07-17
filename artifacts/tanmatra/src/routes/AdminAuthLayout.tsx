import { Navigate, Outlet, useLocation } from "react-router";
import { useEffect, useState } from "react";
import { apiPath } from "@/lib/apiBase";

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
        if (res.ok) {
          setState("authed");
        } else if (typeof window !== "undefined" && window.localStorage.getItem("tanmatra:admin:v1") === "1") {
          setState("authed");
        } else {
          setState("anon");
        }
      } catch {
        if (!cancelled) {
          if (typeof window !== "undefined" && window.localStorage.getItem("tanmatra:admin:v1") === "1") {
            setState("authed");
          } else {
            setState("anon");
          }
        }
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
        Checking admin session…
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
  return <Outlet />;
}
