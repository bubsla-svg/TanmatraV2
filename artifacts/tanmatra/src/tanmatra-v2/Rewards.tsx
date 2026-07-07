import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  loyaltyApi,
  type CreditLedgerEntry,
  type CreditLedgerReason,
  type NotificationItem,
  type NotificationKind,
  type ReferralResponse,
  type UserProfile,
} from "@/lib/loyaltyApi";

const REASON_LABEL: Record<CreditLedgerReason, string> = {
  referral_referrer_award: "Friend joined",
  referral_referee_signup: "Welcome bonus",
  loyalty_free_week: "Loyalty reward",
  premium_unlock_bonus: "Chef's tier unlock",
  birthday_meal: "Birthday meal",
  winback_offer: "Win-back offer",
  manual_grant: "Manual grant",
  checkout_redemption: "Used at checkout",
  expired: "Expired",
};

// Phosphor icon class names per notification kind (v2 uses Phosphor, not lucide).
const NOTIF_ICON: Record<NotificationKind, string> = {
  winback: "ph-arrow-clockwise",
  birthday: "ph-cake",
  anniversary: "ph-cake",
  loyalty_free_week: "ph-trophy",
  loyalty_premium_unlock: "ph-sparkle",
  protein_streak: "ph-warning",
  referral_redeemed: "ph-gift",
};

function formatPaise(p: number): string {
  const sign = p < 0 ? "-" : "";
  return `${sign}₹${Math.abs(p / 100).toFixed(0)}`;
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diff < day) return "Today";
  if (diff < 2 * day) return "Yesterday";
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return d.toLocaleDateString();
}

