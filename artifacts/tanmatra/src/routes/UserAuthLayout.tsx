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
      <div className="px-4 py-12 text-center text-sm text-clinical-zinc">
        Checking session…
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
