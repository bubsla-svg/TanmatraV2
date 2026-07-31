import { GoogleGenAI, Modality } from "@google/genai";

// Lazy client — see lib/integrations-gemini-ai/src/client.ts for why the
// GOOGLE_API_KEY check must NOT run at module load (it would crash the whole
// API server at startup, since this module is reachable from eager imports).
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

export const ai: GoogleGenAI = new Proxy({} as GoogleGenAI, {
  get(_target, prop) {
    return (getClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

/**
 * OA-MED-1.11 → OA-MED-1.6 (TODO_optimization-auditor.md): image generation
 * had NO timeout at all, unlike every text path (30 s in the agent gateway,
 * 12 s in menuCopy). Image generation is the slowest and most expensive call
 * in the system, and a hung one held a request handler — and, in the bulk CMS
 * tools, a whole batch slot — open indefinitely.
 *
 * Generous relative to the text paths because image generation genuinely
 * takes tens of seconds; the point is a ceiling, not a tight bound. Override
 * per call where a caller knows better.
 *
 * NOTE (from @google/genai's own docs): AbortSignal is client-side only —
 * aborting stops us waiting, it does NOT cancel the upstream operation, and
 * the call is still billed. This bounds latency, not spend.
 */
export const DEFAULT_IMAGE_TIMEOUT_MS = 60_000;

async function withTimeout<T>(
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await run(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

export async function generateImage(
  prompt: string,
  timeoutMs: number = DEFAULT_IMAGE_TIMEOUT_MS
): Promise<{ b64_json: string; mimeType: string }> {
  const response = await withTimeout(timeoutMs, (abortSignal) =>
    ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
        abortSignal,
      },
    }),
  );

  const candidate = response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find(
    (part: { inlineData?: { data?: string; mimeType?: string } }) => part.inlineData
  );

  if (!imagePart?.inlineData?.data) {
    throw new Error("No image data in response");
  }

  return {
    b64_json: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || "image/png",
  };
}

// Edit / transform an existing image with a text instruction.
// The model returns an edited image (e.g. background removed, lighting fixed,
// composition tweaked). Used for background-removal and AI re-touching.
export async function editImage(
  input: {
    prompt: string;
    imageBase64: string;
    mimeType: string;
  },
  timeoutMs: number = DEFAULT_IMAGE_TIMEOUT_MS
): Promise<{ b64_json: string; mimeType: string }> {
  const response = await withTimeout(timeoutMs, (abortSignal) =>
    ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: input.imageBase64,
                mimeType: input.mimeType,
              },
            },
            { text: input.prompt },
          ],
        },
      ],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
        abortSignal,
      },
    }),
  );

  const candidate = response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find(
    (part: { inlineData?: { data?: string; mimeType?: string } }) =>
      part.inlineData
  );

  if (!imagePart?.inlineData?.data) {
    throw new Error("No image data in response");
  }

  return {
    b64_json: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || "image/png",
  };
}
