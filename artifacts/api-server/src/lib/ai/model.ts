import { createVertex } from "@ai-sdk/google-vertex";

// Vertex AI, not the Gemini API — a deliberate migration after 2026-08-15,
// when the agent surface fell over twice in one day on Gemini-API plumbing:
// first the account migration revoked the API key ("API key not valid"),
// then the replacement key hit the AI Studio prepay wallet ("prepayment
// credits are depleted") — a wallet that is separate from Cloud Billing and
// manageable only through the AI Studio UI.
//
// Vertex removes both failure classes at the root:
//   - No API key at all. Auth is Application Default Credentials — on Cloud
//     Run, the service's own runtime service account (granted
//     roles/aiplatform.user). Nothing to mint, store, rotate, or leak.
//   - Billing goes straight to the project's linked Cloud Billing account,
//     postpaid. No prepay wallet to run dry.
//
// The provider is still resolved lazily: this module is imported eagerly via
// the route graph, and a config error at module load would take down every
// non-AI route with it (see git history for the GOOGLE_API_KEY incident).
let cachedProvider: ReturnType<typeof createVertex> | null = null;

function getProvider(): ReturnType<typeof createVertex> {
  if (cachedProvider) return cachedProvider;
  const project = process.env["GOOGLE_VERTEX_PROJECT"];
  if (!project) {
    throw new Error(
      "GOOGLE_VERTEX_PROJECT must be set to use AI features (Vertex AI)",
    );
  }
  cachedProvider = createVertex({
    project,
    // "global" routes to Google's pooled Gemini capacity rather than one
    // region — the SDK maps it to the aiplatform.googleapis.com host.
    location: process.env["GOOGLE_VERTEX_LOCATION"] ?? "global",
  });
  return cachedProvider;
}

// Pinned to the newest GA flash model ON VERTEX, and the reasoning is the
// inverse of the short-lived "gemini-flash-latest" alias this replaces. On
// the Gemini API, a pinned model rotted (the 2.5 line was retired for new
// keys with models.list still advertising it), so the alias was the safe
// choice there. On Vertex the guarantees flip: GA models carry a formal
// deprecation policy with long notice windows, while the -latest alias is
// only PUBLIC_PREVIEW (verified via publishers/google/models on 2026-08-15)
// and previews can change or vanish without one. Pin the GA model; bump it
// deliberately when Google announces a deprecation.
export const DEFAULT_MODEL_ID = "gemini-3.7-flash";

export function getModel(modelId: string = DEFAULT_MODEL_ID) {
  return getProvider()(modelId);
}
