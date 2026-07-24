/**
 * Coach streaming client's wire contract (injected fetch, no network). Verifies
 * the POST shape and that the NDJSON stream is parsed line-by-line into events
 * (incl. a synthesized book_rd tool-result) + the 401 gate.
 * Run: node --test --import tsx ./lib/coachApi.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "./apiClient";
import { streamCoachChat, type CoachEvent } from "./coachApi";

interface Call { method: string; url: string; credentials?: string; body?: unknown }

/** A fetch whose Response body is a real ReadableStream of NDJSON bytes,
 *  chunked mid-line to prove the buffering reassembles split lines. */
function streamingFetch(calls: Call[], chunks: string[], status = 200): typeof fetch {
  return (async (url: unknown, init: Record<string, unknown>) => {
    calls.push({ method: String(init.method), url: String(url), credentials: init.credentials as string, body: init.body });
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        const enc = new TextEncoder();
        for (const ch of chunks) c.enqueue(enc.encode(ch));
        c.close();
      },
    });
    return { ok: status >= 200 && status < 300, status, statusText: "", body, text: async () => "" };
  }) as unknown as typeof fetch;
}

test("streamCoachChat: POSTs to /api/coach-agent/chat, cookie-authed, body verbatim; parses NDJSON events", async () => {
  const calls: Call[] = [];
  // Deliberately split a JSON object across two chunks to exercise buffering.
  const chunks = [
    '{"type":"text-delta","delta":"That\'s a clinical question."}\n',
    '{"type":"tool-result","name":"book_rd_appointment","result":{"success":true,"action":{"kind":"book_rd","href":"/rd","appointmentsHref":"/appointments","reason":"clinical_diabetes","urgency":"routine",',
    '"premiumConsultsRemaining":null}}}\n',
    '{"type":"finish","text":"That\'s a clinical question.","escalated":true,"refusalReason":"clinical_diabetes"}\n',
  ];
  const events: CoachEvent[] = [];
  const input = { message: "I have diabetes, what should I eat?", history: [{ role: "user" as const, text: "hi" }] };
  await streamCoachChat(input, (ev) => events.push(ev), streamingFetch(calls, chunks));

  const c = calls[0]!;
  assert.equal(c.method, "POST");
  assert.match(c.url, /\/api\/coach-agent\/chat$/);
  assert.equal(c.credentials, "include");
  assert.deepEqual(JSON.parse(String(c.body)), input);

  assert.equal(events.length, 3);
  assert.equal(events[0]!.type, "text-delta");
  const tr = events[1]!;
  assert.equal(tr.type, "tool-result");
  assert.equal(tr.type === "tool-result" && tr.result.action?.kind, "book_rd");
  const fin = events[2]!;
  assert.equal(fin.type === "finish" && fin.refusalReason, "clinical_diabetes");
});

test("streamCoachChat: a non-2xx rejects as a typed ApiError before streaming", async () => {
  const failFetch = (async () => ({ ok: false, status: 401, statusText: "", body: null, text: async () => JSON.stringify({ error: "unauthorized" }) })) as unknown as typeof fetch;
  await assert.rejects(
    streamCoachChat({ message: "hi", history: [] }, () => {}, failFetch),
    (e) => e instanceof ApiError && e.status === 401,
  );
});
