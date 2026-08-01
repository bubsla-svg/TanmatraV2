// Dynamic + gated on the DSN — see sentry.client.config.ts for why. Less
// critical for bundle size on the server, but there is still no reason to
// pay SDK init cost on every cold start when there is no DSN to report to.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.15,
      debug: false,
    });
  });
}