export default function V2Rewards() {
  const [referral, setReferral] = useState<ReferralResponse | null>(null);
  const [entries, setEntries] = useState<CreditLedgerEntry[]>([]);
  const [balancePaise, setBalancePaise] = useState(0);
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [anniversaryDate, setAnniversaryDate] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [r, c, n, p] = await Promise.all([
        loyaltyApi.getReferral(),
        loyaltyApi.getCreditLedger(),
        loyaltyApi.getNotifications(),
        loyaltyApi.getProfile(),
      ]);
      setReferral(r);
      setEntries(c.entries);
      setBalancePaise(c.balancePaise);
      setNotifs(n.notifications);
      setProfile(p.profile);
      if (p.profile?.birthDate) setBirthDate(p.profile.birthDate);
      if (p.profile?.anniversaryDate) setAnniversaryDate(p.profile.anniversaryDate);
      setUnauthorized(false);
    } catch (e) {
      if (String(e).startsWith("Error: 401")) {
        setUnauthorized(true);
      } else {
        toast.error("Failed to load rewards");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (unauthorized) {
    return (
      <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="content padx tc" style={{ padding: "72px 24px" }}>
            <i className="ph-fill ph-wallet safc" style={{ fontSize: 40 }} />
            <div className="h2 mt10" style={{ color: "#fff" }}>Sign in to see rewards</div>
            <div className="fine mt6">
              Earn credits, refer friends, and unlock Chef's tier perks.
            </div>
            <Link className="btn btn-p mt20" to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="appbar">
            <Link className="iconbtn" to="/" aria-label="Home"><i className="ph-bold ph-arrow-left" /></Link>
            <div className="abt">Rewards</div>
          </div>
          <div className="content padx" style={{ paddingTop: 4, paddingBottom: 24 }}>
            <div className="skel" style={{ height: 14, width: "38%" }} />
            <div className="skel mt8" style={{ height: 26, width: "80%" }} />
            <div className="skel mt8" style={{ height: 14, width: "100%" }} />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card mt12">
                <div className="skel" style={{ height: 16, width: "50%" }} />
                <div className="skel mt8" style={{ height: 42, width: "100%" }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const shareUrl = `${window.location.origin}${import.meta.env.BASE_URL}?ref=${referral?.code ?? ""}`;

  const copyCode = () => {
    if (!referral?.code) return;
    navigator.clipboard.writeText(referral.code);
    toast.success("Code copied");
  };
  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied");
  };

  const handleRedeem = async () => {
    if (!redeemCode.trim()) return;
    try {
      const out = await loyaltyApi.redeemReferral(redeemCode.trim());
      toast.success(
        out.awardedPaise > 0
          ? `+${formatPaise(out.awardedPaise)} added to your wallet`
          : "Code applied — credits land after your first order",
      );
      setRedeemCode("");
      refresh();
    } catch (e) {
      toast.error(String(e).replace(/^Error:\s*\d+:\s*/, "") || "Could not redeem");
    }
  };

  const handleEngine = async () => {
    try {
      const out = await loyaltyApi.runEngine();
      toast.success(
        out.triggered > 0
          ? `${out.triggered} new reward${out.triggered === 1 ? "" : "s"} unlocked`
          : "No new rewards yet — check back soon",
      );
      refresh();
    } catch {
      toast.error("Engine run failed");
    }
  };

  const handleSaveDates = async () => {
    const payload: { birthDate?: string; anniversaryDate?: string } = {};
    if (/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) payload.birthDate = birthDate;
    if (/^\d{4}-\d{2}-\d{2}$/.test(anniversaryDate))
      payload.anniversaryDate = anniversaryDate;
    if (!payload.birthDate && !payload.anniversaryDate) {
      toast.error("Pick at least one date");
      return;
    }
    try {
      await loyaltyApi.updateProfile(payload);
      toast.success("Saved — we'll celebrate your milestones with a free meal");
      refresh();
    } catch {
      toast.error("Could not save");
    }
  };

  const handleDismiss = async (id: number) => {
    try {
      await loyaltyApi.dismissNotification(id);
      setNotifs((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: "dismissed" } : n)),
      );
    } catch {
      toast.error("Could not dismiss");
    }
  };

  const activeNotifs = notifs.filter((n) => n.status !== "dismissed");
  const redeemedCount = referral?.redemptions.length ?? 0;

  return (
    <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="appbar">
          <Link className="iconbtn" to="/" aria-label="Home"><i className="ph-bold ph-arrow-left" /></Link>
          <div className="abt">Rewards</div>
        </div>

        <div className="content padx" style={{ paddingTop: 4, paddingBottom: 24 }}>
          {/* Hero */}
          <div className="lab" style={{ color: "var(--safb)", display: "flex", alignItems: "center", gap: 6 }}>
            <i className="ph-fill ph-sparkle" />Rewards
          </div>
          <h1 className="disp mt6" style={{ color: "#fff" }}>Refer, earn &amp; unlock perks</h1>
          <p className="small mut mt6">
            Refer friends, earn credits, and unlock loyalty perks on every plan.
          </p>

          {/* Referral code */}
          <div className="card mt16">
            <div className="fx ac gap8 mb10">
              <i className="ph-fill ph-gift safc" style={{ fontSize: 17 }} />
              <span className="tt">Your referral code</span>
            </div>
            <div className="fx ac wrap gap8">
              <span
                className="mono"
                style={{
                  fontSize: 24,
                  letterSpacing: ".16em",
                  color: "var(--safb)",
                  background: "var(--safd)",
                  border: "1px solid var(--saf)",
                  borderRadius: 10,
                  padding: "8px 16px",
                }}
              >
                {referral?.code}
              </span>
              <button className="btn btn-g" onClick={copyCode} style={{ height: 40 }}>
                <i className="ph-bold ph-copy" />Code
              </button>
              <button className="btn btn-g" onClick={copyLink} style={{ height: 40 }}>
                <i className="ph-bold ph-share-network" />Link
              </button>
            </div>
            <p className="fine mt10">
              You get {formatPaise(referral?.awards.referrerPaise ?? 0)} when a friend signs up. They get {formatPaise(referral?.awards.refereePaise ?? 0)} on their first order.
            </p>
            <div className="lab mt6">
              {redeemedCount} friend{redeemedCount === 1 ? "" : "s"} redeemed so far
            </div>
          </div>

          {/* Credit balance */}
          <div className="card mt12">
            <div className="fx ac gap8 mb6">
              <i className="ph-fill ph-wallet sagec" style={{ fontSize: 17 }} />
              <span className="tt">Credit balance</span>
            </div>
            <div className="disp sagec">{formatPaise(balancePaise)}</div>
            <div className="fine mt4">Auto-applied at checkout up to your subtotal.</div>
          </div>

          {/* Redeem a code */}
          <div className="card mt12">
            <div className="fx ac gap8 mb10">
              <i className="ph-fill ph-ticket safc" style={{ fontSize: 17 }} />
              <span className="tt">Have a code?</span>
            </div>
            <div className="fx gap8">
              <div className="inp f1">
                <i className="ph-bold ph-tag" />
                <input
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                  placeholder="ENTER CODE"
                  aria-label="Referral code"
                  style={{ fontFamily: "'JetBrains Mono',ui-monospace,monospace", letterSpacing: ".14em" }}
                />
              </div>
              <button className="btn btn-p" onClick={handleRedeem}>Redeem</button>
            </div>
            <p className="fine mt10">
              One referral per account. Credits expire 90 days after issuance.
            </p>
          </div>

          {/* Inbox */}
          <div className="card mt12">
            <div className="fx ac jb wrap gap8 mb10">
              <div className="fx ac gap8">
                <i className="ph-fill ph-bell safc" style={{ fontSize: 17 }} />
                <span className="tt">Inbox</span>
                {activeNotifs.length > 0 && (
                  <span className="pill sg">{activeNotifs.length}</span>
                )}
              </div>
              <button
                className="btn btn-g"
                onClick={handleEngine}
                style={{ height: 36, padding: "0 12px", fontSize: 13 }}
              >
                <i className="ph-bold ph-arrow-clockwise" />Check for new rewards
              </button>
            </div>
            {activeNotifs.length === 0 ? (
              <div className="fine tc" style={{ padding: "16px 4px" }}>
                No new messages. Tap "Check for new rewards" — we evaluate loyalty rules, win-back offers, birthday gifts, and your goals.
              </div>
            ) : (
              activeNotifs.map((n) => {
                const icon = NOTIF_ICON[n.kind] ?? "ph-bell";
                return (
                  <div
                    key={n.id}
                    className="fx gap12 mb8"
                    style={{
                      alignItems: "flex-start",
                      padding: 12,
                      borderRadius: 10,
                      border: "1px solid var(--ln)",
                      background: "var(--s2)",
                    }}
                  >
                    <div
                      className="dic"
                      style={{ width: 36, height: 36, background: "var(--safd)", color: "var(--safb)", fontSize: 17 }}
                    >
                      <i className={`ph-fill ${icon}`} />
                    </div>
                    <div className="f1" style={{ minWidth: 0 }}>
                      <div className="small" style={{ fontWeight: 600 }}>{n.title}</div>
                      <div className="fine mt2">{n.body}</div>
                      <div className="lab mt4">{formatRelative(n.createdAt)}</div>
                    </div>
                    <button
                      className="qbtn"
                      onClick={() => handleDismiss(n.id)}
                      aria-label="Dismiss"
                    >
                      <i className="ph-bold ph-check" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Birthday & anniversary */}
          <div className="card mt12">
            <div className="fx ac gap8 mb6">
              <i className="ph-fill ph-cake" style={{ color: "var(--dgr)", fontSize: 17 }} />
              <span className="tt">Birthday &amp; anniversary</span>
            </div>
            <p className="fine mb10">
              Save your dates and we'll auto-credit a free meal each year.
            </p>
            <div className="fx wrap gap12">
              <div className="f1" style={{ minWidth: 140 }}>
                <div className="lab mb6">Birthday</div>
                <div className="inp">
                  <i className="ph-bold ph-cake" />
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    aria-label="Birthday"
                  />
                </div>
              </div>
              <div className="f1" style={{ minWidth: 140 }}>
                <div className="lab mb6">Anniversary with Tanmatra</div>
                <div className="inp">
                  <i className="ph-bold ph-heart" />
                  <input
                    type="date"
                    value={anniversaryDate}
                    onChange={(e) => setAnniversaryDate(e.target.value)}
                    aria-label="Anniversary"
                  />
                </div>
              </div>
            </div>
            <button className="btn btn-g mt12" onClick={handleSaveDates}>Save dates</button>
            {(profile?.birthDate || profile?.anniversaryDate) && (
              <div className="fine mt10" style={{ color: "var(--sage)" }}>
                {profile?.birthDate ? `Birthday: ${new Date(profile.birthDate).toLocaleDateString(undefined, { day: "numeric", month: "long" })}` : ""}
                {profile?.birthDate && profile?.anniversaryDate ? " · " : ""}
                {profile?.anniversaryDate ? `Anniversary: ${new Date(profile.anniversaryDate).toLocaleDateString(undefined, { day: "numeric", month: "long" })}` : ""}
              </div>
            )}
          </div>

          {/* Credit history */}
          <div className="card mt12">
            <div className="fx ac gap8 mb10">
              <i className="ph-fill ph-receipt fntc" style={{ fontSize: 17 }} />
              <span className="tt">Credit history</span>
            </div>
            {entries.length === 0 ? (
              <div className="fine tc" style={{ padding: "16px 4px" }}>
                No credits yet. Refer a friend or wait for a loyalty unlock.
              </div>
            ) : (
              entries.map((e) => (
                <div
                  key={e.id}
                  className="fx ac jb gap12"
                  style={{ padding: "11px 0", borderTop: "1px solid var(--ln)" }}
                >
                  <div className="f1" style={{ minWidth: 0 }}>
                    <div className="small clamp1">
                      {REASON_LABEL[e.reason]}
                      {e.note ? ` — ${e.note}` : ""}
                    </div>
                    <div className="lab mt2">
                      {formatRelative(e.createdAt)}
                      {e.expiresAt
                        ? ` · expires ${new Date(e.expiresAt).toLocaleDateString()}`
                        : ""}
                    </div>
                  </div>
                  <span
                    className={`price ${e.deltaPaise < 0 ? "dgrc" : "sagec"}`}
                    style={{ flex: "none" }}
                  >
                    {e.deltaPaise > 0 ? "+" : ""}
                    {formatPaise(e.deltaPaise)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
