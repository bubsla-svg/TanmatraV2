import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Resolve the provider lazily. Throwing at module load made a missing
// GOOGLE_API_KEY fatal to the ENTIRE server: this module is imported
// eagerly (via dishReviews → routes), so a missing key crashed the
// process before it could bind the port — taking down checkout, menu,
// auth and every non-AI route with it. Defer the check to first use so
// only the AI features fail (loudly) when the key is absent, while the
// rest of the API stays up.
let cachedProvider: ReturnType<typeof createGoogleGenerativeAI> | null = null;

function getProvider(): ReturnType<typeof createGoogleGenerativeAI> {
  if (cachedProvider) return cachedProvider;
  const apiKey = process.env["GOOGLE_API_KEY"];
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY must be set to use AI features");
  }
  cachedProvider = createGoogleGenerativeAI({ apiKey });
  return cachedProvider;
}

export const DEFAULT_MODEL_ID = "gemini-2.5-flash";

export function getModel(modelId: string = DEFAULT_MODEL_ID) {
  return getProvider()(modelId);
}
