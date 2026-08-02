"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, LayoutGrid, LogOut } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminUser, logoutAdmin, type AdminUser } from "@/lib/adminApi";
import { ALL_ADMIN_CONSOLES, consoleForPath } from "@/lib/adminConsoles";
import { ApiError } from "@/lib/apiClient";

const ADMIN_ME_KEY = ["admin", "me"] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data: adminRes,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ADMIN_ME_KEY,
    queryFn: async () => await getAdminUser(),
    retry: false,
  });

  const signOut = useMutation({
    mutationFn: async () => {
      try {
        await logoutAdmin();
      } catch {
        // A lapsed session is already signed out — same end state.
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(ADMIN_ME_KEY, null);
      router.replace("/admin/login");
    },
  });

  // Client-side redirect if not authenticated
  useEffect(() => {
    if (isError && error instanceof ApiError && error.status === 401) {
      router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
    } else if (adminRes?.user === null) {
      router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isError, error, adminRes, router, pathname]);

  if (isPending || isError || !adminRes?.user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-surface">
        <p className="text-sm font-medium text-ink-muted">
          {isPending ? "Checking admin session…" : "Redirecting to login…"}
        </p>
      </div>
    );
  }

  const current = consoleForPath(pathname);
  const onIndex = pathname === "/admin";

  return (
    <div className="flex min-h-full flex-col bg-surface">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link
            href="/admin"
            className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-text/50"
          >
            <span className="font-serif text-sm font-medium text-ink">
              Tanmatra
            </span>
            <span className="rounded border border-gold-text/30 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-gold-text">
              Ops ERP
            </span>
          </Link>

          {current && (
            <>
              <span aria-hidden className="text-sm text-ink-muted/30">
                /
              </span>
              <span className="truncate text-sm text-ink-muted">
                {current.title}
              </span>
            </>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {!onIndex && (
              <Link
                href="/admin"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-3 text-xs text-ink-muted transition-colors hover:border-line-dark hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-text/50"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Console
              </Link>
            )}
            <button
              type="button"
              onClick={() => signOut.mutate()}
              disabled={signOut.isPending}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-3 text-xs text-ink-muted transition-colors hover:border-line-dark hover:text-ink disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-text/50"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              {signOut.isPending ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>

        {/* Horizontal console rail. Scrolls rather than wraps so the bar keeps
            a fixed height on narrow ops tablets (the KDS runs on one). */}
        <nav
          aria-label="Admin consoles"
          className="scrollbar-none mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 pb-2"
        >
          <Link
            href="/admin"
            aria-current={onIndex ? "page" : undefined}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-text/50 ${
              onIndex
                ? "border border-gold-text/30 bg-gold-text/10 text-gold-text"
                : "border border-transparent text-ink-muted hover:bg-surface-raised hover:text-ink"
            }`}
          >
            <LayoutGrid className="h-3 w-3" aria-hidden />
            All
          </Link>
          {ALL_ADMIN_CONSOLES.map((item) => {
            const active = current?.path === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                href={item.path}
                aria-current={active ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-text/50 ${
                  active
                    ? "border border-gold-text/30 bg-gold-text/10 text-gold-text"
                    : "border border-transparent text-ink-muted hover:bg-surface-raised hover:text-ink"
                }`}
              >
                <Icon className="h-3 w-3" aria-hidden />
                {item.navLabel}
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="flex-1">{children}</div>
    </div>
  );
}
