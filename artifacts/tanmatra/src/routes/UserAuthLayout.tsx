import { Navigate, Outlet, useLocation } from "react-router";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/apiBase";

type UserAuthState = "checking" | "authed" | "anon";

function useUserAuth(): UserAuthState {
  const [state, setState] = useState<UserAuthState>("checking");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/user`, {
          credentials: "include",
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json() as { user: any };
          setState(data.user ? "authed" : "anon");
        } else {
          setState("anon");
        }
      } catch {
        if (!cancelled) setState("anon");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

export default function UserAuthLayout() {
  const location = useLocation();
  const state = useUserAuth();

  if (state === "checking") {
    return (
      <div className="px-4 py-12 text-center text-sm text-[var(--color-nn-on-surface-variant)]" style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <h1>Checking session…</h1>
        <div style={{ marginTop: 8 }}>
          <a href="/login" className="btn btn-p">Go to Login</a>
        </div>
      </div>
    );
  }
  if (state === "authed") return <Outlet />;
  return (
    <Navigate
      to={`/login?next=${encodeURIComponent(location.pathname)}`}
      replace
    />
  );
}
