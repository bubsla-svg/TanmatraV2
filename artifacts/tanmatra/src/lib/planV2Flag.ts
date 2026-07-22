// Client-side gate for the 02-series commercial rebuild (roadmap slice S10
// cut-over draft). Mirrors the server's FLAG_PLAN_V2. Default OFF, so the
// build ships the new surfaces dark: the /plan-v2 route is inert (redirects to
// the live /subscribe) until a reviewer sets VITE_FLAG_PLAN_V2 and points the
// api-server at its own FLAG_PLAN_V2. Nothing in the default nav links here, so
// real users never reach it until the cut-over flips both flags.
export function planV2Enabled(): boolean {
  const v = import.meta.env.VITE_FLAG_PLAN_V2;
  return v === "true" || v === "1" || v === "on";
}
