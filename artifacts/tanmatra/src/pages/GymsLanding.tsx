import { useState } from "react";
import { Link, type MetaFunction } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ArrowRight, 
  Dumbbell, 
  Percent, 
  TrendingUp, 
  Clock, 
  Sparkles, 
  CheckCircle,
  Briefcase,
  Smartphone,
  Award
} from "lucide-react";
import { toast } from "sonner";
import { formatRupees } from "@/lib/rdPlans";
import { apiPath } from "@/lib/apiBase";
import { track } from "@/lib/analytics";

const TEAM_SIZE_BANDS = [
  { value: "1-20", label: "1-20 members" },
  { value: "21-100", label: "21-100 members" },
  { value: "101-500", label: "101-500 members" },
  { value: "500+", label: "500+ members" },
] as const;

export const meta: MetaFunction = () => [
  { title: "Partner with Tanmatra | Gyms & Fitness Centers" },
  { name: "description", content: "Bundle clinical-grade nutrition with your gym membership. Increase member retention, generate ancillary revenue, and provide complete fitness solutions." },
  { property: "og:type", content: "website" },
  { property: "og:title", content: "Partner with Tanmatra | Gyms & Fitness Centers" },
  { property: "og:description", content: "Bundle clinical-grade nutrition with your gym membership. Increase member retention and generate ancillary revenue." },
  { property: "og:image", content: "https://tanmatra.food/opengraph.jpg" },
  { property: "og:url", content: "https://tanmatra.food/partners/gyms" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:title", content: "Partner with Tanmatra | Gyms & Fitness Centers" },
  { name: "twitter:description", content: "Bundle clinical-grade nutrition with your gym membership. Increase member retention and generate ancillary revenue." },
  { name: "twitter:image", content: "https://tanmatra.food/opengraph.jpg" },
  { tagName: "link", rel: "canonical", href: "https://tanmatra.food/partners/gyms" },
];

const GYM_STANDARD_PLAN_PRICE_RUPEES = 6500;

export default function GymsLanding() {
  const [members, setMembers] = useState(250);
  const [commissionTier, setCommissionTier] = useState(10); // 10%

  const monthlyAncillaryRevenue = Math.round(members * 0.15 * GYM_STANDARD_PLAN_PRICE_RUPEES * (commissionTier / 100));

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [gymName, setGymName] = useState("");
  const [email, setEmail] = useState("");
  const [teamSizeBand, setTeamSizeBand] = useState("101-500");
  const [parkOrSector, setParkOrSector] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !gymName.trim() || !email.trim()) {
      toast.error("Please fill in your name, gym name, and work email");
      return;
    }
    if (!/.+@.+\..+/.test(email)) {
      toast.error("Please enter a valid work email");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(apiPath("/corporate-leads"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "gym",
          name: name.trim(),
          workEmail: email.trim().toLowerCase(),
          company: gymName.trim(),
          teamSizeBand,
          parkOrSector: parkOrSector.trim() || undefined,
          phone: phone.trim() || undefined,
          source: `${window.location.pathname}${window.location.search}`.slice(0, 160),
        }),
      });
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error("Too many submissions from this network — please try again in an hour, or WhatsApp us below.");
        }
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      track("corporate_lead_submitted", { kind: "gym", team_size_band: teamSizeBand });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error && err.message
          ? err.message
          : "Something went wrong — please check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="nn-clinical bg-nn-bg text-white min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-white/[0.08] py-20 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
          <div className="space-y-6">
            <Badge className="bg-nn-primary/15 text-nn-primary border-nn-primary/30 uppercase tracking-widest text-[10px] px-3 py-1">
              GYM & FITNESS CENTER PARTNERSHIPS
            </Badge>
            <h1 className="font-serif text-4xl sm:text-6xl leading-tight">
              70% of results come from nutrition. <span className="text-nn-primary">Own that 70%.</span>
            </h1>
            <p className="text-base sm:text-lg text-nn-on-surface-variant max-w-xl leading-relaxed">
              Integrate Tanmatra's dietitian-designed, macro-calibrated meals directly into your memberships. Increase client retention, accelerate their fat-loss or muscle-gain results, and unlock a passive revenue stream.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <a href="#partner-form">
                <Button className="bg-nn-primary text-action-text hover:bg-nn-primary/90 h-11 px-6 text-sm font-medium gap-2">
                  Apply for Partnership
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </a>
              <a href="#calculator" className="text-xs text-nn-on-surface-variant hover:text-white transition-colors">
                Calculate Ancillary Revenue →
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 text-xs text-nn-on-surface-variant">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-clinical-sage" />
                Zero inventory or setup costs
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-clinical-sage" />
                Custom co-branded portal
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-nn-primary/10 to-transparent blur-3xl -z-10 rounded-full" />
            <img 
              src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80" 
              alt="Gym workouts and health"
              className="rounded-2xl border border-white/[0.08] w-full object-cover max-h-[400px] shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* Value Propositions */}
      <section className="py-16 border-b border-white/[0.08] px-4">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="font-serif text-3xl sm:text-4xl">Why gyms partner with Tanmatra</h2>
            <p className="text-sm text-nn-on-surface-variant">
              Workout sessions are only half the battle. Bridge the gap between training and nutrition seamlessly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-nn-surface border-white/[0.08] hover:border-nn-primary/30 transition-all duration-300">
              <CardContent className="p-6 space-y-4">
                <div className="w-10 h-10 rounded-lg bg-nn-primary/15 flex items-center justify-center border border-nn-primary/25">
                  <TrendingUp className="w-5 h-5 text-nn-primary" />
                </div>
                <h3 className="text-lg font-semibold text-white">Higher Client Retention</h3>
                <p className="text-xs text-nn-on-surface-variant leading-relaxed">
                  When gym members get real results, they renew. By addressing their dietary needs alongside their training, they reach milestones faster.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-nn-surface border-white/[0.08] hover:border-nn-primary/30 transition-all duration-300">
              <CardContent className="p-6 space-y-4">
                <div className="w-10 h-10 rounded-lg bg-nn-primary/15 flex items-center justify-center border border-nn-primary/25">
                  <Percent className="w-5 h-5 text-nn-primary" />
                </div>
                <h3 className="text-lg font-semibold text-white">Ancillary Monthly Profits</h3>
                <p className="text-xs text-nn-on-surface-variant leading-relaxed">
                  Earn up to 15% recurring commission on every meal plan subscription sold through your gym. Completely handled by our fulfillment.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-nn-surface border-white/[0.08] hover:border-nn-primary/30 transition-all duration-300">
              <CardContent className="p-6 space-y-4">
                <div className="w-10 h-10 rounded-lg bg-nn-primary/15 flex items-center justify-center border border-nn-primary/25">
                  <Smartphone className="w-5 h-5 text-nn-primary" />
                </div>
                <h3 className="text-lg font-semibold text-white">Digital Co-Branded Portal</h3>
                <p className="text-xs text-nn-on-surface-variant leading-relaxed">
                  Provide members a customized interface where your logo stands alongside Tanmatra's dietitian console, prescribing meals matching your trainer recommendations.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Revenue Calculator */}
      <section id="calculator" className="py-16 border-b border-white/[0.08] bg-nn-surface/30 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h2 className="font-serif text-3xl">Ancillary Revenue Calculator</h2>
            <p className="text-xs text-nn-on-surface-variant">Estimate your recurring monthly payout based on subscriber volume.</p>
          </div>

          <Card className="bg-nn-surface border-white/[0.08] p-6">
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <Label className="text-white">Active Gym Members</Label>
                  <span className="text-nn-primary font-bold">{members} members</span>
                </div>
                <input 
                  type="range" 
                  min="50" 
                  max="1500" 
                  step="25"
                  value={members} 
                  onChange={(e) => setMembers(Number(e.target.value))}
                  className="w-full accent-nn-primary"
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <Label className="text-white">Commission Tier</Label>
                  <span className="text-nn-primary font-bold">{commissionTier}%</span>
                </div>
                <div className="flex gap-2">
                  {[10, 12.5, 15].map((val) => (
                    <Button 
                      key={val}
                      onClick={() => setCommissionTier(val)}
                      variant={commissionTier === val ? "default" : "outline"}
                      className={`flex-1 text-xs h-8 ${commissionTier === val ? "bg-nn-primary text-action-text hover:bg-nn-primary/90" : "border-white/[0.08] text-white hover:text-white"}`}
                    >
                      {val}% ({val === 10 ? "Standard" : val === 12.5 ? "Silver" : "Gold"})
                    </Button>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/[0.08] pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <p className="text-xs text-nn-on-surface-variant uppercase tracking-wider">Estimated Monthly Earnings</p>
                  <p className="text-3xl sm:text-4xl font-bold text-white mt-1">{formatRupees(monthlyAncillaryRevenue * 100)}</p>
                </div>
                <div className="text-xs text-nn-on-surface-variant leading-relaxed">
                  * Assumes a conservative 15% adoption rate among gym members on our standard 30-day ({formatRupees(GYM_STANDARD_PLAN_PRICE_RUPEES * 100)}/mo) plan. Actual numbers may vary based on member profile.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Integration Options */}
      <section className="py-16 border-b border-white/[0.08] px-4">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <h2 className="font-serif text-3xl">Flexible Integration Models</h2>
            <p className="text-xs text-nn-on-surface-variant">Choose how you want to partner and scale with Tanmatra.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="rounded-xl border border-white/[0.08] bg-nn-surface p-6 space-y-4">
              <Badge className="bg-nn-primary/10 text-nn-primary border-nn-primary/20 uppercase tracking-widest text-[9px]">MODEL A</Badge>
              <h3 className="text-xl font-bold text-white">Affiliate Partnership</h3>
              <p className="text-xs text-nn-on-surface-variant leading-relaxed">
                Promote Tanmatra to your members via your custom landing page, physical flyers, and trainer referrals. Your unique link tracks all signups automatically. Perfect for rapid launches.
              </p>
              <ul className="space-y-2 text-xs text-white pt-2">
                <li className="flex items-center gap-2">✓ 10% commission on all sales</li>
                <li className="flex items-center gap-2">✓ Free branded welcome kits & brochures</li>
                <li className="flex items-center gap-2">✓ Digital trainer dashboard to assign goals</li>
              </ul>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-nn-surface p-6 space-y-4">
              <Badge className="bg-nn-primary/10 text-nn-primary border-nn-primary/20 uppercase tracking-widest text-[9px]">MODEL B</Badge>
              <h3 className="text-xl font-bold text-white">Bundled Membership</h3>
              <p className="text-xs text-nn-on-surface-variant leading-relaxed">
                Include Tanmatra subscription plans as part of your premium tier gym packages (e.g. "VIP Transformation Membership"). We invoice the gym monthly at wholesale rates.
              </p>
              <ul className="space-y-2 text-xs text-white pt-2">
                <li className="flex items-center gap-2">✓ Wholesale discounting (up to 20% off)</li>
                <li className="flex items-center gap-2">✓ 1-on-1 private dietitian sessions for VIPs</li>
                <li className="flex items-center gap-2">✓ Dedicated local dispatch for bulk gym delivery</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Partnership Contact Form */}
      <section id="partner-form" className="py-20 px-4">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="text-center space-y-3">
            <h2 className="font-serif text-3xl sm:text-4xl">Start Your Application</h2>
            <p className="text-xs text-nn-on-surface-variant">
              Tell us about your center below. A partnership specialist will verify your details and call you within one working day.
            </p>
          </div>

          <Card className="bg-nn-surface border-white/[0.08]">
            <CardContent className="p-6">
              {submitted ? (
                <div className="text-center py-10 space-y-4">
                  <CheckCircle className="w-16 h-16 mx-auto text-clinical-sage" />
                  <h3 className="text-2xl font-bold text-white">Application received</h3>
                  <p className="text-sm text-nn-on-surface-variant max-w-sm mx-auto">
                    We'll call you within one working day. Prefer chat? You can also{" "}
                    <a
                      href="https://wa.me/919289213115"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 text-white hover:text-nn-primary transition-colors"
                    >
                      WhatsApp us
                    </a>
                    .
                  </p>
                  <Button
                    onClick={() => setSubmitted(false)}
                    variant="outline"
                    className="border-white/[0.08] text-white hover:text-white"
                  >
                    Submit another form
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-xs text-nn-on-surface-variant">Full Name</Label>
                      <Input 
                        id="name" 
                        placeholder="e.g. Rahul Sharma"
                        className="bg-nn-bg border-white/[0.08] text-white text-xs h-9"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="gym" className="text-xs text-nn-on-surface-variant">Fitness Center / Gym Name</Label>
                      <Input 
                        id="gym" 
                        placeholder="e.g. Iron Gym NCR"
                        className="bg-nn-bg border-white/[0.08] text-white text-xs h-9"
                        value={gymName}
                        onChange={(e) => setGymName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs text-nn-on-surface-variant">Work Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="e.g. partner@irongym.in"
                        className="bg-nn-bg border-white/[0.08] text-white text-xs h-9"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="team-size" className="text-xs text-nn-on-surface-variant">Active Members</Label>
                      <select
                        id="team-size"
                        className="w-full bg-nn-bg border border-white/[0.08] rounded-md px-3 text-white text-xs h-9 focus:outline-none"
                        value={teamSizeBand}
                        onChange={(e) => setTeamSizeBand(e.target.value)}
                      >
                        {TEAM_SIZE_BANDS.map((band) => (
                          <option key={band.value} value={band.value}>{band.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="park-or-sector" className="text-xs text-nn-on-surface-variant">Sector / Locality (optional)</Label>
                      <Input
                        id="park-or-sector"
                        placeholder="e.g. Sector 62, Noida"
                        className="bg-nn-bg border-white/[0.08] text-white text-xs h-9"
                        value={parkOrSector}
                        onChange={(e) => setParkOrSector(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="text-xs text-nn-on-surface-variant">Mobile Number (optional)</Label>
                      <Input
                        id="phone"
                        placeholder="e.g. +91 99999 88888"
                        className="bg-nn-bg border-white/[0.08] text-white text-xs h-9"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-nn-primary text-action-text hover:bg-nn-primary/90 font-medium text-xs h-10 mt-2 disabled:opacity-60"
                  >
                    {submitting ? "Submitting…" : "Submit Partnership Application"}
                  </Button>

                  {submitError ? (
                    <p role="alert" className="text-xs text-red-400 text-center leading-relaxed">
                      {submitError} <span className="text-nn-on-surface-variant">Your details are still filled in — press the button to retry.</span>
                    </p>
                  ) : null}

                  <p className="text-center text-xs text-nn-on-surface-variant">
                    or{" "}
                    <a
                      href="https://wa.me/919289213115"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 text-white hover:text-nn-primary transition-colors"
                    >
                      WhatsApp us
                    </a>
                  </p>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
