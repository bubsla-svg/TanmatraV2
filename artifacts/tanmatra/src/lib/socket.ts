import { io, type Socket } from "socket.io-client";
import { API_BASE } from "./apiBase";

let socket: Socket | null = null;

// The server mounts socket.io at /api/socket.io (see
// api-server/src/lib/realtime.ts). When the SPA and API are on the same
// origin (dev / single-deploy), io() with no URL connects to the page
// origin and we just point `path` at /api/socket.io. When the API is on
// a different origin (e.g. tanmatra.food → wellness-foods.run.app via
// VITE_API_BASE), we derive the API origin from API_BASE and point `path`
// at the socket route relative to that origin.
function deriveSocketTarget(): { url: string | undefined; path: string } {
  // API_BASE is either an absolute URL ("https://host/api") or a relative
  // path like "/api". For the relative case, leave url undefined so
  // socket.io connects to window.location.origin.
  if (/^https?:\/\//i.test(API_BASE)) {
    const u = new URL(API_BASE);
    const apiPath = u.pathname.replace(/\/+$/, ""); // e.g. "/api"
    return {
      url: u.origin,
      path: `${apiPath}/socket.io`,
    };
  }
  const apiPath = API_BASE.replace(/\/+$/, "");
  return { url: undefined, path: `${apiPath}/socket.io` };
}

export function getSocket(): Socket {
  if (socket) return socket;
  const { url, path } = deriveSocketTarget();
  // Bounded reconnection: socket.io-client's default is unbounded retries
  // (with backoff, so not a tight CPU spin, but a persistently-down socket
  // server means indefinite background reconnect attempts forever with no
  // way for the UI to ever say "give up and tell the user"). Capping this
  // and listening for `reconnect_failed` (fired once attempts are
  // exhausted) is what lets useSocketStatus expose a real give-up state.
  const reconnectionOptions = {
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  };
  socket = url
    ? io(url, {
        path,
        transports: ["websocket", "polling"],
        autoConnect: true,
        withCredentials: true,
        ...reconnectionOptions,
      })
    : io({
        path,
        transports: ["polling"],
        autoConnect: true,
        withCredentials: true,
        ...reconnectionOptions,
      });
  return socket;
}
