import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import { setBaseUrl } from "@workspace/api-client-react";
import { API_BASE } from "./lib/apiBase";

// The generated API client emits paths already prefixed with `/api`.
// Point its fetcher at the API origin (API_BASE minus the trailing
// `/api`) so those calls hit the wellness-foods Cloud Run service —
// not the Firebase host, which serves index.html and breaks JSON parsing.
setBaseUrl(API_BASE.replace(/\/api$/, ""));

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>
  );
  // Belt-and-suspenders: also cleared by useEffect in Root after mount
  window.__clearTanmatraLoader?.();
});

// Register service worker for offline support and "Add to Home Screen" eligibility.
// Only active in production — Vite's dev server serves files differently.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
    // SW registration failure is non-fatal.
  });
}

declare global {
  interface Window {
    __clearTanmatraLoader?: () => void;
  }
}
