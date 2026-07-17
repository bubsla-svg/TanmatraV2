import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  subscriptionsApi,
  CADENCE_LABEL,
  type Subscription,
  type SubscriptionDelivery,
  type SubscriptionMember,
  type SubscriptionItem,
  type MealCredit,
  type CreateSubscriptionInput,
} from "@/lib/subscriptionsApi";
import { loyaltyApi } from "@/lib/loyaltyApi";
import { track } from "@/lib/analytics";
import { useMenuCatalog } from "@/lib/menuData";
import { whatsappLink } from "@/lib/support";
import type { DishData } from "@/lib/menuData";
import { usePreferences } from "@/lib/preferencesContext";
import { evaluateDishForPreferences } from "@/lib/preferencesMatch";

interface LoyaltyProgress {
  subscriptionId: number;
  deliveredCount: number;
  freeEveryN: number;
  deliveriesUntilFree: number;
  premiumUnlockAt: number;
  deliveriesUntilPremium: number;
  premiumUnlocked: boolean;
}

interface Detail {
  subscription: Subscription;
  members: SubscriptionMember[];
  deliveries: SubscriptionDelivery[];
}

// v2 status → pill styling (mirrors the old STATUS_BADGE semantics)
const STATUS_META: Record<
  Subscription["status"],
  { label: string; dot: string; pillStyle: React.CSSProperties }
> = {
  active: {
    label: "Active",
    dot: "var(--sage)",
    pillStyle: { background: "var(--saged)", color: "var(--sage)" },
  },
  paused: {
    label: "Paused",
    dot: "var(--safb)",
    pillStyle: { background: "var(--safd)", color: "var(--safb)" },
  },
  cancelled: {
    label: "Cancelled",
    dot: "var(--dgr)",
    pillStyle: { background: "color-mix(in oklab, var(--color-error) 16%, transparent)", color: "var(--dgr)" },
  },
};

const DELIVERY_META: Record<
  SubscriptionDelivery["status"],
  { label: string; style: React.CSSProperties }
> = {
  upcoming: {
    label: "Upcoming",
    style: { background: "var(--safd)", color: "var(--safb)" },
  },
  paused: {
    label: "Paused",
    style: { background: "var(--s3)", color: "var(--mut)" },
  },
  skipped: {
    label: "Skipped",
    style: { background: "var(--safd)", color: "var(--safb)" },
  },
  delivered: {
    label: "Delivered",
    style: { background: "var(--saged)", color: "var(--sage)" },
  },
  cancelled: {
    label: "Cancelled",
    style: { background: "color-mix(in oklab, var(--color-error) 16%, transparent)", color: "var(--dgr)" },
  },
};

const TIME_WINDOWS = [
  "07:00 - 08:00",
  "12:00 - 13:00",
  "13:00 - 14:00",
  "19:00 - 20:00",
  "20:00 - 21:00",
];

// A trial subscription is one-off (see subscriptions.ts). Detect it from the
// canonical / legacy notes markers the server writes so the dashboard shows
// trial-appropriate controls (no "add more", plus a convert-to-plan CTA).
function isTrialSub(s: Subscription): boolean {
  return !!s.notes && /3-day (trial )?pack/i.test(s.notes);
}

