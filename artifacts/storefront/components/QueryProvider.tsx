"use client";
// TanStack Query, scoped to client-side islands that fetch-then-mutate
// (account surfaces, favorites, wellness logs, community/marketplace lists —
// see docs/WEB-APP-ENHANCEMENT-PLAN.md's Technical Architecture section).
// Deliberately NOT a replacement for the server-component fetch pattern used
// everywhere else in app/ — that stays as-is for correctness and SEO. This is
// the client cache for the surfaces that were hand-rolling useEffect fetches
// with no dedup, no cache, and (per the empty-state audit) frequently no
// error/retry path either.
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * One QueryClient per browser tab (useState, not module scope) — module scope
 * would leak a signed-in user's cached data across a client-side navigation to
 * a different account in the same tab (rare, but the account-hub islands all
 * key their own queries by nothing more than a fixed string, not a user id).
 *
 * Defaults: no refetch-on-window-focus (this is a food-ordering app someone
 * alt-tabs away from constantly; refetching every account list on every
 * return is churn, not freshness) and one retry (matches the plain-fetch
 * behaviour these islands are replacing — they never retried at all, so one
 * retry is already strictly better, not aggressive).
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: 30_000,
      },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
