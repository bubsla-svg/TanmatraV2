import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, type MetaFunction } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  CalendarClock,
  Pause,
  Play,
  XCircle,
  SkipForward,
  Replace,
  Clock,
  Users,
  Sparkles,
  Wallet,
  PlusCircle,
  RefreshCw,
  MapPin,
  ArrowRight,
  Check,
  Search,
  Gift,
} from "lucide-react";
import {
  subscriptionsApi,
  CADENCE_LABEL,
  formatScheduledDate,
  type Subscription,
  type SubscriptionDelivery,
  type SubscriptionMember,
  type SubscriptionItem,
  type MealCredit,
} from "@/lib/subscriptionsApi";
import { loyaltyApi } from "@/lib/loyaltyApi";
import { useMenuCatalog } from "@/lib/menuData";
import type { DishData } from "@/lib/menuData";

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

const STATUS_BADGE: Record<Subscription["status"], { label: string; cls: string }> = {
  active: {
    label: "Active",
    cls: "bg-clinical-sage/15 text-clinical-sage border-clinical-sage/40",
  },
  paused: {
    label: "Paused",
    cls: "bg-orange-500/15 text-orange-300 border-orange-500/40",
  },
  cancelled: {
    label: "Cancelled",
    cls: "bg-red-500/15 text-red-400 border-red-500/40",
  },
};

