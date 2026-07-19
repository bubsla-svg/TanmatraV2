// Re-exports the shared, DB-free subscription cutoff rule from
// @workspace/subscription-rules — the single source of truth shared with the
// web app (artifacts/tanmatra) so the client can grey out Skip/Swap/
// Reschedule inside the exact same window the server enforces with a 409.
// Kept as a thin local module (rather than switching every import site to
// the package directly) so existing relative imports here don't churn.
export { SKIP_SWAP_CUTOFF_MS, isPastSkipCutoff } from "@workspace/subscription-rules";
