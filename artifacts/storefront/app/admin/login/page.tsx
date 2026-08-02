"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { loginAdmin } from "@/lib/adminApi";
import { useQueryClient } from "@tanstack/react-query";

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  
  const rawNext = searchParams?.get("next") ?? "/admin";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/admin";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);

    try {
      const res = await loginAdmin({ username, password });
      
      // Clear react-query cache for admin user since session changed
      queryClient.setQueryData(["admin", "me"], undefined);
      
      router.replace(next);
    } catch (err: any) {
      let msg = "Sign-in failed";
      if (err.status === 401) {
        msg = "Invalid username or password";
      } else if (err.status === 429) {
        msg = "Too many attempts. Try again in a few minutes.";
      } else if (err.message) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
        <div className="mb-6 space-y-2">
          <div className="flex items-center gap-2 text-ink-muted">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">Admin</span>
          </div>
          <h1 className="text-lg font-semibold text-ink">Sign in to the Tanmatra admin</h1>
        </div>
        
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="admin-username" className="text-sm font-medium text-ink">
              Username
            </label>
            <input
              id="admin-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-gold-text focus:ring-1 focus:ring-gold-text"
            />
          </div>
          
          <div className="space-y-1.5">
            <label htmlFor="admin-password" className="text-sm font-medium text-ink">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-gold-text focus:ring-1 focus:ring-gold-text"
            />
          </div>
          
          {error && (
            <div className="text-sm font-medium text-[var(--danger)]" role="alert">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-gold-text py-2 text-sm font-medium text-surface transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
          
          <p className="mt-4 text-xs leading-relaxed text-ink-muted">
            Customers sign in with phone OTP from the regular login page.
            This screen is for the Tanmatra operations team.
          </p>
        </form>
      </div>
    </div>
  );
}
