import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { loyaltyApi } from "@/lib/loyaltyApi";
import { subscriptionsApi, subscriptionKeys } from "@/lib/subscriptionsApi";
import { corporateApi } from "@/lib/corporateApi";
import { usePremiumStatus } from "@/lib/usePremium";
import {
  themeOverrideStore,
  useThemeOverride,
  type ThemeChoice,
} from "@/lib/clinicalTheme";
import { useClinicalMode } from "@/lib/clinicalDiet";
import { API_BASE } from "@/lib/apiBase";

interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

function useAuthUser() {
  return useQuery({
    queryKey: ["auth", "user"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/auth/user`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await res.json()) as { user: AuthUser | null };
      return data.user;
    },
    staleTime: 30_000,
    retry: false,
  });
}

function isUnauth(err: unknown): boolean {
  return String((err as Error)?.message ?? "").startsWith("401");
}

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

function displayName(user: AuthUser): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (user.email) return user.email.split("@")[0];
  return "Welcome";
}

function initials(user: AuthUser): string {
  const first = user.firstName?.[0] ?? "";
  const last = user.lastName?.[0] ?? "";
  const fromName = `${first}${last}`.trim();
  if (fromName) return fromName.toUpperCase();
  if (user.email) return user.email[0]!.toUpperCase();
  return "T";
}

interface SectionLink {
  to: string;
  label: string;
  desc: string;
  icon: string;
}

const SECTIONS: SectionLink[] = [
  {
    to: "/preferences",
    label: "Preferences",
    desc: "Diet, allergens, macro targets",
    icon: "ph-sliders-horizontal",
  },
  {
    to: "/subscriptions",
    label: "My subscriptions",
    desc: "Active weekly meal plans",
    icon: "ph-calendar",
  },
  {
    to: "/orders",
    label: "Order history",
    desc: "Past & upcoming orders",
    icon: "ph-package",
  },
  {
    to: "/account/addresses",
    label: "Address book",
    desc: "Saved delivery addresses",
    icon: "ph-map-pin",
  },
  {
    to: "/rewards",
    label: "Rewards",
    desc: "Credit balance, referrals & ledger",
    icon: "ph-sparkle",
  },
  {
    to: "/vouchers",
    label: "Vouchers",
    desc: "Buy gift cards or redeem a code",
    icon: "ph-gift",
  },
  {
    to: "/premium",
    label: "Premium",
    desc: "Chef's tier benefits & membership",
    icon: "ph-crown",
  },
  {
    to: "/refunds",
    label: "Refunds & cancellation",
    desc: "Refund policy & Grievance Officer",
    icon: "ph-arrow-counter-clockwise",
  },
];

export default function V2Account() {
  const auth = useAuthUser();
  const user = auth.data ?? null;
  const isAuthenticated = !!user;

  const ledger = useQuery({
    queryKey: ["loyalty", "credit-ledger"],
    queryFn: () => loyaltyApi.getCreditLedger(),
    enabled: isAuthenticated,
    retry: false,
    staleTime: 30_000,
  });

  const subs = useQuery({
    // Shared cache key (subscriptionKeys.list) — pausing/resuming/cancelling
    // from Subscriptions.tsx or Billing.tsx invalidates this same query, so
    // the "active plans" count below can't go stale until a hard reload.
    queryKey: subscriptionKeys.list,
    queryFn: () => subscriptionsApi.list(),
    enabled: isAuthenticated,
    retry: false,
    staleTime: 30_000,
  });

  const vouchers = useQuery({
    queryKey: ["vouchers", "mine"],
    queryFn: () => corporateApi.myVouchers(),
    enabled: isAuthenticated,
    retry: false,
    staleTime: 30_000,
  });

  const premium = usePremiumStatus();

  const balancePaise = isUnauth(ledger.error) ? 0 : ledger.data?.balancePaise ?? 0;
  const activeSubs = isUnauth(subs.error)
    ? 0
    : (subs.data?.subscriptions ?? []).filter((s) => s.status === "active")
        .length;
  const voucherCount = isUnauth(vouchers.error)
    ? 0
    : (vouchers.data?.purchased.length ?? 0) +
      (vouchers.data?.redeemed.length ?? 0);

  const loginHref = `/login?next=${encodeURIComponent("/account")}`;
  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore — we still hard-redirect so cached UI clears
    }
    window.location.href = "/";
  };

  return (
    <div className="tnm2 nn min-h-screen bg-[var(--tnm-surface-ink)] text-white antialiased">
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="appbar">
          <Link className="iconbtn" to="/" aria-label="Home">
            <i className="ph-bold ph-arrow-left" />
          </Link>
          <div className="abt">Account</div>
        </div>

        <div className="content padx" style={{ paddingTop: 4, paddingBottom: 24 }}>
          <p className="fine mb14">
            Your profile, plan, and Tanmatra benefits in one place.
          </p>

          {/* Profile / sign-in card */}
          <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 mb14">
            {auth.isLoading ? (
              <div className="fx ac gap12">
                <div className="skel round" style={{ width: 56, height: 56, flex: "none" }} />
                <div className="f1">
                  <div className="skel" style={{ height: 15, width: "60%" }} />
                  <div className="skel mt8" style={{ height: 12, width: "80%" }} />
                </div>
              </div>
            ) : isAuthenticated && user ? (
              <div className="fx ac gap12">
                {user.profileImageUrl ? (
                  <img
                    src={user.profileImageUrl}
                    alt=""
                    className="round"
                    style={{
                      width: 56,
                      height: 56,
                      objectFit: "cover",
                      flex: "none",
                      border: "1px solid var(--ln2)",
                    }}
                  />
                ) : (
                  <span className="avatar big safc" aria-hidden>
                    {initials(user)}
                  </span>
                )}
                <div className="f1" style={{ minWidth: 0 }}>
                  <div className="tt clamp1">{displayName(user)}</div>
                  {user.email && (
                    <div className="fine clamp1">{user.email}</div>
                  )}
                  <div className="mt6">
                    {premium.isPremium ? (
                      <span
                        className="pill"
                        style={{ background: "var(--safd)", color: "var(--safb)" }}
                      >
                        <i className="ph-fill ph-crown" />
                        Premium member
                      </span>
                    ) : (
                      <span className="pill">Free tier</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="fx ac gap12">
                  <span className="avatar big fntc" aria-hidden>
                    <i className="ph-bold ph-user-circle" />
                  </span>
                  <div className="f1" style={{ minWidth: 0 }}>
                    <div className="tt">You're not signed in</div>
                    <div className="fine mt2">
                      Sign in to track orders, save preferences, and earn rewards.
                    </div>
                  </div>
                </div>
                <a className="btn btn-p btn-blk mt14" href={loginHref}>
                  <i className="ph-bold ph-sign-in" />
                  Sign in
                </a>
              </div>
            )}
          </div>

          {/* Quick stats — only show when authed */}
          {isAuthenticated && (
            <div
              className="grid mb14"
              style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}
            >
              <StatTile
                icon="ph-wallet"
                label="Rewards"
                value={ledger.isLoading ? "—" : formatRupees(balancePaise)}
                sub="balance"
                to="/rewards"
              />
              <StatTile
                icon="ph-calendar"
                label="Plans"
                value={subs.isLoading ? "—" : String(activeSubs)}
                sub="active"
                to="/subscriptions"
              />
              <StatTile
                icon="ph-gift"
                label="Vouchers"
                value={vouchers.isLoading ? "—" : String(voucherCount)}
                sub="on file"
                to="/vouchers"
              />
              <StatTile
                icon="ph-crown"
                label="Premium"
                value={premium.isLoading ? "—" : premium.isPremium ? "On" : "Off"}
                sub={premium.isPremium ? "member" : "upgrade"}
                to="/premium"
              />
            </div>
          )}

          {/* Section list */}
          {SECTIONS.map((s) => (
            <Link key={s.to} className="door" to={s.to}>
              <span className="dic">
                <i className={`ph-bold ${s.icon}`} aria-hidden />
              </span>
              <div className="f1" style={{ minWidth: 0 }}>
                <div className="small" style={{ fontWeight: 600 }}>
                  {s.label}
                </div>
                <div className="fine mt2">{s.desc}</div>
              </div>
              <i className="ph-bold ph-caret-right fntc" style={{ flex: "none" }} />
            </Link>
          ))}

          <ThemeToggleCard />

          {/* Sign-out / trust card */}
          <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 mt14">
            {isAuthenticated ? (
              <>
                <div className="fx ac jb gap12">
                  <div style={{ minWidth: 0 }}>
                    <div className="small" style={{ fontWeight: 600 }}>
                      Sign out
                    </div>
                    <div className="fine mt2">End your session on this device.</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-g"
                    onClick={handleLogout}
                    style={{ flex: "none" }}
                  >
                    <i className="ph-bold ph-sign-out" />
                    Sign out
                  </button>
                </div>
                <div
                  className="fine fx ac g6 mt14"
                  style={{ paddingTop: 12, borderTop: "1px solid var(--ln)" }}
                >
                  <i className="ph-fill ph-shield-check sagec" style={{ flex: "none" }} />
                  <span>Secured by Firebase · ISO 22000 · FSSAI Lic. 22725926001018</span>
                </div>
              </>
            ) : (
              <div className="fine fx ac g6">
                <i className="ph-fill ph-shield-check sagec" style={{ flex: "none" }} />
                <span>Secured by Firebase · ISO 22000 · FSSAI Lic. 22725926001018</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ThemeToggleCard() {
  const override = useThemeOverride();
  const { enabled: clinicalEnabled } = useClinicalMode();
  const options: { value: ThemeChoice; label: string; sub: string }[] = [
    {
      value: "auto",
      label: "Auto",
      sub: clinicalEnabled
        ? "Clinical theme on (clinical mode active)"
        : "Default theme on",
    },
    { value: "clinical", label: "Clinical", sub: "High-contrast WCAG AAA" },
    { value: "default", label: "Default", sub: "Marketing-friendly visuals" },
  ];
  return (
    <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 mt14">
      <div className="fx gap12" style={{ alignItems: "flex-start" }}>
        <span className="dic" style={{ flex: "none" }}>
          <i className="ph-bold ph-shield-check" aria-hidden />
        </span>
        <div className="f1" style={{ minWidth: 0 }}>
          <div className="small" style={{ fontWeight: 600 }}>
            Display theme
          </div>
          <div className="fine mt2">
            Clinical mode auto-applies the high-contrast theme. Pin it on or off
            here.
          </div>
        </div>
      </div>
      <div
        role="radiogroup"
        aria-label="Display theme"
        className="grid mt12"
        style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}
      >
        {options.map((o) => {
          const active = override === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => themeOverrideStore.set(o.value)}
              className="pointer"
              style={{
                padding: "10px",
                minHeight: 48,
                borderRadius: 10,
                textAlign: "left",
                border: `1px solid ${active ? "var(--tnm-action)" : "var(--ln)"}`,
                background: active ? "color-mix(in srgb, var(--tnm-action) 14%, transparent)" : "var(--tnm-surface-ink)",
              }}
            >
              <div
                className="fs13 fw6"
                style={{ color: active ? "var(--tnm-action)" : "var(--tnm-text-primary)" }}
              >
                {o.label}
              </div>
              <div className="fine mt2" style={{ fontSize: 11, lineHeight: 1.3 }}>
                {o.sub}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  sub,
  to,
}: {
  icon: string;
  label: string;
  value: string;
  sub: string;
  to: string;
}) {
  return (
    <Link className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 pointer" to={to} style={{ display: "block" }}>
      <div className="lab fx ac g6">
        <i className={`ph-bold ${icon} safc`} aria-hidden />
        {label}
      </div>
      <div className="rv sf mt6" style={{ fontSize: 20 }}>
        {value}
      </div>
      <div className="fine mt2">{sub}</div>
    </Link>
  );
}
