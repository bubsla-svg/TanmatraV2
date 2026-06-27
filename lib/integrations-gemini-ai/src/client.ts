import { GoogleGenAI } from "@google/genai";

// Construct the GenAI client lazily. Doing the GOOGLE_API_KEY check and
// `new GoogleGenAI(...)` at module load made a missing key fatal to every
// importer — including the API server, which pulls this in eagerly through
// the package barrel, so a missing key crashed the whole process at startup
// (taking down checkout, menu and auth, not just AI). Defer to first use so
// only AI calls fail when the key is absent.
let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (client) return client;
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY must be set.");
  }
  client = new GoogleGenAI({ apiKey });
  return client;
}

// Backwards-compatible `ai` export: a lazy proxy that forwards property
// access to the real client, constructed on first touch. `ai.models` still
// returns the genuine nested object so method `this`-binding is preserved.
export const ai: GoogleGenAI = new Proxy({} as GoogleGenAI, {
  get(_target, prop) {
    return (getClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
