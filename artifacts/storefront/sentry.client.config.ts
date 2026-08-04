// The @sentry/nextjs import is dynamic and gated on the DSN so the SDK is
// never fetched in an environment where it has nothing to report to — this
// is the client bundle, and an unconditional static import here shipped the
// full SDK to every browser even with no DSN configured.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.15,
      debug: false,
    });
  });
}
