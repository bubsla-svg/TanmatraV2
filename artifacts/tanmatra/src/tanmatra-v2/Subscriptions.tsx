import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isPastSkipCutoff } from "@workspace/subscription-rules";
import {
  subscriptionsApi,
  subscriptionKeys,
  isUnauthorizedError,
  CADENCE_LABEL,
  type Subscription,
  type SubscriptionCadence,
  type SubscriptionDelivery,
  type SubscriptionMember,
  type SubscriptionItem,
  type MealCredit,
  type AddMemberInput,
} from "@/lib/subscriptionsApi";
import {
  blankMember,
  COMMON_ALLERGENS,
  LIFESTYLE_OPTIONS,
  type MemberDraft,
} from "@/lib/memberDraft";
import { loyaltyApi } from "@/lib/loyaltyApi";
import { track } from "@/lib/analytics";
import { useMenuCatalog } from "@/lib/menuData";
import { whatsappLink } from "@/lib/support";
import type { DishData } from "@/lib/menuData";
import { usePreferences } from "@/lib/preferencesContext";
import { evaluateDishForPreferences } from "@/lib/preferencesMatch";
import { openRazorpayCheckout, razorpayConfigured } from "@/lib/razorpayClient";

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
  // Billing gave up after repeated consecutive charge failures (see
  // api-server's chargeMandate.ts MAX_CONSECUTIVE_CHARGE_FAILURES) — distinct
  // from a customer-initiated "paused", so it gets the alert color, not the
  // caution one.
  halted: {
    label: "Billing halted",
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

// Skip/swap/reschedule are only ever locked because the delivery itself is
// close — surface that as "starts in Xh" so the lock reads as informative
// rather than a dead end.
function lockedLabel(iso: string): string {
  const hours = Math.ceil((new Date(iso).getTime() - Date.now()) / 3_600_000);
  if (hours <= 0) return "Locked — arriving soon";
  return `Locked — starts in ${hours}h`;
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Subscription list + detail live in the React Query cache under
  // subscriptionKeys.* — the SAME keys Billing.tsx and Account.tsx use for
  // this data. A mutation from any of the three screens invalidates the
  // shared cache, so the other two pick up the change without a hard reload.
  const listQuery = useQuery({
    queryKey: subscriptionKeys.list,
    queryFn: () => subscriptionsApi.list(),
    retry: false,
  });
  const subs = listQuery.data?.subscriptions ?? [];
  const unauthorized = isUnauthorizedError(listQuery.error);

  const [activeId, setActiveId] = useState<number | null>(null);
  useEffect(() => {
    if (subs.length > 0 && activeId === null) {
      setActiveId(subs[0].id);
    }
  }, [subs, activeId]);

  const detailQuery = useQuery({
    queryKey: subscriptionKeys.detail(activeId ?? -1),
    queryFn: () => subscriptionsApi.get(activeId as number),
    enabled: activeId !== null,
    retry: false,
  });
  const detail: Detail | null = detailQuery.data
    ? {
        subscription: detailQuery.data.subscription,
        members: detailQuery.data.members,
        deliveries: detailQuery.data.deliveries,
      }
    : null;

  const invalidateSubscriptions = useCallback(
    () => queryClient.invalidateQueries({ queryKey: subscriptionKeys.all }),
    [queryClient],
  );

  // Wallet (meal credits) + loyalty progress aren't shared across screens the
  // way the subscription entity is, so they stay local state refreshed
  // alongside every mutation rather than joining the shared cache.
  const [credits, setCredits] = useState<{ balance: number; rows: MealCredit[] }>({
    balance: 0,
    rows: [],
  });
  const [progress, setProgress] = useState<Record<number, LoyaltyProgress>>({});
  const [walletLoading, setWalletLoading] = useState(true);
  const refreshWallet = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([
        subscriptionsApi.credits(),
        loyaltyApi.getLoyaltyProgress().catch(() => ({ progress: [] })),
      ]);
      setCredits({ balance: c.balance, rows: c.credits });
      setProgress(
        Object.fromEntries(p.progress.map((row) => [row.subscriptionId, row])),
      );
    } catch (err) {
      if (!isUnauthorizedError(err)) {
        toast.error("Failed to load wallet");
      }
    } finally {
      setWalletLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshWallet();
  }, [refreshWallet]);

  const loading = listQuery.isLoading || walletLoading;

  const [reschedDelivery, setReschedDelivery] =
    useState<SubscriptionDelivery | null>(null);
  const [reschedDate, setReschedDate] = useState("");
  const [reschedWindow, setReschedWindow] = useState(TIME_WINDOWS[1]);
  const [windowEditOpen, setWindowEditOpen] = useState(false);
  const [pendingWindow, setPendingWindow] = useState(TIME_WINDOWS[1]);
  const [swapDelivery, setSwapDelivery] = useState<SubscriptionDelivery | null>(null);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [changePlanInitialStep, setChangePlanInitialStep] = useState<"picker" | "reauth">("picker");

  const wrap = async <T,>(p: Promise<T>, msg: string) => {
    try {
      await p;
      toast.success(msg);
      await invalidateSubscriptions();
      await refreshWallet();
    } catch (err) {
      const m = err instanceof Error ? err.message : "Error";
      toast.error("Action failed", { description: m });
    }
  };

  // ---------- Post-trial → recurring bridge (the conversion moment) ----------
  // A trial is a one-off 3-day sampler. Converting calls the server's
  // /subscriptions/:id/convert endpoint, which keeps the SAME subscription
  // row: it re-validates the capacity hold and the reserved delivery slot,
  // then reprices and extends deliveries. Creating a brand-new subscription
  // here (the old approach) bypassed both of those checks entirely.
  const [continuing, setContinuing] = useState(false);
  const handleContinueTrial = useCallback(async () => {
    if (!detail) return;
    const { subscription: s } = detail;
    track("post_trial_continue_clicked", {
      trialSubscriptionId: s.id,
      meals: s.mealsPerDelivery,
    });
    setContinuing(true);
    try {
      const { subscription: converted } = await subscriptionsApi.convert(s.id);
      track("post_trial_continue_success", { subscriptionId: converted.id });
      toast.success("Your plan is now active — welcome aboard!");
      await invalidateSubscriptions();
      await refreshWallet();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error";
      if (message === "capacity hold expired" || message === "delivery slot full") {
        toast.error("Your reserved slot is no longer available", {
          description:
            message === "capacity hold expired"
              ? "Your kitchen capacity hold has expired. Start a fresh plan to pick a new delivery slot."
              : "That delivery slot just filled up. Start a fresh plan to pick a new one.",
          action: { label: "Browse plans", onClick: () => navigate("/plans") },
        });
      } else {
        toast.error("Couldn't continue your plan", { description: message });
      }
    } finally {
      setContinuing(false);
    }
  }, [detail, invalidateSubscriptions, refreshWallet, navigate]);

  // ---------- Members (eaters) — add / remove ----------
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberActionPending, setMemberActionPending] = useState(false);
  const handleAddMember = useCallback(
    async (input: AddMemberInput) => {
      if (!detail) return;
      setMemberActionPending(true);
      try {
        await subscriptionsApi.addMember(detail.subscription.id, input);
        toast.success("Eater added");
        await invalidateSubscriptions();
        setAddMemberOpen(false);
      } catch (err) {
        toast.error("Couldn't add eater", {
          description: err instanceof Error ? err.message : "Error",
        });
      } finally {
        setMemberActionPending(false);
      }
    },
    [detail, invalidateSubscriptions],
  );
  const handleRemoveMember = useCallback(
    async (memberId: number) => {
      if (!detail) return;
      try {
        await subscriptionsApi.removeMember(detail.subscription.id, memberId);
        toast.success("Eater removed");
        await invalidateSubscriptions();
      } catch (err) {
        toast.error("Couldn't remove eater", {
          description: err instanceof Error ? err.message : "Error",
        });
      }
    },
    [detail, invalidateSubscriptions],
  );

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
            onReactivateBilling={() =>
              wrap(
                subscriptionsApi.reactivateBilling(detail.subscription.id),
                "Billing reactivated — you'll be charged on the normal schedule",
              )
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
            onChangePlan={() => {
              setChangePlanInitialStep("picker");
              setChangePlanOpen(true);
            }}
            onReauthorize={() => {
              setChangePlanInitialStep("reauth");
              setChangePlanOpen(true);
            }}
            onSkip={(d) => setSkipConfirm({ deliveryId: d.id, date: d.scheduledFor })}
            onSwap={(d) => setSwapDelivery(d)}
            onReschedule={(d) => {
              setReschedDelivery(d);
              setReschedDate(new Date(d.scheduledFor).toISOString().slice(0, 10));
              setReschedWindow(d.deliveryWindow);
            }}
            onContinueTrial={handleContinueTrial}
            continuing={continuing}
            onAddMemberClick={() => setAddMemberOpen(true)}
            onRemoveMember={handleRemoveMember}
          />
        )}
      </div>

      {/* Add eater */}
      <AddMemberDialog
        open={addMemberOpen}
        pending={memberActionPending}
        onClose={() => setAddMemberOpen(false)}
        onSubmit={handleAddMember}
      />

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

      {/* Change plan (cadence / mealsPerDelivery) */}
      <ChangePlanDialog
        subscription={detail?.subscription ?? null}
        open={changePlanOpen}
        initialStep={changePlanInitialStep}
        onClose={() => setChangePlanOpen(false)}
        onChanged={invalidateSubscriptions}
      />

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
  onReactivateBilling,
  onCancel,
  onEditWindow,
  onGenerateMore,
  onChangePlan,
  onReauthorize,
  onSkip,
  onSwap,
  onReschedule,
  onContinueTrial,
  continuing,
  onAddMemberClick,
  onRemoveMember,
}: {
  detail: Detail;
  progress?: LoyaltyProgress;
  onPause: () => void;
  onResume: () => void;
  onReactivateBilling: () => void;
  onCancel: () => void;
  onEditWindow: () => void;
  onGenerateMore: () => void;
  onChangePlan: () => void;
  onReauthorize: () => void;
  onSkip: (d: SubscriptionDelivery) => void;
  onSwap: (d: SubscriptionDelivery) => void;
  onReschedule: (d: SubscriptionDelivery) => void;
  onContinueTrial: () => void;
  continuing: boolean;
  onAddMemberClick: () => void;
  onRemoveMember: (memberId: number) => void;
}) {
  const { subscription: s, members, deliveries } = detail;
  const meta = STATUS_META[s.status];
  const trial = isTrialSub(s);
  const upcoming = deliveries.filter((d) => d.status === "upcoming");
  const nextDelivery = upcoming[0];
  const nextLocked = nextDelivery ? isPastSkipCutoff(nextDelivery.scheduledFor) : false;
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
          {s.status === "halted" && (
            <button
              className="btn btn-g"
              style={{ ...ACT, color: "var(--dgr)" }}
              onClick={onReactivateBilling}
            >
              <i className="ph-bold ph-arrow-clockwise" /> Retry billing
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
          {!trial && s.status === "active" && (
            <button className="btn btn-g" style={ACT} onClick={onChangePlan}>
              <i className="ph-bold ph-sliders-horizontal" /> Change plan
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

        {/* Billing gave up after repeated consecutive charge failures — an
            honest, distinct treatment from "paused" so the customer knows
            this wasn't their choice and nothing will resume until they act. */}
        {s.status === "halted" && (
          <div
            className="note mt12"
            style={{
              background: "var(--dgrd)",
              borderColor: "color-mix(in oklab, var(--color-error) 35%, transparent)",
              color: "var(--dgr)",
            }}
          >
            <i className="ph-bold ph-warning-circle" />
            <span>
              We couldn't charge your payment method after several attempts, so billing has
              stopped and deliveries are paused. Retry billing once your payment method is
              up to date.
            </span>
          </div>
        )}

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

        {/* Pending plan change — never applied mid-cycle, see backend note.
            Two distinct states: still needs a fresh autopay authorisation
            (price increase), or already eligible and just waiting for the
            next cycle to roll over. */}
        {s.pendingCadence != null && (
          <div
            className="note mt12"
            style={
              s.pendingChangeReauthRequired
                ? {
                    background: "color-mix(in oklab, var(--color-warning) 14%, transparent)",
                    borderColor: "color-mix(in oklab, var(--color-warning) 45%, transparent)",
                    color: "var(--safb)",
                  }
                : { background: "var(--s2)", borderColor: "var(--ln2)", color: "var(--mut)" }
            }
          >
            <i className={`ph-bold ${s.pendingChangeReauthRequired ? "ph-warning-circle" : "ph-info"}`} />
            <div className="f1">
              {s.pendingChangeReauthRequired ? (
                <>
                  <span>
                    Action needed: re-authorise autopay to switch to{" "}
                    <strong>{CADENCE_LABEL[s.pendingCadence]}</strong>
                    {s.pendingMealsPerDelivery != null ? `, ${s.pendingMealsPerDelivery} meals` : ""} at{" "}
                    {s.pendingPricePerDeliveryPaise != null ? formatPrice(s.pendingPricePerDeliveryPaise) : ""}
                    /delivery. This won't take effect until you confirm.
                  </span>
                  <button
                    className="btn btn-p mt10"
                    style={{ ...ACT, display: "inline-flex" }}
                    onClick={onReauthorize}
                  >
                    <i className="ph-bold ph-shield-check" /> Re-authorise now
                  </button>
                </>
              ) : (
                <span>
                  Switching to <strong>{CADENCE_LABEL[s.pendingCadence]}</strong>
                  {s.pendingMealsPerDelivery != null ? `, ${s.pendingMealsPerDelivery} meals` : ""} at{" "}
                  {s.pendingPricePerDeliveryPaise != null ? formatPrice(s.pendingPricePerDeliveryPaise) : ""}
                  /delivery, starting your next cycle.
                </span>
              )}
            </div>
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
            <span key={m.id} className="pill fx ac g6">
              {m.name}
              {m.lifestyle ? ` · ${m.lifestyle}` : ""}
              {m.allergens.length > 0 ? ` · no ${m.allergens.join("/")}` : ""}
              {s.status !== "cancelled" && members.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemoveMember(m.id)}
                  aria-label={`Remove ${m.name}`}
                  className="pointer"
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    display: "inline-flex",
                    color: "inherit",
                    opacity: 0.7,
                  }}
                >
                  <i className="ph-bold ph-x" style={{ fontSize: 11 }} />
                </button>
              )}
            </span>
          ))}
          {s.status !== "cancelled" && (
            <button type="button" onClick={onAddMemberClick} className="chip">
              <i className="ph-bold ph-plus" /> Add eater
            </button>
          )}
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
              <button
                className={`btn btn-p${nextLocked ? " dis" : ""}`}
                style={ACT}
                onClick={() => onSwap(nextDelivery)}
                disabled={nextLocked}
              >
                <i className="ph-bold ph-swap" /> Swap dishes
              </button>
              <button
                className={`btn btn-g${nextLocked ? " dis" : ""}`}
                style={ACT}
                onClick={() => onReschedule(nextDelivery)}
                disabled={nextLocked}
              >
                <i className="ph-bold ph-clock" /> Reschedule
              </button>
              <button
                className={`btn btn-g${nextLocked ? " dis" : ""}`}
                style={{ ...ACT, color: "var(--safb)" }}
                onClick={() => onSkip(nextDelivery)}
                disabled={nextLocked}
              >
                <i className="ph-bold ph-skip-forward" /> Skip (credit wallet)
              </button>
            </div>
            {nextLocked && (
              <div className="fine mt8 fx ac g6" style={{ color: "var(--safb)" }}>
                <i className="ph-bold ph-lock-simple" /> {lockedLabel(nextDelivery.scheduledFor)} — inside the 24h change window
              </div>
            )}
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
            const locked = isUpcoming && isPastSkipCutoff(d.scheduledFor);
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
                  <>
                    <div
                      className="fx wrap gap8 mt12"
                      style={{ paddingTop: 12, borderTop: "1px solid var(--ln)" }}
                    >
                      <button
                        className={`btn btn-g${locked ? " dis" : ""}`}
                        style={{ ...ACT, color: "var(--safb)" }}
                        onClick={() => onSkip(d)}
                        disabled={locked}
                      >
                        <i className="ph-bold ph-skip-forward" /> Skip
                      </button>
                      <button
                        className={`btn btn-g${locked ? " dis" : ""}`}
                        style={{ ...ACT, color: "var(--safb)" }}
                        onClick={() => onSwap(d)}
                        disabled={locked}
                      >
                        <i className="ph-bold ph-swap" /> Swap
                      </button>
                      <button
                        className={`btn btn-g${locked ? " dis" : ""}`}
                        style={ACT}
                        onClick={() => onReschedule(d)}
                        disabled={locked}
                      >
                        <i className="ph-bold ph-clock" /> Reschedule
                      </button>
                    </div>
                    {locked && (
                      <div className="fine mt6 fx ac g6" style={{ color: "var(--safb)" }}>
                        <i className="ph-bold ph-lock-simple" /> {lockedLabel(d.scheduledFor)}
                      </div>
                    )}
                  </>
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