const DELIVERY_BADGE: Record<SubscriptionDelivery["status"], { label: string; cls: string }> = {
  upcoming: {
    label: "Upcoming",
    cls: "bg-clinical-gold/15 text-clinical-gold border-clinical-gold/40",
  },
  paused: {
    label: "Paused",
    cls: "bg-clinical-zinc/15 text-clinical-zinc border-clinical-border",
  },
  skipped: {
    label: "Skipped",
    cls: "bg-orange-500/15 text-orange-300 border-orange-500/40",
  },
  delivered: {
    label: "Delivered",
    cls: "bg-clinical-sage/15 text-clinical-sage border-clinical-sage/40",
  },
  cancelled: {
    label: "Cancelled",
    cls: "bg-red-500/15 text-red-400 border-red-500/40",
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
  return isTrialSub(s) ? "3-Day Trial Pack" : `${CADENCE_LABEL[s.cadence]} Plan`;
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

export const meta: MetaFunction = () => [
  { title: "My Subscriptions | Tanmatra" },
  { name: "robots", content: "noindex, nofollow" },
];

export default function Subscriptions() {
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

  // ---------- Destructive-action safeguards ----------
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [skipConfirm, setSkipConfirm] = useState<{ deliveryId: number; date: string } | null>(null);

  if (unauthorized) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center space-y-4">
        <CalendarClock className="w-10 h-10 text-clinical-gold mx-auto" />
        <h1 className="text-clinical-h2 text-white">Sign in to manage plans</h1>
        <p className="text-sm text-clinical-zinc">
          Subscriptions are tied to your Tanmatra account.
        </p>
        <Link to="/login?next=/subscriptions">
          <Button className="bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90">
            Sign In
          </Button>
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center text-clinical-zinc text-sm">
        Loading subscriptions…
      </div>
    );
  }

  if (subs.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center space-y-5 animate-in fade-in">
        <Sparkles className="w-10 h-10 text-clinical-gold mx-auto" />
        <h1 className="text-clinical-h2 text-white">No active plans yet</h1>
        <p className="text-sm text-clinical-zinc max-w-sm mx-auto">
          Start with a 3-day trial at 25% off, or set up a recurring plan to lock
          in your delivery window and earn cadence discounts.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/subscribe?trial=1">
            <Button className="bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90 gap-2">
              <Gift className="w-4 h-4" /> Start 3-day trial
            </Button>
          </Link>
          <Link to="/subscription-plans">
            <Button
              variant="outline"
              className="border-clinical-border text-white hover:bg-clinical-surface-elevated gap-2"
            >
              See all plans
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const activeProgress = activeId !== null ? progress[activeId] : undefined;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-clinical-h2 text-white">Your subscriptions</h1>
          <p className="text-xs text-clinical-zinc mt-0.5">
            {subs.length} plan{subs.length === 1 ? "" : "s"} · {credits.balance} meal
            credit{credits.balance === 1 ? "" : "s"} in your wallet
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-clinical-gold/30 bg-clinical-surface px-3 py-2">
            <Wallet className="w-4 h-4 text-clinical-gold" />
            <div>
              <p className="text-[9px] uppercase tracking-widest text-clinical-zinc leading-none">
                Wallet
              </p>
              <p className="text-sm font-bold text-clinical-gold tabular-nums leading-tight">
                {credits.balance} meals
              </p>
            </div>
          </div>
          <Link to="/subscription-plans">
            <Button
              size="sm"
              className="bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90 gap-1.5"
            >
              <PlusCircle className="w-4 h-4" /> New plan
            </Button>
          </Link>
        </div>
      </header>

      {/* Plan switcher (only when more than one) */}
      {subs.length > 1 && (
        <div className="flex flex-wrap gap-2 border-b border-clinical-border pb-2">
          {subs.map((s) => {
            const active = s.id === activeId;
            const st = STATUS_BADGE[s.status];
            return (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${
                  active
                    ? "bg-clinical-gold/15 text-clinical-gold border border-clinical-gold/30"
                    : "text-clinical-zinc hover:text-white border border-transparent"
                }`}
              >
                {planTitle(s)}
                <span
                  className={`w-1.5 h-1.5 rounded-full ${s.status === "active" ? "bg-clinical-sage" : s.status === "paused" ? "bg-orange-400" : "bg-red-400"}`}
                  title={st.label}
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
        />
      )}

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

      <Dialog open={windowEditOpen} onOpenChange={setWindowEditOpen}>
        <DialogContent className="bg-clinical-surface border-clinical-border">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-clinical-gold" />
              Update delivery window
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-clinical-zinc">
              The new window applies to every upcoming delivery on this plan.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TIME_WINDOWS.map((w) => (
                <button
                  key={w}
                  onClick={() => setPendingWindow(w)}
                  className={`px-2.5 py-1 rounded-md text-[11px] border ${
                    w === pendingWindow
                      ? "border-clinical-gold bg-clinical-gold/10 text-clinical-gold"
                      : "border-clinical-border text-clinical-zinc"
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-clinical-border text-clinical-zinc"
              onClick={() => setWindowEditOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90"
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
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reschedDelivery !== null} onOpenChange={(open) => !open && setReschedDelivery(null)}>
        <DialogContent className="bg-clinical-surface border-clinical-border">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-clinical-gold" />
              Reschedule delivery
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-clinical-zinc">New date</Label>
              <Input
                type="date"
                value={reschedDate}
                onChange={(e) => setReschedDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="bg-clinical-dark border-clinical-border text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-clinical-zinc">Window</Label>
              <div className="flex flex-wrap gap-1.5">
                {TIME_WINDOWS.map((w) => (
                  <button
                    key={w}
                    onClick={() => setReschedWindow(w)}
                    className={`px-2.5 py-1 rounded-md text-[11px] border ${
                      w === reschedWindow
                        ? "border-clinical-gold bg-clinical-gold/10 text-clinical-gold"
                        : "border-clinical-border text-clinical-zinc"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-clinical-border text-clinical-zinc"
              onClick={() => setReschedDelivery(null)}
            >
              Cancel
            </Button>
            <Button
              className="bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90"
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
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------ Cancel confirmation (destructive) ------ */}
      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent className="bg-clinical-surface border-clinical-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Cancel this subscription?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-clinical-zinc text-xs">
              All upcoming deliveries will be cancelled. Any prepaid credits
              remain on your account and can be used for one-off orders. You can
              re-subscribe at any time, but you'll lose your current delivery
              window. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">
              Keep subscription
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-red-500 text-white hover:bg-red-600"
              onClick={() => {
                if (detail) {
                  void wrap(
                    subscriptionsApi.cancel(detail.subscription.id),
                    "Subscription cancelled",
                  );
                }
              }}
            >
              Yes, cancel subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ------ Skip-delivery confirmation ------ */}
      <AlertDialog
        open={skipConfirm !== null}
        onOpenChange={(open) => !open && setSkipConfirm(null)}
      >
        <AlertDialogContent className="bg-clinical-surface border-clinical-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Skip this delivery?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-clinical-zinc text-xs">
              {skipConfirm
                ? `We'll skip your ${new Date(skipConfirm.date).toLocaleDateString(
                    "en-IN",
                    { weekday: "long", day: "numeric", month: "short" },
                  )} delivery and credit the value back to your wallet. The next delivery in your schedule is unaffected.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">
              Keep delivery
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90"
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
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LoyaltyStrip({ pr }: { pr: LoyaltyProgress }) {
  const cycleDone = pr.freeEveryN - pr.deliveriesUntilFree;
  const cyclePct = Math.min(100, (cycleDone / pr.freeEveryN) * 100);
  const premPct = Math.min(100, (pr.deliveredCount / pr.premiumUnlockAt) * 100);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="rounded-lg border border-clinical-border bg-clinical-surface p-3 space-y-1.5">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-clinical-zinc">
          <span>Next free meal</span>
          <span className="tabular-nums">{cycleDone}/{pr.freeEveryN}</span>
        </div>
        <div className="h-1.5 rounded-full bg-clinical-dark overflow-hidden">
          <div className="h-full bg-clinical-gold transition-all" style={{ width: `${cyclePct}%` }} />
        </div>
        <p className="text-[10px] text-clinical-sage">
          {pr.deliveriesUntilFree} more deliver{pr.deliveriesUntilFree === 1 ? "y" : "ies"} to a free meal
        </p>
      </div>
      <div className="rounded-lg border border-clinical-border bg-clinical-surface p-3 space-y-1.5">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-clinical-zinc">
          <span>Chef's tier</span>
          <span className="tabular-nums">
            {pr.premiumUnlocked ? "Unlocked" : `${pr.deliveredCount}/${pr.premiumUnlockAt}`}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-clinical-dark overflow-hidden">
          <div className="h-full bg-clinical-sage transition-all" style={{ width: `${pr.premiumUnlocked ? 100 : premPct}%` }} />
        </div>
        <p className="text-[10px] text-clinical-zinc">
          {pr.premiumUnlocked
            ? "Chef specials unlocked on this plan"
            : `${pr.deliveriesUntilPremium} deliveries to unlock chef specials`}
        </p>
      </div>
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
}) {
  const { subscription: s, members, deliveries } = detail;
  const badge = STATUS_BADGE[s.status];
  const trial = isTrialSub(s);
  const upcoming = deliveries.filter((d) => d.status === "upcoming");
  const nextDelivery = upcoming[0];
  const laterDeliveries = deliveries.filter((d) => d.id !== nextDelivery?.id);

  return (
    <div className="space-y-5">
      {/* Plan summary + economics */}
      <Card className="bg-clinical-surface border-clinical-border">
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-clinical-h3 text-white">{planTitle(s)}</h2>
                <Badge variant="outline" className={`text-[10px] ${badge.cls}`}>
                  {badge.label}
                </Badge>
                {trial && (
                  <Badge className="bg-clinical-gold/15 text-clinical-gold border-clinical-gold/30 text-[10px]">
                    One-off
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-clinical-zinc">
                <span className="text-white font-semibold tabular-nums">
                  {formatPrice(s.pricePerDeliveryPaise)}
                  <span className="text-clinical-zinc font-normal"> / delivery</span>
                </span>
                <span>{s.mealsPerDelivery} meals</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {s.deliveryWindow}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {s.addressLabel ?? "Home"}
                  {s.city ? ` · ${s.city}` : ""}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {s.status === "active" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onPause}
                  className="border-orange-400/40 text-orange-300 hover:bg-orange-500/10 gap-1.5 text-xs"
                >
                  <Pause className="w-3.5 h-3.5" /> Pause
                </Button>
              )}
              {s.status === "paused" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onResume}
                  className="border-clinical-sage/40 text-clinical-sage hover:bg-clinical-sage/10 gap-1.5 text-xs"
                >
                  <Play className="w-3.5 h-3.5" /> Resume
                </Button>
              )}
              {!trial && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onEditWindow}
                  className="border-clinical-border text-clinical-zinc hover:text-white gap-1.5 text-xs"
                >
                  <Clock className="w-3.5 h-3.5" /> Edit window
                </Button>
              )}
              {!trial && s.status === "active" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onGenerateMore}
                  className="border-clinical-gold/40 text-clinical-gold hover:bg-clinical-gold/10 gap-1.5 text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Add 4 more
                </Button>
              )}
              {s.status !== "cancelled" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onCancel}
                  aria-label="Cancel this subscription"
                  className="min-h-9 text-clinical-zinc hover:text-red-400 gap-1.5 text-xs"
                >
                  <XCircle className="w-3.5 h-3.5" /> Cancel
                </Button>
              )}
            </div>
          </div>

          {s.status === "paused" && (
            <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 px-3 py-2 text-[11px] text-orange-200">
              This plan is paused — no deliveries or charges until you resume.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-clinical-border">
            <Users className="w-3.5 h-3.5 text-clinical-zinc" />
            <span className="text-[11px] text-clinical-zinc">Eaters:</span>
            {members.map((m) => (
              <Badge
                key={m.id}
                variant="outline"
                className="text-[10px] border-clinical-border text-clinical-zinc"
              >
                {m.name}
                {m.lifestyle ? ` · ${m.lifestyle}` : ""}
                {m.allergens.length > 0 ? ` · no ${m.allergens.join("/")}` : ""}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Trial → recurring conversion (the revenue moment) */}
      {trial && s.status !== "cancelled" && (
        <Card className="bg-gradient-to-br from-clinical-gold/12 to-transparent border-clinical-gold/40">
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 space-y-1">
              <p className="text-sm font-semibold text-white">Enjoying your trial?</p>
              <p className="text-xs text-clinical-zinc leading-relaxed">
                Turn it into a recurring plan to lock your delivery window, save up
                to 15%, and earn a free meal every few deliveries.
              </p>
            </div>
            <Link to="/subscription-plans" className="shrink-0">
              <Button className="bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90 font-semibold gap-2 h-10 px-5">
                Start a recurring plan <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Loyalty (recurring only) */}
      {progress && <LoyaltyStrip pr={progress} />}

      {/* Next delivery — hero */}
      {nextDelivery && (
        <div className="space-y-2">
          <h3 className="text-xs uppercase tracking-widest text-clinical-zinc px-1">
            Next delivery
          </h3>
          <Card className="bg-gradient-to-br from-clinical-surface to-clinical-surface-elevated border-clinical-gold/30">
            <CardContent className="p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="text-center rounded-lg bg-clinical-gold/10 border border-clinical-gold/25 px-3 py-2 min-w-[3.5rem]">
                    <p className="text-[10px] uppercase tracking-widest text-clinical-zinc">
                      {new Date(nextDelivery.scheduledFor).toLocaleString("en-IN", { weekday: "short" })}
                    </p>
                    <p className="text-2xl font-bold text-clinical-gold leading-none tabular-nums">
                      {new Date(nextDelivery.scheduledFor).getDate()}
                    </p>
                    <p className="text-[10px] text-clinical-zinc">
                      {new Date(nextDelivery.scheduledFor).toLocaleString("en-IN", { month: "short" })}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-white">
                      {relativeDay(nextDelivery.scheduledFor)}
                    </p>
                    <p className="text-xs text-clinical-zinc flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {nextDelivery.deliveryWindow}
                    </p>
                    <p className="text-[11px] text-clinical-zinc">
                      {nextDelivery.items.length === 0
                        ? "Chef's curated box"
                        : nextDelivery.items.map((i) => i.name).slice(0, 3).join(", ") +
                          (nextDelivery.items.length > 3 ? ` +${nextDelivery.items.length - 3} more` : "")}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-3 border-t border-clinical-border">
                <Button
                  size="sm"
                  onClick={() => onSwap(nextDelivery)}
                  className="bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90 gap-1.5 text-xs"
                >
                  <Replace className="w-3.5 h-3.5" /> Swap dishes
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onReschedule(nextDelivery)}
                  className="border-clinical-border text-clinical-zinc hover:text-white gap-1.5 text-xs"
                >
                  <Clock className="w-3.5 h-3.5" /> Reschedule
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSkip(nextDelivery)}
                  className="border-orange-400/40 text-orange-300 hover:bg-orange-500/10 gap-1.5 text-xs"
                >
                  <SkipForward className="w-3.5 h-3.5" /> Skip (credit wallet)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Later / past deliveries */}
      {laterDeliveries.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs uppercase tracking-widest text-clinical-zinc px-1">
            {nextDelivery ? "Later deliveries" : "Deliveries"}
          </h3>
          {laterDeliveries.map((d) => {
            const db = DELIVERY_BADGE[d.status];
            const isUpcoming = d.status === "upcoming";
            return (
              <Card key={d.id} className="bg-clinical-surface border-clinical-border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="text-center min-w-[2.75rem]">
                        <p className="text-[10px] uppercase tracking-widest text-clinical-zinc">
                          {new Date(d.scheduledFor).toLocaleString("en-IN", { weekday: "short" })}
                        </p>
                        <p className="text-lg font-bold text-clinical-gold leading-none tabular-nums">
                          {new Date(d.scheduledFor).getDate()}
                        </p>
                        <p className="text-[10px] text-clinical-zinc">
                          {new Date(d.scheduledFor).toLocaleString("en-IN", { month: "short" })}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-sm text-white">
                          {d.items.length === 0
                            ? "Chef's curated box"
                            : `${d.items.length} item${d.items.length === 1 ? "" : "s"} curated`}
                        </p>
                        <p className="text-[10px] text-clinical-zinc flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {d.deliveryWindow}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${db.cls}`}>
                      {db.label}
                    </Badge>
                  </div>
                  {isUpcoming && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-clinical-border">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSkip(d)}
                        className="border-orange-400/40 text-orange-300 hover:bg-orange-500/10 gap-1.5 text-xs"
                      >
                        <SkipForward className="w-3.5 h-3.5" /> Skip
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSwap(d)}
                        className="border-clinical-gold/40 text-clinical-gold hover:bg-clinical-gold/10 gap-1.5 text-xs"
                      >
                        <Replace className="w-3.5 h-3.5" /> Swap
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onReschedule(d)}
                        className="border-clinical-border text-clinical-zinc hover:text-white gap-1.5 text-xs"
                      >
                        <Clock className="w-3.5 h-3.5" /> Reschedule
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
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

  return (
    <Dialog open={delivery !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-clinical-surface border-clinical-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Replace className="w-4 h-4 text-clinical-gold" />
            Choose dishes for this delivery
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-clinical-zinc absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search dishes…"
                className="pl-8 h-9 bg-clinical-dark border-clinical-border text-white text-sm"
              />
            </div>
            <span
              className={`ml-3 text-xs tabular-nums shrink-0 ${totalSelected === mealsPerDelivery ? "text-clinical-sage" : "text-clinical-zinc"}`}
            >
              {totalSelected}/{mealsPerDelivery} meals
            </span>
          </div>

          <div className="max-h-[46vh] overflow-y-auto space-y-1.5 pr-1">
            {filtered.map((d: DishData) => {
              const qty = selected[d.slug] ?? 0;
              return (
                <div
                  key={d.slug}
                  className={`flex items-center gap-3 rounded-lg border p-2 ${qty > 0 ? "border-clinical-gold/40 bg-clinical-gold/5" : "border-clinical-border"}`}
                >
                  {d.image ? (
                    <img
                      src={d.image}
                      alt=""
                      className="w-10 h-10 rounded-md object-cover shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-md bg-clinical-dark shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{d.name}</p>
                    <p className="text-[10px] text-clinical-zinc tabular-nums">
                      {formatPrice(d.price)} · {d.macros.protein}g protein
                    </p>
                  </div>
                  {qty === 0 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setQty(d.slug, 1)}
                      className="h-8 border-clinical-gold/40 text-clinical-gold hover:bg-clinical-gold/10 text-xs"
                    >
                      Add
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => setQty(d.slug, qty - 1)}
                        className="h-7 w-7 border-clinical-border text-clinical-zinc"
                      >
                        −
                      </Button>
                      <span className="text-xs text-white tabular-nums w-4 text-center">{qty}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => setQty(d.slug, qty + 1)}
                        className="h-7 w-7 border-clinical-border text-clinical-zinc"
                      >
                        +
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-xs text-clinical-zinc text-center py-6">
                No dishes match “{query}”.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-clinical-border text-clinical-zinc"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            className="bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90 gap-1.5"
            disabled={totalSelected === 0 || saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onConfirm(buildItems());
              } finally {
                setSaving(false);
              }
            }}
          >
            <Check className="w-4 h-4" />
            {saving ? "Saving…" : "Save delivery"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
