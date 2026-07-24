"use client";
// Client: the nutrition-coach chat. Session-gated (401 → PhoneAuth). Streams
// replies via streamCoachChat, accumulating text deltas per agent turn and
// rendering any action cards. Prior turns are sent as history each request;
// the session is in-memory (resets on reload). ALL safety is server-side — the
// deterministic clinical-refusal gate, allergen-safe tools, and the mandatory
// disclaimer live in the coach agent, not here.
import { useEffect, useRef, useState } from "react";
import { getAuthUser, type AuthUser } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { streamCoachChat, type CoachAction } from "@/lib/coachApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { CoachActionCard } from "./CoachActionCard";

interface Msg { id: number; role: "user" | "agent"; text: string; actions: CoachAction[] }

export function CoachChat() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  async function loadUser() {
    try { const { user: u } = await getAuthUser(); setUser(u); } catch { setUser(null); }
  }
  useEffect(() => { void loadUser(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    const history = messages.map((m) => ({ role: m.role, text: m.text }));
    const userId = ++idRef.current;
    const agentId = ++idRef.current;
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", text, actions: [] },
      { id: agentId, role: "agent", text: "", actions: [] },
    ]);
    setInput(""); setStreaming(true); setError(null);
    const patch = (fn: (m: Msg) => Msg) => setMessages((prev) => prev.map((m) => (m.id === agentId ? fn(m) : m)));
    try {
      await streamCoachChat({ message: text, history }, (ev) => {
        if (ev.type === "text-delta") patch((m) => ({ ...m, text: m.text + ev.delta }));
        else if (ev.type === "tool-result" && ev.result?.action) {
          const a = ev.result.action;
          patch((m) => ({ ...m, actions: [...m.actions, a] }));
        } else if (ev.type === "finish") patch((m) => ({ ...m, text: m.text || ev.text }));
        else if (ev.type === "error") setError(ev.message);
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { setUser(null); return; }
      setError(e instanceof ApiError && e.status === 429 ? "You've sent a lot of messages — give it a minute." : "Coach is unavailable right now. Please try again.");
    } finally {
      setStreaming(false);
    }
  }

  if (user === undefined) return <p className="text-sm text-ink-muted">Loading…</p>;
  if (user === null) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">Sign in to chat with your nutrition coach.</p>
        <PhoneAuth onVerified={() => void loadUser()} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="self-start rounded-2xl bg-surface px-3 py-2 text-sm text-ink-muted">
            Hi! Ask me to explain a dish&rsquo;s macros, find a higher-protein option, or suggest a swap for your goal.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
            {m.text && (
              <p className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-gold text-[var(--gold-ink)]" : "bg-surface text-ink"}`}>
                {m.text}
              </p>
            )}
            <div className="w-full max-w-[85%]">
              {m.actions.map((a, i) => <CoachActionCard key={i} action={a} />)}
            </div>
          </div>
        ))}
        {error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</p>}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="sticky bottom-2 flex gap-2 bg-bg pt-1">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming}
          aria-label="Message the coach"
          placeholder="Ask your coach…"
          className="flex-1 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-line-strong"
        />
        <button type="submit" disabled={streaming || !input.trim()} className="rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-[var(--gold-ink)] disabled:opacity-40">
          {streaming ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
