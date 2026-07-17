import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { premiumApi } from "@/lib/marketplaceApi";
import { formatPrice } from "@/lib/api/adapter";

const BENEFITS = [
  {
    icon: "ph-truck",
    title: "Priority delivery",
    desc: "Your orders jump the kitchen queue and ship in our first rider wave — typically 12–18 min faster.",
  },
  {
    icon: "ph-stethoscope",
    title: "1 free RD consult / month",
    desc: `30-minute video session with a registered dietitian — typically ${formatPrice(149900)} — included every billing period.`,
  },
  {
    icon: "ph-crown",
    title: "Premium-only meals",
    desc: "Access chef-table dishes (Wild salmon, dry-aged ribeye, miso black cod) reserved for members.",
  },
  {
    icon: "ph-sparkle",
    title: "Exclusive add-ons",
    desc: "Marine collagen, chef-curated tonics, and limited drops in your checkout add-on rail.",
  },
];

export default function V2Premium() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["premium", "me"],
    queryFn: premiumApi.me,
  });

  const subscribe = useMutation({
    mutationFn: premiumApi.subscribe,
    onSuccess: () => {
      toast.success("Welcome to Tanmatra Premium", {
        description: "Premium-only dishes are now unlocked across the menu.",
        action: {
          label: "Browse menu",
          onClick: () => navigate("/menu"),
        },
      });
      qc.invalidateQueries({ queryKey: ["premium", "me"] });
    },
    onError: (err) => {
      const msg = String((err as Error).message);
      if (msg.includes("401")) {
        toast.error("Sign in to subscribe", {
          action: {
            label: "Sign in",
            onClick: () => navigate("/login?next=/premium"),
          },
        });
      } else if (msg.includes("already")) {
        toast.message("You're already a premium member");
      } else {
        toast.error("Could not subscribe — please try again");
      }
    },
  });

  const cancel = useMutation({
    mutationFn: premiumApi.cancel,
    onSuccess: () => {
      toast.success("Membership will end at period close");
      qc.invalidateQueries({ queryKey: ["premium", "me"] });
    },
    onError: () => toast.error("Could not cancel — please try again"),
  });

  const isPremium = status.data?.isPremium ?? false;
  const membership = status.data?.membership ?? null;
  const pricePaise = status.data?.pricePaise ?? 99900;

  return (
    <div className="tnm2 nn min-h-screen bg-[var(--tnm-surface-ink)] text-white antialiased">
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="appbar">
          <Link className="iconbtn" to="/" aria-label="Home"><i className="ph-bold ph-arrow-left" /></Link>
          <div className="abt">Premium</div>
        </div>
        <div className="content padx" style={{ paddingTop: 8, paddingBottom: 24 }}>
          {status.isError ? (
            <div className="tc" style={{ padding: "52px 20px" }}>
              <i className="ph-bold ph-warning-circle" style={{ fontSize: 32, color: "var(--fnt)" }} />
              <div className="tt mt10">Couldn't load Premium</div>
              <div className="fine mt6">Check your connection and try again.</div>
              <button className="btn btn-g mt20" onClick={() => status.refetch()}>Try again</button>
            </div>
          ) : (
            <>
              <div className="tc" style={{ padding: "16px 4px 6px" }}>
                <span className="pill" style={{ background: "var(--safd)", color: "var(--safb)" }}>
                  <i className="ph-fill ph-crown" />TANMATRA PREMIUM
                </span>
                <h1 className="disp mt10">Eat better, recover faster, get expert guidance.</h1>
                <p className="small mut mt6" style={{ maxWidth: 340, margin: "6px auto 0" }}>
                  One membership unlocks priority delivery, a monthly RD consult, premium-only dishes and exclusive pantry drops.
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--tnm-action)]/30 bg-[var(--tnm-action)]/10 p-4 mt14">
                <div className="fx gap8" style={{ alignItems: "baseline" }}>
                  <span className="disp safc">{formatPrice(pricePaise)}</span>
                  <span className="lab">/ month</span>
                </div>

                {isPremium && membership ? (
                  <div className="mt10">
                    <div className="fx ac gap8 sagec small" style={{ fontWeight: 600 }}>
                      <i className="ph-fill ph-check-circle" style={{ fontSize: 16, flex: "none" }} />
                      <span>
                        Active membership — {membership.status === "cancelled" ? "ends" : "renews"} on{" "}
                        {new Date(membership.currentPeriodEnd).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="fine mono mt6">
                      RD consults used this period:{" "}
                      <span style={{ color: "var(--tx)", fontWeight: 700 }}>
                        {membership.rdConsultsUsedThisPeriod} / {membership.rdConsultsPerPeriod}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="fine mt6">
                    Delivered fresh in 25–40 min priority wave · Cancel anytime · Refund within 7 days
                  </div>
                )}

                <div className="mt14">
                  {status.isLoading ? (
                    <button className="btn btn-p btn-lg btn-blk dis" disabled>
                      <i className="ph-fill ph-crown" />Join Tanmatra Premium
                    </button>
                  ) : isPremium ? (
                    <>
                      <Link className="btn btn-p btn-lg btn-blk" to="/rd">
                        <i className="ph-fill ph-stethoscope" />Book free RD consult
                      </Link>
                      {membership?.status !== "cancelled" && (
                        <button
                          className={"btn btn-g btn-blk mt10" + (cancel.isPending ? " dis" : "")}
                          onClick={() => cancel.mutate()}
                          disabled={cancel.isPending}
                        >
                          {cancel.isPending ? "Cancelling…" : "Cancel renewal"}
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      className={"btn btn-p btn-lg btn-blk" + (subscribe.isPending ? " dis" : "")}
                      onClick={() => subscribe.mutate()}
                      disabled={subscribe.isPending}
                    >
                      <i className="ph-fill ph-crown" />
                      {subscribe.isPending ? "Activating membership…" : "Join Tanmatra Premium"}
                    </button>
                  )}
                </div>
              </div>

              <div className="text-[11px] font-semibold tracking-[0.06em] uppercase text-white/50 mt20 mb10">What's included</div>
              <div className="prodgrid">
                {BENEFITS.map((b) => (
                  <div key={b.title} className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4">
                    <span className="dic" style={{ background: "var(--safd)", color: "var(--safb)" }}>
                      <i className={"ph-bold " + b.icon} />
                    </span>
                    <div className="tt mt10" style={{ fontSize: 14 }}>{b.title}</div>
                    <div className="fine mt4">{b.desc}</div>
                  </div>
                ))}
              </div>

              <div className="note mt14">
                <i className="ph-bold ph-shield-check" />
                <span>
                  Premium is operated directly by Tanmatra Health Technologies. RD consults are conducted by registered dietitians on our care team. Priority delivery is a kitchen-queue benefit — not a delivery-time guarantee. Cancel anytime from your account.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
