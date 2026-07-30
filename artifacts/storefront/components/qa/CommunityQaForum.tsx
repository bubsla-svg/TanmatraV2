"use client";
// Client: community Q&A. Reading is public; asking requires a session (401 →
// PhoneAuth). A failed submission surfaces a real error — this surface never
// fabricates an "answered" thread or a submission that didn't reach the server.
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, Clock } from "lucide-react";
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
      <div className="flex flex-col gap-4 lg:col-span-8">
        <h2 className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-gold-text">Questions answered by our RDs</h2>
        {threads === null ? (
          <p className="text-sm text-ink-muted">{loadError ?? "Loading questions…"}</p>
        ) : threads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface-subtle p-10 text-center">
            <p className="text-sm text-ink-muted">No questions yet — be the first to ask our dietitians.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {threads.map((t) => (
              <article key={t.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-sage-soft px-3 py-1 font-mono text-[11px] font-semibold tracking-wide text-sage-text">{categoryLabel(t.category)}</span>
                  <span className="text-xs font-medium text-ink-muted">{t.authorName}</span>
                </div>
                <h3 className="text-lg font-semibold leading-snug text-ink">{t.questionTitle}</h3>
                <p className="text-sm leading-relaxed text-ink-muted">{t.questionBody}</p>
                {t.rdAnswer ? (
                  <div className="mt-1 flex flex-col gap-1.5 rounded-xl border border-[color-mix(in_srgb,var(--gold)_35%,transparent)] bg-[color-mix(in_srgb,var(--gold)_7%,transparent)] p-4">
                    <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wide text-gold-text">
                      <BadgeCheck aria-hidden className="h-3.5 w-3.5 shrink-0" />
                      Answered by {t.rdAnsweredBy || "our RD team"}
                    </div>
                    <p className="text-sm leading-relaxed text-ink">{t.rdAnswer}</p>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center gap-2 border-t border-line pt-3 text-ink-faint">
                    <Clock aria-hidden className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-xs italic">Awaiting a dietitian&rsquo;s response.</span>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="sticky top-6 h-fit lg:col-span-4">
        {user === null ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 shadow-sm">
            <div>
              <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-gold-text">Ask the board</span>
              <h3 className="mt-1 text-xl font-semibold text-ink">Sign in to ask a question</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                Our registered dietitians answer questions each weekday morning.
              </p>
            </div>
            {submitError && (
              <p role="alert" className="rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] px-3.5 py-2.5 text-xs font-semibold text-[var(--danger)]">
                {submitError}
              </p>
            )}
            <PhoneAuth onVerified={() => void loadUser()} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 shadow-sm">
            <div>
              <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-gold-text">Ask the board</span>
              <h3 className="mt-1 text-xl font-semibold text-ink">Submit a nutrition question</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                Our registered dietitians answer questions each weekday morning.
              </p>
            </div>

            <label className="flex flex-col gap-1.5 text-xs">
              <span className="font-semibold text-ink">Category</span>
              <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-full border border-line bg-surface px-4 py-2.5 font-medium text-ink outline-none focus:border-[var(--gold)]">
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-xs">
              <span className="font-semibold text-ink">Question</span>
              <input
                type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
                placeholder="e.g. Best timing for high-protein lunches?"
                className="rounded-full border border-line bg-surface px-4 py-2.5 text-ink outline-none focus:border-[var(--gold)]"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-xs">
              <span className="font-semibold text-ink">More context</span>
              <textarea
                value={body} onChange={(e) => setBody(e.target.value)} rows={3} required
                placeholder="Describe your routine or the challenge you're working through…"
                className="rounded-2xl border border-line bg-surface p-3.5 text-ink outline-none focus:border-[var(--gold)]"
              />
            </label>

            {submitError && (
              <p role="alert" className="rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] px-3.5 py-2.5 text-xs font-semibold text-[var(--danger)]">
                {submitError}
              </p>
            )}
            {submitted && (
              <p className="rounded-xl border border-sage/40 bg-sage-soft px-3.5 py-2.5 text-xs font-semibold text-sage-text">
                Sent — an RD will reply here once they&rsquo;ve reviewed it.
              </p>
            )}

            <button type="submit" disabled={busy} className="mt-1 flex items-center justify-center gap-2 rounded-full bg-gold py-3 text-xs font-semibold text-[var(--gold-ink)] transition-opacity hover:opacity-90 disabled:opacity-40">
              {busy ? "Sending…" : (
                <>
                  Send to our RDs
                  <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
