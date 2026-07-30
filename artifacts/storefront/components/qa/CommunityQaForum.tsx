"use client";
// Client: community Q&A. Reading is public; asking requires a session (401 →
// PhoneAuth). A failed submission surfaces a real error — this surface never
// fabricates an "answered" thread or a submission that didn't reach the server.
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/apiClient";
import { getAuthUser, type AuthUser } from "@/lib/api";
import { getCommunityQaThreads, submitQuestionThread, type QaThread } from "@/lib/ecosystemApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";

const CATEGORIES = [
  { id: "pcos", label: "PCOS & hormones" },
  { id: "macros", label: "Macronutrient ratios" },
  { id: "general", label: "General care" },
] as const;

const categoryLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id;

export function CommunityQaForum() {
  const [threads, setThreads] = useState<QaThread[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [cat, setCat] = useState<string>("general");
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try { setThreads(await getCommunityQaThreads()); }
    catch { setLoadError("Couldn't load the forum just now."); }
  }, []);

  const loadUser = useCallback(async () => {
    try { const { user: u } = await getAuthUser(); setUser(u); }
    catch { setUser(null); }
  }, []);

  useEffect(() => { void load(); void loadUser(); }, [load, loadUser]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim() || busy) return;
    setBusy(true);
    setSubmitError(null);
    setSubmitted(false);
    try {
      const created = await submitQuestionThread({ questionTitle: title, questionBody: body, category: cat });
      setThreads((p) => [created, ...(p ?? [])]);
      setTitle(""); setBody("");
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) { setUser(null); setSubmitError("Your session expired — sign in again to post your question."); }
      else setSubmitError(err instanceof ApiError ? err.message : "Couldn't send your question. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      <div className="flex flex-col gap-6 lg:col-span-7">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gold-text">Questions answered by our RDs</h2>
        {threads === null ? (
          <p className="text-sm text-ink-muted">{loadError ?? "Loading questions…"}</p>
        ) : threads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-8 text-center">
            <p className="text-sm text-ink-muted">No questions yet — be the first to ask our dietitians.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {threads.map((t) => (
              <article key={t.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-sage-soft px-2.5 py-0.5 text-xs font-semibold text-sage-text">{categoryLabel(t.category)}</span>
                  <span className="text-[11px] font-medium text-ink-muted">{t.authorName}</span>
                </div>
                <h3 className="text-base font-semibold leading-snug text-ink">{t.questionTitle}</h3>
                <p className="text-xs leading-relaxed text-ink-muted">{t.questionBody}</p>
                {t.rdAnswer ? (
                  <div className="mt-1 flex flex-col gap-1 rounded-xl border border-[color-mix(in_srgb,var(--gold)_20%,transparent)] bg-[color-mix(in_srgb,var(--gold)_5%,transparent)] p-3.5">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-gold-text">
                      Answered by {t.rdAnsweredBy || "our RD team"}
                    </div>
                    <p className="text-xs font-medium leading-relaxed text-ink">{t.rdAnswer}</p>
                  </div>
                ) : (
                  <p className="mt-1 rounded-xl border border-line px-3.5 py-3 text-xs text-ink-faint">
                    Awaiting a dietitian&rsquo;s response.
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="sticky top-6 h-fit lg:col-span-5">
        {user === null ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">Ask the board</span>
              <h3 className="mt-1 text-lg font-semibold text-ink">Sign in to ask a question</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                Our registered dietitians answer questions each weekday morning.
              </p>
            </div>
            {submitError && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{submitError}</p>}
            <PhoneAuth onVerified={() => void loadUser()} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">Ask the board</span>
              <h3 className="mt-1 text-lg font-semibold text-ink">Submit a nutrition question</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                Our registered dietitians answer questions each weekday morning.
              </p>
            </div>

            <label className="flex flex-col gap-1.5 text-xs">
              <span className="font-semibold text-ink">Category</span>
              <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-xl border border-line bg-surface p-2.5 font-medium text-ink outline-none focus:border-[var(--gold)]">
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-xs">
              <span className="font-semibold text-ink">Question</span>
              <input
                type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
                placeholder="e.g. Best timing for high-protein lunches?"
                className="rounded-xl border border-line bg-surface p-2.5 text-ink outline-none focus:border-[var(--gold)]"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-xs">
              <span className="font-semibold text-ink">More context</span>
              <textarea
                value={body} onChange={(e) => setBody(e.target.value)} rows={3} required
                placeholder="Describe your routine or the challenge you're working through…"
                className="rounded-xl border border-line bg-surface p-2.5 text-ink outline-none focus:border-[var(--gold)]"
              />
            </label>

            {submitError && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{submitError}</p>}
            {submitted && <p className="text-xs font-medium text-sage-text">Sent — an RD will reply here once they&rsquo;ve reviewed it.</p>}

            <button type="submit" disabled={busy} className="mt-1 rounded-xl bg-gold py-3 text-xs font-semibold text-[var(--gold-ink)] transition-opacity hover:opacity-90 disabled:opacity-40">
              {busy ? "Sending…" : "Send to our RDs →"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
