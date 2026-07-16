import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { subscriptionsApi } from "@/lib/subscriptionsApi";
import type { Subscription, SubscriptionDelivery } from "@/lib/subscriptionsApi";

export const meta = () => [
  { title: "Billing & Mandates | Tanmatra" },
  { name: "robots", content: "noindex, follow" },
];

export const handle = { chrome: false };

interface SubDetails {
  subscription: Subscription;
  deliveries: SubscriptionDelivery[];
  mandate?: { id: number; status: string; nextChargeAt: string | null } | null;
}

const getThursdayCutoff = () => {
  const now = new Date();
  const day = now.getDay();
  const daysToThursday = 4 - day;
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() + daysToThursday);
  cutoff.setHours(17, 0, 0, 0);
  return cutoff;
};

export default function Billing() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeSub, setActiveSub] = useState<Subscription | null>(null);
  const [details, setDetails] = useState<SubDetails | null>(null);
  
  const [timeLeft, setTimeLeft] = useState<{ expired: boolean; days: number; hours: number; minutes: number } | null>(null);
  
  const [confirmModal, setConfirmModal] = useState<"skip" | "pause" | "cancel" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSubscriptionDetails = useCallback(async (id: number) => {
    try {
      const data = await subscriptionsApi.get(id);
      setDetails(data);
    } catch (err) {
      toast.error("Failed to load subscription billing details");
    }
  }, []);

  const fetchActiveSubscription = useCallback(async () => {
    try {
      const res = await subscriptionsApi.list();
      const sub = res.subscriptions.find(s => s.status === "active") || res.subscriptions[0] || null;
      setActiveSub(sub);
      if (sub) {
        await fetchSubscriptionDetails(sub.id);
      }
    } catch (err) {
      if (err instanceof Error && err.message === "unauthorized") {
        toast.error("Please sign in to view billing");
        navigate("/login?next=/account/billing");
      } else {
        toast.error("Failed to load plans");
      }
    } finally {
      setLoading(false);
    }
  }, [fetchSubscriptionDetails, navigate]);

  useEffect(() => {
    fetchActiveSubscription();
  }, [fetchActiveSubscription]);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const cutoff = getThursdayCutoff();
      if (now > cutoff) {
        setTimeLeft({ expired: true, days: 0, hours: 0, minutes: 0 });
      } else {
        const diffMs = cutoff.getTime() - now.getTime();
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft({ expired: false, days, hours, minutes });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSkip = async () => {
    if (!activeSub) return;
    setActionLoading(true);
    try {
      await subscriptionsApi.skipSubscription(activeSub.id);
      toast.success("Next week's delivery skipped successfully", {
        description: "Your skipped meals have been credited to your account.",
      });
      setConfirmModal(null);
      if (activeSub) await fetchSubscriptionDetails(activeSub.id);
    } catch (err) {
      toast.error("Failed to skip delivery", {
        description: err instanceof Error ? err.message : "Please try again later.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    if (!activeSub) return;
    setActionLoading(true);
    try {
      await subscriptionsApi.pause(activeSub.id);
      toast.success("Subscription paused");
      setConfirmModal(null);
      await fetchActiveSubscription();
    } catch (err) {
      toast.error("Failed to pause subscription", {
        description: err instanceof Error ? err.message : "",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!activeSub) return;
    setActionLoading(true);
    try {
      await subscriptionsApi.cancel(activeSub.id);
      toast.success("Subscription cancelled");
      setConfirmModal(null);
      await fetchActiveSubscription();
    } catch (err) {
      toast.error("Failed to cancel subscription", {
        description: err instanceof Error ? err.message : "",
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="tnm2 nn" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ textAlign: "center" }}>
          <div className="mono fine">Loading billing options...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="tnm2 nn" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {/* AppBar */}
        <div className="appbar">
          <Link className="iconbtn" to="/account" aria-label="Account">
            <i className="ph-bold ph-arrow-left" />
          </Link>
          <div className="abt">Billing & Mandates</div>
        </div>

        <div className="content padx" style={{ paddingTop: 16, paddingBottom: 40 }}>
          {!activeSub ? (
            <div className="card text-center py24">
              <i className="ph-bold ph-credit-card text-stone-300" style={{ fontSize: 48 }} />
              <h2 className="h2 mt12" style={{ color: "var(--tx)" }}>No active plans</h2>
              <p className="fine mt4 text-stone-500">You don't have any subscription plans active currently.</p>
              <div className="mt16">
                <Link to="/plans" className="btn btn-p w100">Explore Plans</Link>
              </div>
            </div>
          ) : (
            <>
              {/* Billing Info Card */}
              <div className="card mb16">
                <div className="lab fx ac gap8 mb12" style={{ fontSize: 13 }}>
                  <i className="ph-bold ph-wallet safc" /> Active Billing Cycle
                </div>
                
                {details?.mandate ? (
                  <div className="mb12">
                    <span className="pill sg" style={{ background: "var(--saged)", color: "var(--sage)" }}>
                      ✓ UPI Autopay Active
                    </span>
                  </div>
                ) : (
                  <div className="mb12">
                    <span className="pill" style={{ background: "var(--safd)", color: "var(--safb)" }}>
                      Manual Renewal
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mt12">
                  <div>
                    <span className="fine text-stone-500 block">Next Charge Amount</span>
                    <span className="text-xl font-bold" style={{ color: "var(--tx)" }}>
                      ₹{Math.round(activeSub.pricePerDeliveryPaise / 100).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div>
                    <span className="fine text-stone-500 block">Next Charge Date</span>
                    <span className="font-semibold block" style={{ fontSize: 13, color: "var(--tx)" }}>
                      {details?.mandate?.nextChargeAt
                        ? new Date(details.mandate.nextChargeAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : new Date(activeSub.nextDeliveryAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Skip Next Week Card */}
              <div className="card mb16">
                <div className="lab fx ac gap8 mb12" style={{ fontSize: 13 }}>
                  <i className="ph-bold ph-skip-forward safc" /> Skip Next Delivery
                </div>
                
                {timeLeft && (
                  <div className="mb16">
                    {timeLeft.expired ? (
                      <div className="p-3 bg-red-50 text-red-700 rounded-lg fx ac gap8">
                        <i className="ph-bold ph-lock-key" />
                        <span className="fine font-semibold" style={{ fontSize: 11.5 }}>
                          Next week's order locked (Cutoff passed)
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="fine text-stone-500 block">Time remaining to skip:</span>
                        <span className="mono font-bold text-stone-800" style={{ fontSize: 14 }}>
                          {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m
                        </span>
                        <span className="fine text-stone-400 block mt1">Weekly cutoff: Thursday 5:00 PM</span>
                      </div>
                    )}
                  </div>
                )}

                <button
                  disabled={timeLeft?.expired || activeSub.status !== "active"}
                  onClick={() => setConfirmModal("skip")}
                  className={`btn w100 text-center py10 ${timeLeft?.expired || activeSub.status !== "active" ? "btn-g opacity-50 cursor-not-allowed" : "btn-p"}`}
                  style={!(timeLeft?.expired || activeSub.status !== "active") ? { background: "transparent", border: "1px solid var(--saf)", color: "var(--safb)" } : undefined}
                >
                  Skip next week
                </button>
              </div>

              {/* Self-Serve Controls Card */}
              <div className="card mb16">
                <div className="lab fx ac gap8 mb14" style={{ fontSize: 13 }}>
                  <i className="ph-bold ph-sliders-horizontal safc" /> Subscription Settings
                </div>

                <div className="fx flex-col gap8">
                  {activeSub.status === "active" ? (
                    <button
                      onClick={() => setConfirmModal("pause")}
                      className="btn btn-g w100 py10 text-center text-amber-700 hover:bg-amber-50"
                      style={{ border: "1px solid var(--tnm-caution)", background: "transparent" }}
                    >
                      Pause plan
                    </button>
                  ) : activeSub.status === "paused" ? (
                    <button
                      onClick={async () => {
                        try {
                          await subscriptionsApi.resume(activeSub.id);
                          toast.success("Subscription resumed");
                          await fetchActiveSubscription();
                        } catch (err) {
                          toast.error("Failed to resume subscription");
                        }
                      }}
                      className="btn btn-p w100 py10 text-center"
                    >
                      Resume plan
                    </button>
                  ) : null}

                  {activeSub.status !== "cancelled" && (
                    <button
                      onClick={() => setConfirmModal("cancel")}
                      className="btn btn-g w100 py10 text-center text-red-600 hover:bg-red-50"
                      style={{ border: "1px solid var(--tnm-alert)", background: "transparent" }}
                    >
                      Cancel plan
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Confirmation Modals */}
      {confirmModal && (
        <div
          className="tnm2 nn bg-black/60"
          style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setConfirmModal(null)}
        >
          <div
            className="card w-full p-6"
            style={{ maxWidth: 480, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="h3 font-bold mb10" style={{ color: "var(--tx)" }}>
              {confirmModal === "skip" && "Skip Next Week?"}
              {confirmModal === "pause" && "Pause Plan?"}
              {confirmModal === "cancel" && "Cancel Plan?"}
            </h3>
            
            <p className="fine mb20" style={{ fontSize: 12, color: "var(--mut)" }}>
              {confirmModal === "skip" && "Are you sure you want to skip next week's delivery? The skipped meals will be refunded to your account balance as credits."}
              {confirmModal === "pause" && "This will temporarily pause your active deliveries. You can resume them at any time from your settings."}
              {confirmModal === "cancel" && "Are you sure you want to cancel your plan? This action will stop all future recurring payments. Any remaining paid credits will stay in your wallet."}
            </p>

            <div className="fx flex-col gap8">
              {confirmModal === "skip" && (
                <button
                  disabled={actionLoading}
                  onClick={handleSkip}
                  className="btn btn-p w100 text-center py12"
                >
                  {actionLoading ? "Skipping..." : "Yes, skip next week (Confirm)"}
                </button>
              )}
              {confirmModal === "pause" && (
                <button
                  disabled={actionLoading}
                  onClick={handlePause}
                  className="btn w100 text-center py12"
                  style={{ background: "var(--safd)", color: "var(--safb)", border: "1px solid var(--saf)" }}
                >
                  {actionLoading ? "Pausing..." : "Yes, pause plan (Confirm)"}
                </button>
              )}
              {confirmModal === "cancel" && (
                <button
                  disabled={actionLoading}
                  onClick={handleCancel}
                  className="btn w100 text-center py12 dgrc"
                  style={{ background: "var(--dgrd)", border: "1px solid var(--dgr)" }}
                >
                  {actionLoading ? "Cancelling..." : "Yes, cancel plan (Confirm)"}
                </button>
              )}

              <button
                disabled={actionLoading}
                onClick={() => setConfirmModal(null)}
                className="btn btn-g w100 text-center py12"
                style={{ border: "1px solid var(--ln)", background: "transparent" }}
              >
                Back / Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