function formatPrice(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

function planTitle(s: Subscription): string {
  if (isTrialSub(s)) return "3-Day Trial Pack";
  // RD-plan subscriptions carry "RD Plan: <name>" in notes — surface the
  // actual plan name (e.g. "Weight-Loss Jumpstart") instead of the generic
  // cadence label so the dashboard reads like the thing the customer bought.
  const rdMatch = /^RD Plan:\s*(.+)$/.exec(s.notes ?? "");
  if (rdMatch) return rdMatch[1];
  return `${CADENCE_LABEL[s.cadence]} Plan`;
}

function daysUntil(iso: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

function relativeDay(iso: string): string {
  const d = daysUntil(iso);
  if (d < 0) return "Past due";
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return `In ${d} days`;
}

// compact inline styling for the row of manage-actions
const ACT: React.CSSProperties = {
  height: 38,
  padding: "0 12px",
  fontSize: 13,
  borderRadius: 9,
};

function Shell({
  children,
  rightHref,
}: {
  children: React.ReactNode;
  rightHref?: string;
}) {
  return (
    <div className="tnm2 nn min-h-screen bg-[var(--tnm-surface-ink)] text-white antialiased">
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="appbar">
          <Link className="iconbtn" to="/" aria-label="Home">
            <i className="ph-bold ph-arrow-left" />
          </Link>
          <div className="abt">Subscriptions</div>
          {rightHref && (
            <Link className="iconbtn" to={rightHref} title="New plan" aria-label="New plan">
              <i className="ph-bold ph-plus-circle" />
            </Link>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

export default function V2Subscriptions() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [credits, setCredits] = useState<{ balance: number; rows: MealCredit[] }>({
    balance: 0,
    rows: [],
  });
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [progress, setProgress] = useState<Record<number, LoyaltyProgress>>({});
  const [reschedDelivery, setReschedDelivery] =
    useState<SubscriptionDelivery | null>(null);
  const [reschedDate, setReschedDate] = useState("");
  const [reschedWindow, setReschedWindow] = useState(TIME_WINDOWS[1]);
  const [windowEditOpen, setWindowEditOpen] = useState(false);
  const [pendingWindow, setPendingWindow] = useState(TIME_WINDOWS[1]);
  const [swapDelivery, setSwapDelivery] = useState<SubscriptionDelivery | null>(null);

  const refreshList = useCallback(async () => {
    try {
      const [list, c, p] = await Promise.all([
        subscriptionsApi.list(),
        subscriptionsApi.credits(),
        loyaltyApi.getLoyaltyProgress().catch(() => ({ progress: [] })),
      ]);
      setSubs(list.subscriptions);
      setCredits({ balance: c.balance, rows: c.credits });
      setProgress(
        Object.fromEntries(p.progress.map((row) => [row.subscriptionId, row])),
      );
      if (list.subscriptions.length > 0 && activeId === null) {
        setActiveId(list.subscriptions[0].id);
      }
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        setUnauthorized(true);
      } else {
        toast.error("Failed to load subscriptions");
      }
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  const refreshDetail = useCallback(async (id: number) => {
    try {
      const d = await subscriptionsApi.get(id);
      setDetail(d);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  useEffect(() => {
    if (activeId !== null) refreshDetail(activeId);
  }, [activeId, refreshDetail]);

  const wrap = async <T,>(p: Promise<T>, msg: string) => {
    try {
      await p;
      toast.success(msg);
      if (activeId !== null) await refreshDetail(activeId);
      await refreshList();
    } catch (err) {
      const m = err instanceof Error ? err.message : "Error";
      toast.error("Action failed", { description: m });
    }
  };

  // ---------- Post-trial → recurring bridge (the conversion moment) ----------
  // A trial is a one-off 3-day sampler. Rather than send the customer back to
  // /plans to rebuild from scratch, carry the exact meals / eaters / window
  // they sampled into a recurring weekly plan in one tap.
  const [continuing, setContinuing] = useState(false);
  const handleContinueTrial = useCallback(async () => {
    if (!detail) return;
    const { subscription: s, members, deliveries } = detail;
    const sampledItems: SubscriptionItem[] =
      deliveries.find((d) => d.items.length > 0)?.items ?? [];
    const startDate = new Date(Date.now() + 86_400_000)
      .toISOString()
      .slice(0, 10); // tomorrow
    const input: CreateSubscriptionInput = {
      cadence: "weekly",
      mealsPerDelivery: s.mealsPerDelivery,
      deliveryWindow: s.deliveryWindow,
      startDate,
      planType: "standard",
      addressLabel: s.addressLabel ?? undefined,
      addressLine: s.addressLine ?? undefined,
      city: s.city ?? undefined,
      pincode: s.pincode ?? undefined,
      phone: s.phone ?? undefined,
      // Plain note (no "3-day pack" marker) so this recurring plan is never
      // re-detected as a trial by isTrialSub / the server's trial matcher.
      notes: "Recurring plan (continued from a trial)",
      members: members.map((m) => ({
        name: m.name,
        diet: m.diet,
        allergens: m.allergens,
        lifestyle: m.lifestyle ?? undefined,
        spiceLevel: m.spiceLevel ?? "medium",
      })),
      defaultItems: sampledItems,
    };
    track("post_trial_continue_clicked", {
      trialSubscriptionId: s.id,
      meals: s.mealsPerDelivery,
    });
    setContinuing(true);
    try {
      const { subscription: created } = await subscriptionsApi.create(input);
      track("post_trial_continue_success", { newSubscriptionId: created.id });
      toast.success("Your weekly plan is set — welcome aboard!");
      await refreshList();
      setActiveId(created.id);
    } catch (err) {
      toast.error("Couldn't start your plan", {
        description: err instanceof Error ? err.message : "Error",
      });
    } finally {
      setContinuing(false);
    }
  }, [detail, refreshList]);

  // ---------- Destructive-action safeguards ----------
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [skipConfirm, setSkipConfirm] = useState<{ deliveryId: number; date: string } | null>(null);

  if (unauthorized) {
    return (
      <Shell>
        <div className="content padx" style={{ paddingTop: 8 }}>
          <div className="tc" style={{ padding: "52px 20px" }}>
            <i
              className="ph-bold ph-calendar-check"
              style={{ fontSize: 34, color: "var(--safb)" }}
            />
            <div className="tt mt10">Sign in to manage plans</div>
            <div className="fine mt6">
              Subscriptions are tied to your Tanmatra account.
            </div>
            <Link className="btn btn-p mt20" to="/login?next=/subscriptions">
              Sign In
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  if (loading) {
    return (
      <Shell>
        <div className="content padx" style={{ paddingTop: 8 }}>
          <div className="skel" style={{ height: 20, width: "55%" }} />
          <div className="skel mt8" style={{ height: 12, width: "80%" }} />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card mt12">
              <div className="skel" style={{ height: 16, width: "60%" }} />
              <div className="skel mt8" style={{ height: 12, width: "90%" }} />
              <div className="skel mt8" style={{ height: 46, width: "100%" }} />
            </div>
          ))}
        </div>
      </Shell>
    );
  }

  if (subs.length === 0) {
    return (
      <Shell>
        <div className="content padx" style={{ paddingTop: 8 }}>
          <div className="tc" style={{ padding: "44px 12px" }}>
            <i
              className="ph-fill ph-sparkle"
              style={{ fontSize: 34, color: "var(--safb)" }}
            />
            <div className="h2 mt10" style={{ color: "var(--text-primary)" }}>
              No active plans yet
            </div>
            <div className="fine mt6" style={{ maxWidth: 300, margin: "6px auto 0" }}>
              Start with a 3-day trial at 25% off, or set up a recurring plan to
              lock in your delivery window and earn cadence discounts.
            </div>
            <div className="fx ac jc wrap gap8 mt20">
              <Link className="btn btn-p" to="/subscribe?trial=1">
                <i className="ph-bold ph-gift" /> Start 3-day trial
              </Link>
              <Link className="btn btn-g" to="/plans">
                See all plans
              </Link>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  const activeProgress = activeId !== null ? progress[activeId] : undefined;

  return (
    <Shell rightHref="/subscription-plans">
      <div className="content" style={{ paddingBottom: 24 }}>
        {/* Hero + wallet */}
        <div className="padx" style={{ paddingTop: 4 }}>
          <h1 className="h2" style={{ color: "var(--text-primary)" }}>
            Your subscriptions
          </h1>
          <div className="fine mt4">
            {subs.length} plan{subs.length === 1 ? "" : "s"} · {credits.balance} meal
            credit{credits.balance === 1 ? "" : "s"} in your wallet
          </div>

          <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 fx ac jb gap12 mt12">
            <div className="fx ac gap10">
              <div className="dic" style={{ color: "var(--safb)" }}>
                <i className="ph-fill ph-wallet" />
              </div>
              <div>
                <div className="lab">Wallet</div>
                <div className="price safc" style={{ fontSize: 16 }}>
                  {credits.balance} meals
                </div>
              </div>
            </div>
            <Link className="btn btn-p" to="/plans" style={ACT}>
              <i className="ph-bold ph-plus-circle" /> New plan
            </Link>
          </div>

          <a
            href={whatsappLink("Hi! I need help with my Tanmatra subscription.")}
            target="_blank"
            rel="noopener noreferrer"
            className="linkq mt10"
          >
            <i className="ph-fill ph-whatsapp-logo" /> Need help? WhatsApp us
          </a>
        </div>

        {/* Plan switcher (only when more than one) */}
        {subs.length > 1 && (
          <div className="chiprow" role="group" aria-label="Switch plan">
            {subs.map((s) => {
              const active = s.id === activeId;
              const meta = STATUS_META[s.status];
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveId(s.id)}
                  className={active ? "chip on" : "chip"}
                >
                  {planTitle(s)}
                  <span
                    title={meta.label}
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: meta.dot,
                      flex: "none",
                    }}
                  />
                </button>
              );
            })}
          </div>
        )}

        {detail && (
          <DetailView
            detail={detail}
            progress={!isTrialSub(detail.subscription) ? activeProgress : undefined}
            onPause={() =>
              wrap(subscriptionsApi.pause(detail.subscription.id), "Subscription paused")
            }
            onResume={() =>
              wrap(subscriptionsApi.resume(detail.subscription.id), "Subscription resumed")
            }
            onCancel={() => setCancelConfirmOpen(true)}
            onEditWindow={() => {
              setPendingWindow(detail.subscription.deliveryWindow);
              setWindowEditOpen(true);
            }}
            onGenerateMore={() =>
              wrap(
                subscriptionsApi.generateNext(detail.subscription.id),
                "Added 4 more deliveries",
              )
            }
            onSkip={(d) => setSkipConfirm({ deliveryId: d.id, date: d.scheduledFor })}
            onSwap={(d) => setSwapDelivery(d)}
            onReschedule={(d) => {
              setReschedDelivery(d);
              setReschedDate(new Date(d.scheduledFor).toISOString().slice(0, 10));
              setReschedWindow(d.deliveryWindow);
            }}
            onContinueTrial={handleContinueTrial}
            continuing={continuing}
          />
        )}
      </div>

      {/* Swap dish picker */}
      {detail && (
        <SwapDialog
          delivery={swapDelivery}
          mealsPerDelivery={detail.subscription.mealsPerDelivery}
          onClose={() => setSwapDelivery(null)}
          onConfirm={async (items) => {
            if (!swapDelivery) return;
            await wrap(
              subscriptionsApi.swap(swapDelivery.id, items),
              "Delivery updated",
            );
            setSwapDelivery(null);
          }}
        />
      )}

      {/* Edit delivery window */}
      {windowEditOpen && (
        <div
          className="tnm2 nn bg-[color-mix(in_srgb,var(--tnm-surface-ink)_95%,transparent)] backdrop-blur-md"
          style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setWindowEditOpen(false)}
        >
          <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4" style={{ maxWidth: 460, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div className="tt fx ac gap8" style={{ color: "var(--text-primary)" }}>
              <i className="ph-bold ph-clock safc" /> Update delivery window
            </div>
            <div className="fine mt6">
              The new window applies to every upcoming delivery on this plan.
            </div>
            <div className="fx wrap g6 mt12">
              {TIME_WINDOWS.map((w) => (
                <button
                  key={w}
                  onClick={() => setPendingWindow(w)}
                  className={w === pendingWindow ? "chip on" : "chip"}
                >
                  {w}
                </button>
              ))}
            </div>
            <div className="fx gap8 mt16" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-g" style={ACT} onClick={() => setWindowEditOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-p"
                style={ACT}
                onClick={async () => {
                  if (!detail) return;
                  await wrap(
                    subscriptionsApi.updateDeliveryWindow(
                      detail.subscription.id,
                      pendingWindow,
                    ),
                    "Delivery window updated",
                  );
                  setWindowEditOpen(false);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule delivery */}
      {reschedDelivery !== null && (
        <div
          className="tnm2 nn bg-[color-mix(in_srgb,var(--tnm-surface-ink)_95%,transparent)] backdrop-blur-md"
          style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setReschedDelivery(null)}
        >
          <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4" style={{ maxWidth: 460, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div className="tt fx ac gap8" style={{ color: "var(--text-primary)" }}>
              <i className="ph-bold ph-clock safc" /> Reschedule delivery
            </div>
            <div className="mt12">
              <div className="lab mb6">New date</div>
              <div className="inp">
                <i className="ph-bold ph-calendar-dots" />
                <input
                  type="date"
                  value={reschedDate}
                  onChange={(e) => setReschedDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  style={{ colorScheme: "dark" }}
                />
              </div>
            </div>
            <div className="mt12">
              <div className="lab mb6">Window</div>
              <div className="fx wrap g6">
                {TIME_WINDOWS.map((w) => (
                  <button
                    key={w}
                    onClick={() => setReschedWindow(w)}
                    className={w === reschedWindow ? "chip on" : "chip"}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
            <div className="fx gap8 mt16" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-g" style={ACT} onClick={() => setReschedDelivery(null)}>
                Cancel
              </button>
              <button
                className="btn btn-p"
                style={ACT}
                onClick={async () => {
                  if (!reschedDelivery) return;
                  await wrap(
                    subscriptionsApi.reschedule(
                      reschedDelivery.id,
                      new Date(reschedDate).toISOString(),
                      reschedWindow,
                    ),
                    "Delivery rescheduled",
                  );
                  setReschedDelivery(null);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------ Cancel confirmation (destructive) ------ */}
      {cancelConfirmOpen && (
        <div
          className="tnm2 nn bg-[color-mix(in_srgb,var(--tnm-surface-ink)_95%,transparent)] backdrop-blur-md"
          style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setCancelConfirmOpen(false)}
        >
          <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4" style={{ maxWidth: 440, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div className="tt" style={{ color: "var(--text-primary)" }}>
              Cancel this subscription?
            </div>
            <div className="fine mt6">
              All upcoming deliveries will be cancelled. Any prepaid credits
              remain on your account and can be used for one-off orders. You can
              re-subscribe at any time, but you'll lose your current delivery
              window. This action cannot be undone.
            </div>
            <div className="fx gap8 mt16" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-g" style={ACT} onClick={() => setCancelConfirmOpen(false)}>
                Keep subscription
              </button>
              <button
                className="btn"
                style={{ ...ACT, background: "var(--color-error)", color: "var(--color-stone-0)" }}
                onClick={() => {
                  setCancelConfirmOpen(false);
                  if (detail) {
                    void wrap(
                      subscriptionsApi.cancel(detail.subscription.id),
                      "Subscription cancelled",
                    );
                  }
                }}
              >
                Yes, cancel subscription
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------ Skip-delivery confirmation ------ */}
      {skipConfirm !== null && (
        <div
          className="tnm2 nn bg-[color-mix(in_srgb,var(--tnm-surface-ink)_95%,transparent)] backdrop-blur-md"
          style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setSkipConfirm(null)}
        >
          <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4" style={{ maxWidth: 440, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div className="tt" style={{ color: "var(--text-primary)" }}>
              Skip this delivery?
            </div>
            <div className="fine mt6">
              {skipConfirm
                ? `We'll skip your ${new Date(skipConfirm.date).toLocaleDateString(
                    "en-IN",
                    { weekday: "long", day: "numeric", month: "short" },
                  )} delivery and credit the value back to your wallet. The next delivery in your schedule is unaffected.`
                : ""}
            </div>
            <div className="fx gap8 mt16" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-g" style={ACT} onClick={() => setSkipConfirm(null)}>
                Keep delivery
              </button>
              <button
                className="btn btn-p"
                style={ACT}
                onClick={() => {
                  if (skipConfirm) {
                    void wrap(
                      subscriptionsApi.skip(skipConfirm.deliveryId),
                      "Delivery skipped — credits added",
                    );
                    setSkipConfirm(null);
                  }
                }}
              >
                Yes, skip
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

function LoyaltyStrip({ pr }: { pr: LoyaltyProgress }) {
  const cycleDone = pr.freeEveryN - pr.deliveriesUntilFree;
  const cyclePct = Math.min(100, (cycleDone / pr.freeEveryN) * 100);
  const premPct = Math.min(100, (pr.deliveredCount / pr.premiumUnlockAt) * 100);
  return (
    <div className="fx gap12 mt12">
      <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 f1">
        <div className="fx ac jb">
          <span className="lab">Next free meal</span>
          <span className="mono fine">
            {cycleDone}/{pr.freeEveryN}
          </span>
        </div>
        <div className="pbar mt8">
          <b style={{ width: `${cyclePct}%`, background: "var(--tnm-action)" }} />
        </div>
        <div className="fine sagec mt6">
          {pr.deliveriesUntilFree} more deliver
          {pr.deliveriesUntilFree === 1 ? "y" : "ies"} to a free meal
        </div>
      </div>
      <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 f1">
        <div className="fx ac jb">
          <span className="lab">Chef's tier</span>
          <span className="mono fine">
            {pr.premiumUnlocked ? "Unlocked" : `${pr.deliveredCount}/${pr.premiumUnlockAt}`}
          </span>
        </div>
        <div className="pbar mt8">
          <b style={{ width: `${pr.premiumUnlocked ? 100 : premPct}%` }} />
        </div>
        <div className="fine mt6">
          {pr.premiumUnlocked
            ? "Chef specials unlocked on this plan"
            : `${pr.deliveriesUntilPremium} deliveries to unlock chef specials`}
        </div>
      </div>
    </div>
  );
}

function DateBox({ iso, big }: { iso: string; big?: boolean }) {
  const d = new Date(iso);
  return (
    <div
      className="tc"
      style={{
        background: "var(--safd)",
        border: "1px solid var(--saf)",
        borderRadius: 10,
        padding: "6px 8px",
        minWidth: big ? 56 : 46,
        flex: "none",
      }}
    >
      <div className="lab">{d.toLocaleString("en-IN", { weekday: "short" })}</div>
      <div
        className="price safc"
        style={{ fontSize: big ? 24 : 17, lineHeight: 1.1 }}
      >
        {d.getDate()}
      </div>
      <div className="lab">{d.toLocaleString("en-IN", { month: "short" })}</div>
    </div>
  );
}

function DetailView({
  detail,
  progress,
  onPause,
  onResume,
  onCancel,
  onEditWindow,
  onGenerateMore,
  onSkip,
  onSwap,
  onReschedule,
  onContinueTrial,
  continuing,
}: {
  detail: Detail;
  progress?: LoyaltyProgress;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onEditWindow: () => void;
  onGenerateMore: () => void;
  onSkip: (d: SubscriptionDelivery) => void;
  onSwap: (d: SubscriptionDelivery) => void;
  onReschedule: (d: SubscriptionDelivery) => void;
  onContinueTrial: () => void;
  continuing: boolean;
}) {
  const { subscription: s, members, deliveries } = detail;
  const meta = STATUS_META[s.status];
  const trial = isTrialSub(s);
  const upcoming = deliveries.filter((d) => d.status === "upcoming");
  const nextDelivery = upcoming[0];
  const laterDeliveries = deliveries.filter((d) => d.id !== nextDelivery?.id);

  return (
    <div className="padx" style={{ paddingTop: 14 }}>
      {/* Plan summary + economics */}
      <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4">
        <div className="fx ac wrap g6">
          <span className="tt">{planTitle(s)}</span>
          <span className="pill" style={meta.pillStyle}>
            {meta.label}
          </span>
          {trial && (
            <span
              className="pill"
              style={{ background: "var(--safd)", color: "var(--safb)" }}
            >
              One-off
            </span>
          )}
        </div>

        <div className="fine mt6 fx wrap" style={{ columnGap: 14, rowGap: 4 }}>
          <span className="price" style={{ color: "var(--tx)" }}>
            {formatPrice(s.pricePerDeliveryPaise)}
            <span className="fntc" style={{ fontWeight: 400 }}> / delivery</span>
          </span>
          <span>{s.mealsPerDelivery} meals</span>
          <span className="fx ac" style={{ gap: 4 }}>
            <i className="ph-bold ph-clock" /> {s.deliveryWindow}
          </span>
          <span className="fx ac" style={{ gap: 4 }}>
            <i className="ph-bold ph-map-pin" /> {s.addressLabel ?? "Home"}
            {s.city ? ` · ${s.city}` : ""}
          </span>
        </div>

        {/* manage actions */}
        <div className="fx wrap gap8 mt12">
          {s.status === "active" && (
            <button
              className="btn btn-g"
              style={{ ...ACT, color: "var(--safb)" }}
              onClick={onPause}
            >
              <i className="ph-bold ph-pause" /> Pause
            </button>
          )}
          {s.status === "paused" && (
            <button
              className="btn btn-g"
              style={{ ...ACT, color: "var(--sage)" }}
              onClick={onResume}
            >
              <i className="ph-bold ph-play" /> Resume
            </button>
          )}
          {!trial && (
            <button className="btn btn-g" style={ACT} onClick={onEditWindow}>
              <i className="ph-bold ph-clock" /> Edit window
            </button>
          )}
          {!trial && s.status === "active" && (
            <button
              className="btn btn-g"
              style={{ ...ACT, color: "var(--safb)" }}
              onClick={onGenerateMore}
            >
              <i className="ph-bold ph-arrows-clockwise" /> Add 4 more
            </button>
          )}
          {s.status !== "cancelled" && (
            <button
              className="btn btn-g"
              style={{ ...ACT, color: "var(--dgr)", borderColor: "transparent" }}
              onClick={onCancel}
              aria-label="Cancel this subscription"
            >
              <i className="ph-bold ph-x-circle" /> Cancel
            </button>
          )}
        </div>

        {s.status === "paused" && (
          <div
            className="note mt12"
            style={{
              background: "var(--safd)",
              borderColor: "color-mix(in oklab, var(--color-warning) 35%, transparent)",
              color: "var(--safb)",
            }}
          >
            <i className="ph-bold ph-pause-circle" />
            <span>This plan is paused — no deliveries or charges until you resume.</span>
          </div>
        )}

        {/* eaters */}
        <div
          className="fx ac wrap g6 mt12"
          style={{ paddingTop: 12, borderTop: "1px solid var(--ln)" }}
        >
          <i className="ph-bold ph-users fntc" />
          <span className="fine">Eaters:</span>
          {members.map((m) => (
            <span key={m.id} className="pill">
              {m.name}
              {m.lifestyle ? ` · ${m.lifestyle}` : ""}
              {m.allergens.length > 0 ? ` · no ${m.allergens.join("/")}` : ""}
            </span>
          ))}
        </div>
      </div>

      {/* Post-trial → recurring bridge (the conversion moment). Recaps exactly
          what the customer sampled and continues the SAME setup in one tap,
          instead of a rebuild-from-scratch on /plans. */}
      {trial && s.status !== "cancelled" && (
        <div
          className="rounded-2xl border border-[var(--tnm-action)]/30 bg-[var(--tnm-action)]/10 p-4 mt12"
        >
          <div className="tt" style={{ color: "var(--text-primary)" }}>
            Keep your plan going
          </div>
          <div className="fine mt4">
            You sampled {s.mealsPerDelivery} meals
            {members.length > 0
              ? ` for ${members.map((m) => m.name).join(", ")}`
              : ""}
            , delivered {s.deliveryWindow}. Continue the exact same setup as a
            recurring <strong>weekly</strong> plan — lock your window, save up to
            15%, and earn a free meal every few deliveries. Pause, swap or cancel
            anytime.
          </div>
          <button
            className="btn btn-p btn-blk mt12"
            onClick={onContinueTrial}
            disabled={continuing}
          >
            {continuing ? (
              "Setting up your plan…"
            ) : (
              <>
                Continue my plan — subscribe &amp; save{" "}
                <i className="ph-bold ph-arrow-right" />
              </>
            )}
          </button>
          <Link
            to="/plans"
            className="fine mt10"
            style={{ display: "block", textAlign: "center", color: "var(--safb)" }}
          >
            Or choose a different plan
          </Link>
        </div>
      )}

      {/* Loyalty (recurring only) */}
      {progress && <LoyaltyStrip pr={progress} />}

      {/* Next delivery — hero */}
      {nextDelivery && (
        <>
          <div className="lab mt20 mb10">Next delivery</div>
          <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-[var(--tnm-action)] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4">
            <div className="fx ac gap12">
              <DateBox iso={nextDelivery.scheduledFor} big />
              <div className="f1" style={{ minWidth: 0 }}>
                <div className="tt">{relativeDay(nextDelivery.scheduledFor)}</div>
                <div className="fine mt2 fx ac" style={{ gap: 4 }}>
                  <i className="ph-bold ph-clock" /> {nextDelivery.deliveryWindow}
                </div>
                <div className="fine mt2">
                  {nextDelivery.items.length === 0
                    ? "Chef's curated box"
                    : nextDelivery.items.map((i) => i.name).slice(0, 3).join(", ") +
                      (nextDelivery.items.length > 3
                        ? ` +${nextDelivery.items.length - 3} more`
                        : "")}
                </div>
              </div>
            </div>
            <div
              className="fx wrap gap8 mt12"
              style={{ paddingTop: 12, borderTop: "1px solid var(--ln)" }}
            >
              <button className="btn btn-p" style={ACT} onClick={() => onSwap(nextDelivery)}>
                <i className="ph-bold ph-swap" /> Swap dishes
              </button>
              <button
                className="btn btn-g"
                style={ACT}
                onClick={() => onReschedule(nextDelivery)}
              >
                <i className="ph-bold ph-clock" /> Reschedule
              </button>
              <button
                className="btn btn-g"
                style={{ ...ACT, color: "var(--safb)" }}
                onClick={() => onSkip(nextDelivery)}
              >
                <i className="ph-bold ph-skip-forward" /> Skip (credit wallet)
              </button>
            </div>
          </div>
        </>
      )}

      {/* Later / past deliveries */}
      {laterDeliveries.length > 0 && (
        <>
          <div className="lab mt20 mb10">
            {nextDelivery ? "Later deliveries" : "Deliveries"}
          </div>
          {laterDeliveries.map((d) => {
            const dm = DELIVERY_META[d.status];
            const isUpcoming = d.status === "upcoming";
            return (
              <div key={d.id} className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 mb10">
                <div className="fx ac jb gap8">
                  <div className="fx ac gap12">
                    <DateBox iso={d.scheduledFor} />
                    <div style={{ minWidth: 0 }}>
                      <div className="small" style={{ fontWeight: 500 }}>
                        {d.items.length === 0
                          ? "Chef's curated box"
                          : `${d.items.length} item${d.items.length === 1 ? "" : "s"} curated`}
                      </div>
                      <div className="fine mt2 fx ac" style={{ gap: 4 }}>
                        <i className="ph-bold ph-clock" /> {d.deliveryWindow}
                      </div>
                    </div>
                  </div>
                  <span className="pill" style={dm.style}>
                    {dm.label}
                  </span>
                </div>
                {isUpcoming && (
                  <div
                    className="fx wrap gap8 mt12"
                    style={{ paddingTop: 12, borderTop: "1px solid var(--ln)" }}
                  >
                    <button
                      className="btn btn-g"
                      style={{ ...ACT, color: "var(--safb)" }}
                      onClick={() => onSkip(d)}
                    >
                      <i className="ph-bold ph-skip-forward" /> Skip
                    </button>
                    <button
                      className="btn btn-g"
                      style={{ ...ACT, color: "var(--safb)" }}
                      onClick={() => onSwap(d)}
                    >
                      <i className="ph-bold ph-swap" /> Swap
                    </button>
                    <button
                      className="btn btn-g"
                      style={ACT}
                      onClick={() => onReschedule(d)}
                    >
                      <i className="ph-bold ph-clock" /> Reschedule
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ── Real dish-picker swap dialog ────────────────────────────────────────
// Replaces the previous placeholder that just toggled a label. Lets the
// member choose exactly which dishes go in this delivery, up to the plan's
// meals-per-delivery count, and persists via the swap endpoint.
function SwapDialog({
  delivery,
  mealsPerDelivery,
  onClose,
  onConfirm,
}: {
  delivery: SubscriptionDelivery | null;
  mealsPerDelivery: number;
  onClose: () => void;
  onConfirm: (items: SubscriptionItem[]) => void | Promise<void>;
}) {
  const { dishes } = useMenuCatalog();
  const { preferences } = usePreferences();
  const [query, setQuery] = useState("");
  // slug -> quantity
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  // Seed from the delivery's current contents each time it opens.
  useEffect(() => {
    if (delivery) {
      setSelected(
        Object.fromEntries(delivery.items.map((i) => [i.slug, i.quantity])),
      );
      setQuery("");
    }
  }, [delivery]);

  const bySlug = useMemo(
    () => new Map(dishes.map((d) => [d.slug, d])),
    [dishes],
  );

  const totalSelected = Object.values(selected).reduce((a, b) => a + b, 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = dishes.filter((d) => d.isAvailable);
    if (!q) return pool.slice(0, 40);
    return pool
      .filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [dishes, query]);

  const setQty = (slug: string, qty: number) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[slug];
      else next[slug] = qty;
      return next;
    });
  };

  const buildItems = (): SubscriptionItem[] =>
    Object.entries(selected)
      .map(([slug, quantity]) => {
        const d = bySlug.get(slug);
        if (!d) return null;
        return {
          slug: d.slug,
          name: d.name,
          image: d.image,
          quantity,
          unitPricePaise: d.price,
        } satisfies SubscriptionItem;
      })
      .filter((x): x is SubscriptionItem => x !== null);

  if (delivery === null) return null;

  return (
    <div
      className="tnm2 nn bg-[color-mix(in_srgb,var(--tnm-surface-ink)_95%,transparent)] backdrop-blur-md"
      style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={() => onClose()}
    >
      <div
        className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4"
        style={{ maxWidth: 512, width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tt fx ac gap8" style={{ color: "var(--text-primary)" }}>
          <i className="ph-bold ph-swap safc" /> Choose dishes for this delivery
        </div>

        <div className="fx ac gap12 mt12">
            <div className="inp f1">
              <i className="ph-bold ph-magnifying-glass" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search dishes…"
                aria-label="Search dishes"
              />
            </div>
            <span
              className={`mono fine nowrap ${totalSelected === mealsPerDelivery ? "sagec" : ""}`}
            >
              {totalSelected}/{mealsPerDelivery} meals
            </span>
          </div>

          <div
            className="mt12"
            style={{ maxHeight: "46vh", overflowY: "auto", paddingRight: 4 }}
          >
            {filtered.map((d: DishData) => {
              const qty = selected[d.slug] ?? 0;
              const match = evaluateDishForPreferences(d, preferences);
              const blocked = match.blocked;
              return (
                <div
                  key={d.slug}
                  className="fx ac gap12"
                  style={{
                    padding: 8,
                    borderRadius: 10,
                    marginBottom: 6,
                    border: `1px solid ${blocked ? "color-mix(in oklab, var(--color-error) 50%, transparent)" : qty > 0 ? "var(--saf)" : "var(--ln)"}`,
                    background: blocked
                      ? "color-mix(in oklab, var(--color-error) 10%, transparent)"
                      : qty > 0
                        ? "var(--safd)"
                        : "transparent",
                    opacity: blocked ? 0.6 : 1,
                  }}
                >
                  {d.image ? (
                    <div
                      className="dimg"
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        backgroundImage: `url(${d.image})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: "var(--s3)",
                        flex: "none",
                      }}
                    />
                  )}
                  <div className="f1" style={{ minWidth: 0 }}>
                    <div className="small clamp1 fx ac g6" style={{ fontWeight: 500 }}>
                      {d.name}
                      {blocked && (
                        <span
                          className="lab"
                          style={{
                            color: "var(--dgr)",
                            border: "1px solid color-mix(in oklab, var(--color-error) 50%, transparent)",
                            padding: "1px 5px",
                            borderRadius: 5,
                          }}
                        >
                          BLOCKED
                        </span>
                      )}
                    </div>
                    <div className="mono fntc" style={{ fontSize: 11 }}>
                      {formatPrice(d.price)} · {d.macros.protein}g protein
                    </div>
                  </div>
                  {blocked ? (
                    <span className="fine dgrc nowrap" style={{ fontWeight: 600 }}>
                      Unavailable
                    </span>
                  ) : qty === 0 ? (
                    <button
                      className="btn btn-g nowrap"
                      style={{ height: 32, padding: "0 12px", fontSize: 13, color: "var(--safb)" }}
                      onClick={() => setQty(d.slug, 1)}
                    >
                      Add
                    </button>
                  ) : (
                    <div className="fx ac g6">
                      <button
                        className="qbtn"
                        style={{ width: 30, height: 30 }}
                        onClick={() => setQty(d.slug, qty - 1)}
                        aria-label="Decrease"
                      >
                        <i className="ph-bold ph-minus" />
                      </button>
                      <span
                        className="mono"
                        style={{ width: 16, textAlign: "center", fontWeight: 600 }}
                      >
                        {qty}
                      </span>
                      <button
                        className="qbtn"
                        style={{ width: 30, height: 30 }}
                        onClick={() => setQty(d.slug, qty + 1)}
                        aria-label="Increase"
                      >
                        <i className="ph-bold ph-plus" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="fine tc" style={{ padding: "24px 0" }}>
                No dishes match “{query}”.
              </div>
            )}
          </div>

          <div className="fx gap8 mt16" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-g" style={ACT} onClick={onClose}>
              Cancel
            </button>
            <button
              className={`btn btn-p${totalSelected === 0 || saving ? " dis" : ""}`}
              style={ACT}
              onClick={async () => {
                setSaving(true);
                try {
                  await onConfirm(buildItems());
                } finally {
                  setSaving(false);
                }
              }}
            >
              <i className="ph-bold ph-check" />
              {saving ? "Saving…" : "Save delivery"}
            </button>
          </div>
      </div>
    </div>
  );
}
