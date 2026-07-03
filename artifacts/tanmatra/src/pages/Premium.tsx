import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link, useNavigate, type MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Tanmatra Premium" },
  { name: "description", content: "Unlock exclusive dishes, priority delivery, advanced meal planning, and direct access to your personal registered dietitian with Tanmatra Premium." },
  { property: "og:title", content: "Tanmatra Premium" },
  { property: "og:description", content: "Unlock exclusive dishes, priority delivery, and direct access to your personal registered dietitian." },
  { property: "og:image", content: "https://tanmatra.food/opengraph.jpg" },
];
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Crown,
  Truck,
  Stethoscope,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { premiumApi } from "@/lib/marketplaceApi";
import { formatPrice } from "@/lib/api/adapter";

const BENEFITS = [
  {
    icon: Truck,
    title: "Priority delivery",
    desc: "Your orders jump the kitchen queue and ship in our first rider wave — typically 12–18 min faster.",
  },
  {
    icon: Stethoscope,
    title: "1 free RD consult / month",
    desc: "30-minute video session with a registered dietitian — typically ₹1,499 — included every billing period.",
  },
  {
    icon: Crown,
    title: "Premium-only meals",
    desc: "Access chef-table dishes (Wild salmon, dry-aged ribeye, miso black cod) reserved for members.",
  },
  {
    icon: Sparkles,
    title: "Exclusive add-ons",
    desc: "Marine collagen, chef-curated tonics, and limited drops in your checkout add-on rail.",
  },
];

export default function Premium() {
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
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in duration-300">
      <header className="text-center space-y-3 py-6">
        <Badge className="bg-clinical-gold/15 text-clinical-gold border border-clinical-gold/40 px-3 py-1 text-[11px] tracking-widest">
          <Crown className="w-3 h-3 mr-1.5" /> TANMATRA PREMIUM
        </Badge>
        <h1 className="text-3xl sm:text-4xl font-serif text-white">
          Eat better, recover faster, get expert guidance.
        </h1>
        <p className="text-sm text-clinical-zinc max-w-xl mx-auto">
          One membership unlocks priority delivery, a monthly RD consult,
          premium-only dishes and exclusive pantry drops.
        </p>
      </header>

      <Card className="bg-[#050505] border border-[#D4AF37]/50 shadow-[0_12px_40px_rgba(212,175,55,0.15)] rounded-2xl overflow-hidden">
        <CardContent className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center">
          <div className="space-y-3.5">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-display font-extrabold text-[#D4AF37] tabular-nums">
                {formatPrice(pricePaise)}
              </span>
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">/ month</span>
            </div>
            {isPremium && membership ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  Active Membership —{" "}
                  {membership.status === "cancelled" ? "ends" : "renews"} on{" "}
                  {new Date(membership.currentPeriodEnd).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
                <p className="text-xs text-zinc-400 font-mono">
                  RD consults used this period:{" "}
                  <span className="text-white font-bold">
                    {membership.rdConsultsUsedThisPeriod} / {membership.rdConsultsPerPeriod}
                  </span>
                </p>
              </div>
            ) : (
              <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                ✓ Delivered fresh in 25–40 min priority wave · Cancel anytime with 1 click · Refund within 7 days
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2.5 min-w-[220px]">
            {isPremium ? (
              <>
                <Button asChild className="h-12 bg-[#D4AF37] text-[#050505] hover:bg-[#e6c148] font-extrabold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(212,175,55,0.3)]">
                  <Link to="/rd">Book free RD consult</Link>
                </Button>
                {membership?.status !== "cancelled" && (
                  <Button
                    variant="outline"
                    className="h-10 border-white/15 bg-transparent text-zinc-400 hover:text-white hover:border-white/30 text-xs"
                    onClick={() => cancel.mutate()}
                    disabled={cancel.isPending}
                  >
                    {cancel.isPending ? "Cancelling…" : "Cancel renewal"}
                  </Button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => subscribe.mutate()}
                disabled={subscribe.isPending}
                className="w-full h-13 rounded-xl bg-[#D4AF37] text-[#050505] hover:bg-[#e6c148] font-black text-sm uppercase tracking-wider shadow-[0_0_25px_rgba(212,175,55,0.4)] active:scale-97 transition-all flex items-center justify-center gap-2"
              >
                <Crown className="w-4 h-4 fill-[#050505]" />
                {subscribe.isPending ? "Activating Membership…" : "Join Tanmatra Premium"}
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {BENEFITS.map((b) => (
          <Card key={b.title} className="bg-clinical-surface border-clinical-border">
            <CardContent className="p-5 flex gap-3">
              <div className="w-9 h-9 rounded-lg bg-clinical-gold/15 text-clinical-gold flex items-center justify-center shrink-0">
                <b.icon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">{b.title}</h3>
                <p className="text-[12px] text-clinical-zinc mt-1 leading-relaxed">
                  {b.desc}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator className="bg-clinical-surface-elevated" />

      <Card className="bg-clinical-surface border-clinical-border">
        <CardContent className="p-5 flex items-start gap-3 text-[12px] text-clinical-zinc">
          <ShieldCheck className="w-4 h-4 text-clinical-sage shrink-0 mt-0.5" />
          <p>
            Premium is operated directly by Tanmatra Health Technologies. RD
            consults are conducted by registered dietitians on our care team.
            Priority delivery is a kitchen-queue benefit — not a delivery-time
            guarantee. Cancel anytime from your account.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
