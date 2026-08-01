// Dynamic + gated on the DSN — see sentry.client.config.ts for why.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.15,
      debug: false,
    });
  });
}