// ── Change plan (cadence / mealsPerDelivery) ────────────────────────────
// Mirrors Subscribe.tsx's cadence picker (weekly/fortnightly/monthly, priced
// via the same /subscriptions/quote call) in a simplified, single-step form
// scoped to an EXISTING subscription. A change is never applied immediately —
// see the backend's applyPendingPlanChangeIfReady — so the only thing this
// dialog does is: preview a price, submit the request, and — when the price
// increases against a live autopay mandate — walk the customer through a
// fresh Razorpay re-authorisation before the change is even eligible to take
// effect at the next cycle.
//
// Standard four states: default (picker with a live quote), loading (quote
// skeleton / "Saving…" / "Opening secure checkout…" busy labels), empty
// (selection matches the current plan — Save disabled with a note), error
// (quote failed → inline retry; save/reauth failed → inline banner, never a
// silent failure).
function ChangePlanDialog({
  subscription,
  open,
  initialStep,
  onClose,
  onChanged,
}: {
  subscription: Subscription | null;
  open: boolean;
  initialStep: "picker" | "reauth";
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const [phase, setPhase] = useState<"picker" | "reauth">("picker");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cadence, setCadence] = useState<SubscriptionCadence>("weekly");
  const [meals, setMeals] = useState(5);
  const [quote, setQuote] = useState<{ pricePerDeliveryPaise: number } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState(false);
  const [quoteRetryTick, setQuoteRetryTick] = useState(0);
  const [reauthInfo, setReauthInfo] = useState<{ current: number; next: number } | null>(null);

  const hasDayPlan = Boolean(subscription?.dayPlan && subscription.dayPlan.length > 0);

  // Reset to a fresh state every time the dialog opens (or the underlying
  // subscription changes) — including jumping straight to the reauth step
  // when opened via the DetailView banner's "Re-authorise now" button.
  useEffect(() => {
    if (!open || !subscription) return;
    setErrorMessage(null);
    setBusy(false);
    setCadence(subscription.cadence);
    setMeals(subscription.mealsPerDelivery);
    if (
      initialStep === "reauth" &&
      subscription.pendingChangeReauthRequired &&
      subscription.pendingPricePerDeliveryPaise != null
    ) {
      setPhase("reauth");
      setReauthInfo({
        current: subscription.pricePerDeliveryPaise,
        next: subscription.pendingPricePerDeliveryPaise,
      });
    } else {
      setPhase("picker");
      setReauthInfo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, subscription?.id, initialStep]);

  // Live price preview — the SAME /subscriptions/quote call Subscribe.tsx
  // uses, so the number shown here can never drift from how the platform
  // prices a plan elsewhere. This is a preview only: change-plan always
  // recomputes the real price server-side regardless of what this shows.
  useEffect(() => {
    if (!open || phase !== "picker" || !subscription || hasDayPlan) return;
    let alive = true;
    setQuoteLoading(true);
    setQuoteError(false);
    subscriptionsApi
      .quote({ cadence, mealsPerDelivery: meals, planType: "standard" })
      .then((q) => {
        if (alive) setQuote({ pricePerDeliveryPaise: q.pricePerDeliveryPaise });
      })
      .catch(() => {
        if (alive) setQuoteError(true);
      })
      .finally(() => {
        if (alive) setQuoteLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, phase, cadence, meals, subscription?.id, hasDayPlan, quoteRetryTick]);

  if (!open || !subscription) return null;

  const isNoop = cadence === subscription.cadence && meals === subscription.mealsPerDelivery;

  async function handleSave() {
    if (!subscription) return;
    setBusy(true);
    setErrorMessage(null);
    try {
      const res = await subscriptionsApi.changePlan(subscription.id, {
        cadence,
        mealsPerDelivery: meals,
        clientQuotedPricePerDeliveryPaise: quote?.pricePerDeliveryPaise,
      });
      if (res.requiresReauth) {
        setReauthInfo({ current: res.currentPricePerDeliveryPaise, next: res.newPricePerDeliveryPaise });
        setPhase("reauth");
        // Refresh the parent now (not just on close) so the DetailView
        // banner reflects the pending-reauth state even if the customer
        // closes this dialog without finishing re-authorisation.
        await onChanged();
      } else {
        toast.success("Plan change saved — it starts your next cycle.");
        await onChanged();
        onClose();
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not save your plan change.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReauthorize() {
    if (!subscription) return;
    setBusy(true);
    setErrorMessage(null);
    try {
      const order = await subscriptionsApi.changePlanReauthOrder(subscription.id);
      const opened = await openRazorpayCheckout({
        razorpayOrderId: order.razorpayOrderId,
        amountPaise: order.amount,
        description: "Tanmatra plan change — re-authorise autopay",
        contact: subscription.phone ?? undefined,
      });
      if (opened.outcome !== "paid") {
        if (opened.outcome === "cancelled") {
          toast.info("Re-authorisation cancelled — your requested change is still saved. Try again anytime.");
        } else {
          setErrorMessage("Payment gateway is unavailable right now. Please try again shortly.");
        }
        return;
      }
      await subscriptionsApi.changePlanConfirm(subscription.id, opened.payment);
      toast.success("Autopay re-authorised — your new plan starts next cycle.");
      await onChanged();
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not complete re-authorisation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="tnm2 nn bg-[color-mix(in_srgb,var(--tnm-surface-ink)_95%,transparent)] backdrop-blur-md"
      style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={() => !busy && onClose()}
    >
      <div
        className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4"
        style={{ maxWidth: 480, width: "100%", maxHeight: "88vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tt fx ac gap8" style={{ color: "var(--text-primary)" }}>
          <i className="ph-bold ph-sliders-horizontal safc" />
          {phase === "picker" ? "Change plan" : "Re-authorise autopay"}
        </div>

        {phase === "picker" && (
          <>
            <p className="fine mt6">
              Takes effect on your next billing cycle — the deliveries already
              scheduled for this cycle are untouched.
            </p>

            <div className="lab mt16 mb8">Cadence</div>
            <div className="fx wrap gap8">
              {(["weekly", "fortnightly", "monthly"] as SubscriptionCadence[]).map((c) => (
                <button
                  key={c}
                  aria-pressed={cadence === c}
                  onClick={() => setCadence(c)}
                  disabled={busy}
                  className="btn btn-g"
                  style={{
                    ...ACT,
                    borderColor: cadence === c ? "var(--saf)" : "var(--ln2)",
                    background: cadence === c ? "var(--safd)" : "var(--s2)",
                    color: cadence === c ? "var(--safb)" : "var(--tx)",
                  }}
                >
                  {CADENCE_LABEL[c]}
                </button>
              ))}
            </div>

            <div className="lab mt16 mb8">Meals per delivery</div>
            {hasDayPlan ? (
              <div className="fine">
                This plan's meals are set by your day-by-day schedule — edit
                individual deliveries to change what you eat. You can still
                change the cadence above.
              </div>
            ) : (
              <div className="fx ac gap12">
                <button
                  className="qbtn"
                  style={{ width: 34, height: 34 }}
                  onClick={() => setMeals((m) => Math.max(1, m - 1))}
                  aria-label="Fewer meals"
                  disabled={busy}
                >
                  <i className="ph-bold ph-minus" />
                </button>
                <span className="mono" style={{ minWidth: 28, textAlign: "center", fontWeight: 600 }}>
                  {meals}
                </span>
                <button
                  className="qbtn"
                  style={{ width: 34, height: 34 }}
                  onClick={() => setMeals((m) => Math.min(50, m + 1))}
                  aria-label="More meals"
                  disabled={busy}
                >
                  <i className="ph-bold ph-plus" />
                </button>
              </div>
            )}

            <div className="mt16 rounded-xl bg-[var(--s2)] p-3">
              {quoteLoading ? (
                <div className="skel" style={{ height: 18, width: "60%" }} />
              ) : quoteError ? (
                <div className="fx ac jb gap8">
                  <span className="fine dgrc">Couldn't load a price preview.</span>
                  <button className="btn btn-g" style={ACT} onClick={() => setQuoteRetryTick((t) => t + 1)}>
                    Retry
                  </button>
                </div>
              ) : isNoop ? (
                <span className="fine">This matches your current plan.</span>
              ) : (
                <div className="fx ac jb">
                  <span className="fine">New price per delivery</span>
                  <span className="price" style={{ fontSize: 16 }}>
                    {quote ? formatPrice(quote.pricePerDeliveryPaise) : "—"}
                  </span>
                </div>
              )}
            </div>

            {errorMessage && (
              <div
                className="note mt12"
                style={{ background: "color-mix(in oklab, var(--color-error) 12%, transparent)", color: "var(--dgr)" }}
              >
                <i className="ph-bold ph-warning-circle" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="fx gap8 mt16" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-g" style={ACT} onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button
                className={`btn btn-p${isNoop || busy || quoteLoading || quoteError ? " dis" : ""}`}
                style={ACT}
                onClick={handleSave}
              >
                <i className="ph-bold ph-check" />
                {busy ? "Saving…" : "Save plan change"}
              </button>
            </div>
          </>
        )}

        {phase === "reauth" && reauthInfo && (
          <>
            <p className="fine mt6">
              Your new price is higher than what your autopay mandate was last
              authorised for. For your protection, we need a quick one-time
              UPI Autopay confirmation before this change can take effect —
              you'll see a secure Razorpay screen next.
            </p>
            <div className="mt12 rounded-xl bg-[var(--s2)] p-3">
              <div className="fx ac jb">
                <span className="fine">Current price</span>
                <span className="mono">{formatPrice(reauthInfo.current)}</span>
              </div>
              <div className="fx ac jb mt6">
                <span className="fine">New price</span>
                <span className="price" style={{ fontSize: 16 }}>
                  {formatPrice(reauthInfo.next)}
                </span>
              </div>
            </div>

            {errorMessage && (
              <div
                className="note mt12"
                style={{ background: "color-mix(in oklab, var(--color-error) 12%, transparent)", color: "var(--dgr)" }}
              >
                <i className="ph-bold ph-warning-circle" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="fx gap8 mt16" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-g" style={ACT} onClick={onClose} disabled={busy}>
                I'll do this later
              </button>
              <button
                className={`btn btn-p${busy ? " dis" : ""}`}
                style={ACT}
                onClick={handleReauthorize}
              >
                <i className="ph-bold ph-shield-check" />
                {busy ? "Opening secure checkout…" : "Re-authorise now"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Add-eater dialog ────────────────────────────────────────────────────
// Reuses the same field shape (MemberDraft), defaults, and allergen /
// lifestyle option lists as the Subscribe flow's initial member step
// (@/lib/memberDraft) so a member added post-creation looks and validates
// the same way as one added at checkout.
function AddMemberDialog({
  open,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: AddMemberInput) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<MemberDraft>(blankMember());

  useEffect(() => {
    if (open) setDraft(blankMember());
  }, [open]);

  if (!open) return null;

  const toggleAllergen = (allergen: string) => {
    setDraft((prev) => ({
      ...prev,
      allergens: prev.allergens.includes(allergen)
        ? prev.allergens.filter((a) => a !== allergen)
        : [...prev.allergens, allergen],
    }));
  };

  const canSubmit = draft.name.trim().length > 0 && !pending;

  return (
    <div
      className="tnm2 nn bg-[color-mix(in_srgb,var(--tnm-surface-ink)_95%,transparent)] backdrop-blur-md"
      style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4"
        style={{ maxWidth: 440, width: "100%", maxHeight: "86vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tt fx ac gap8" style={{ color: "var(--text-primary)" }}>
          <i className="ph-bold ph-user-plus safc" /> Add an eater
        </div>

        <div className="mt12">
          <div className="lab mb6">Name</div>
          <div className="inp">
            <i className="ph-bold ph-user" />
            <input
              value={draft.name}
              onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Priya"
              aria-label="Eater name"
            />
          </div>
        </div>

        <div className="mt12">
          <div className="lab mb6">Diet</div>
          <div className="fx wrap g6">
            {(
              [
                { value: "any", label: "No preference" },
                { value: "veg", label: "Vegetarian" },
                { value: "nonveg", label: "Non-veg" },
              ] as const
            ).map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setDraft((p) => ({ ...p, diet: o.value }))}
                className={draft.diet === o.value ? "chip on" : "chip"}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt12">
          <div className="lab mb6">Spice level</div>
          <div className="fx wrap g6">
            {(["mild", "medium", "hot"] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setDraft((p) => ({ ...p, spiceLevel: level }))}
                className={draft.spiceLevel === level ? "chip on" : "chip"}
              >
                {level[0]!.toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt12">
          <div className="lab mb6">Lifestyle focus</div>
          <div className="fx wrap g6">
            {LIFESTYLE_OPTIONS.map((o) => (
              <button
                key={o.value || "none"}
                type="button"
                onClick={() => setDraft((p) => ({ ...p, lifestyle: o.value }))}
                className={draft.lifestyle === o.value ? "chip on" : "chip"}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt12">
          <div className="lab mb6">Allergens to avoid</div>
          <div className="fx wrap g6">
            {COMMON_ALLERGENS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => toggleAllergen(a)}
                className={draft.allergens.includes(a) ? "chip on" : "chip"}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div className="fx gap8 mt16" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-g" style={ACT} onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn btn-p${canSubmit ? "" : " dis"}`}
            style={ACT}
            disabled={!canSubmit}
            onClick={() =>
              onSubmit({
                name: draft.name.trim(),
                diet: draft.diet,
                allergens: draft.allergens,
                lifestyle: draft.lifestyle || undefined,
                spiceLevel: draft.spiceLevel,
              })
            }
          >
            <i className="ph-bold ph-check" />
            {pending ? "Adding…" : "Add eater"}
          </button>
        </div>
      </div>
    </div>
  );
}
