const RAW = import.meta.env.VITE_API_BASE as string | undefined;

// Resolution order:
// 1. Explicit VITE_API_BASE always wins.
// 2. Dev: same-origin "/api" — the workspace proxy routes /api/* to the
//    local api-server artifact (no CORS, no hardcoded hosts).
// 3. Production builds without VITE_API_BASE: the wellness-foods Cloud Run
//    URL, so API requests never hit the tanmatra SSR server itself (which
//    has no /api routes and would return 200 HTML, breaking JSON parsing).
export const API_BASE: string = RAW
  ? RAW.replace(/\/+$/, "")
  : import.meta.env.DEV
    ? "/api"
    : "https://wellness-foods-475157072474.asia-south2.run.app/api";

export function apiPath(path: string): string {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}
