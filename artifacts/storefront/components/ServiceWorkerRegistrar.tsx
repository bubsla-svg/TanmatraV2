"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js. Client-only by necessity — `navigator.serviceWorker`
 * exists nowhere else — and deferred to `load`, so the worker's install (which
 * precaches the offline shell) never competes with the page's own first-paint
 * requests. Renders nothing.
 *
 * Dev is excluded and actively unregistered: `next dev` serves unhashed,
 * constantly-changing chunks, and a cache-first worker in front of them is a
 * debugging trap. Unregistering also stops a worker installed from a local
 * production build from outliving it on the same localhost origin.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((r) => void r.unregister()));
      return;
    }

    const register = () => {
      // updateViaCache: "none" — the worker script itself must never come from
      // the HTTP cache, or a deploy that changes sw.js can go unnoticed for up
      // to 24 h and keep an evicted cache version live.
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {
          // Registration is a progressive enhancement: it fails in private
          // windows and under some enterprise policies, and the app is fully
          // functional without it. Nothing to recover, nothing to tell the user.
        });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
