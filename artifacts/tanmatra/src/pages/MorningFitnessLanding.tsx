import { useState } from "react";
import { Link, type MetaFunction } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowRight,
  MapPin,
  Clock,
  CheckCircle,
  Coffee,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { onDishImageError } from "@/lib/imgFallback";
import { apiPath } from "@/lib/apiBase";
import { track } from "@/lib/analytics";

const TEAM_SIZE_BANDS = [
  { value: "1-20", label: "1-20 athletes" },
  { value: "21-100", label: "21-100 athletes" },
  { value: "101-500", label: "101-500 athletes" },
  { value: "500+", label: "500+ athletes" },
] as const;

export const meta: MetaFunction = () => [
  { title: "Morning Fitness & Running Clubs | Tanmatra" },
  { name: "description", content: "Post-workout breakfast drop-offs for running, cycling, and morning bootcamps. Healthy, dietitian-designed recovery meals delivered directly to your meetup spots." },
  { property: "og:type", content: "website" },
  { property: "og:title", content: "Morning Fitness & Running Clubs | Tanmatra" },
  { property: "og:description", content: "Post-workout breakfast drop-offs for running, cycling, and morning bootcamps — delivered directly to your meetup spots." },
  { property: "og:image", content: "https://tanmatra.food/opengraph.jpg" },
  { property: "og:url", content: "https://tanmatra.food/partners/fitness-clubs" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:title", content: "Morning Fitness & Running Clubs | Tanmatra" },
  { name: "twitter:description", content: "Post-workout breakfast drop-offs for running, cycling, and morning bootcamps — delivered directly to your meetup spots." },
  { name: "twitter:image", content: "https://tanmatra.food/opengraph.jpg" },
  { tagName: "link", rel: "canonical", href: "https://tanmatra.food/partners/fitness-clubs" },
];

export default function MorningFitnessLanding() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [clubName, setClubName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [membersCount, setMembersCount] = useState("21-100");
  const [location, setLocation] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clubName.trim() || !contactName.trim() || !email.trim()) {
      toast.error("Please fill in your club name, coordinator name, and work email");
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
          kind: "fitness_club",
          name: contactName.trim(),
          workEmail: email.trim().toLowerCase(),
          company: clubName.trim(),
          teamSizeBand: membersCount,
          parkOrSector: location.trim() || undefined,
          phone: whatsapp.trim() || undefined,
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
      track("corporate_lead_submitted", { kind: "fitness_club", team_size_band: membersCount });
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
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-12 items-center">
          <div className="space-y-6">
            <Badge className="bg-nn-primary/15 text-nn-primary border-nn-primary/30 uppercase tracking-widest text-[10px] px-3 py-1">
              MORNING RUNNING & CYCLING CLUBS
            </Badge>
            <h1 className="font-serif text-4xl sm:text-6xl leading-tight">
              Post-workout recovery, <span className="text-nn-primary">delivered to your finish line.</span>
            </h1>
            <p className="text-base sm:text-lg text-nn-on-surface-variant max-w-xl leading-relaxed">
              Ditch the sugary tea stall stops. Coordinate fresh, dietitian-approved post-workout breakfasts delivered warm directly to your meetup, park, or trail finish line by 7:00 AM.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <a href="#propose-club">
                <Button className="bg-nn-primary text-action-text hover:bg-nn-primary/90 h-11 px-6 text-sm font-medium gap-2">
                  Register Your Club
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </a>
              <a href="#how-it-works" className="text-xs text-nn-on-surface-variant hover:text-white transition-colors">
                How Delivery Works →
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 text-xs text-nn-on-surface-variant">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-clinical-sage" />
                Delivered by 7:00 AM
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-clinical-sage" />
                NCR Parks & Meetup spots
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-nn-primary/10 to-transparent blur-3xl -z-10 rounded-full" />
            <img 
              src="https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=800&q=80" 
              alt="Running club outdoors"
              className="rounded-2xl border border-white/[0.08] w-full object-cover max-h-[400px] shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section id="how-it-works" className="py-16 border-b border-white/[0.08] px-4">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="font-serif text-3xl sm:text-4xl">Fueling runners and cyclists across NCR</h2>
            <p className="text-sm text-nn-on-surface-variant">
              We coordinate bulk, site-specific drop-offs so your group can rehydrate and refuel together instantly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-nn-surface border-white/[0.08]">
              <CardContent className="p-6 space-y-4">
                <div className="w-10 h-10 rounded-lg bg-nn-primary/15 flex items-center justify-center border border-nn-primary/25">
                  <Clock className="w-5 h-5 text-nn-primary" />
                </div>
                <h3 className="text-lg font-semibold text-white">7:00 AM Delivery Guarantee</h3>
                <p className="text-xs text-nn-on-surface-variant leading-relaxed">
                  We schedule dispatch to meet you immediately after your cooldown. No late deliveries, no cold food. Kept warm in specialized insulated carrier boxes.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-nn-surface border-white/[0.08]">
              <CardContent className="p-6 space-y-4">
                <div className="w-10 h-10 rounded-lg bg-nn-primary/15 flex items-center justify-center border border-nn-primary/25">
                  <Coffee className="w-5 h-5 text-nn-primary" />
                </div>
                <h3 className="text-lg font-semibold text-white">Clean Recovery Macros</h3>
                <p className="text-xs text-nn-on-surface-variant leading-relaxed">
                  Menu items like *Boiled Egg Plates*, *Buckwheat Mung Khichdi*, and *High-Protein Berry Smoothies* replenish glycogen and repair muscle fibers instantly without sugars.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-nn-surface border-white/[0.08]">
              <CardContent className="p-6 space-y-4">
                <div className="w-10 h-10 rounded-lg bg-nn-primary/15 flex items-center justify-center border border-nn-primary/25">
                  <Users className="w-5 h-5 text-nn-primary" />
                </div>
                <h3 className="text-lg font-semibold text-white">Group Subscriptions</h3>
                <p className="text-xs text-nn-on-surface-variant leading-relaxed">
                  Members configure their own meal preferences online. Club admins get a single dispatch manifest, or we deploy a local courier setup directly at your park drop-off.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Menu Highlight */}
      <section className="py-16 border-b border-white/[0.08] bg-nn-surface/10 px-4">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h2 className="font-serif text-3xl">Perfect Post-Run Fuel</h2>
            <p className="text-xs text-nn-on-surface-variant">A sneak peek at our popular recovery breakfast options.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                name: "Boiled 3 Egg with Sautéed Veggies",
                macros: "280 kcal · 22g P · 8g C · 14g F",
                desc: "Bioavailable egg-white protein with warm lightly-seasoned steamed broccoli and carrots.",
                img: "/dishes/boiled-3-egg-with-saut-ed-veggies.jpg"
              },
              {
                name: "English Breakfast Plate",
                macros: "450 kcal · 32g P · 24g C · 18g F",
                desc: "Scrambled eggs, chicken sausages, baked beans, and whole wheat toast slices.",
                img: "/dishes/english-breakfast.jpg"
              },
              {
                name: "Spiced Buckwheat & Mung Khichdi",
                macros: "310 kcal · 14g P · 52g C · 5g F",
                desc: "Warm prebiotic comfort bowl. Low glycemic carbs and fiber for cellular restoration.",
                img: "/dishes/buckwheat_mung_khichdi_1782971061215.jpg"
              }
            ].map((d) => (
              <Card key={d.name} className="bg-nn-surface border-white/[0.08] overflow-hidden">
                <img src={d.img} alt={d.name} onError={onDishImageError} className="w-full h-40 object-cover" />
                <CardContent className="p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-white">{d.name}</h4>
                  <p className="text-[10px] text-nn-primary font-mono">{d.macros}</p>
                  <p className="text-[11px] text-nn-on-surface-variant leading-relaxed">{d.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Propose a Club Form */}
      <section id="propose-club" className="py-20 px-4">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="text-center space-y-3">
            <h2 className="font-serif text-3xl sm:text-4xl">Get Your Club Onboarded</h2>
            <p className="text-xs text-nn-on-surface-variant">
              Tell us where your group trains. We will coordinate a trial delivery morning complete with complimentary protein shakes and sample menus for your next group session.
            </p>
          </div>

          <Card className="bg-nn-surface border-white/[0.08]">
            <CardContent className="p-6">
              {submitted ? (
                <div className="text-center py-10 space-y-4">
                  <CheckCircle className="w-16 h-16 mx-auto text-clinical-sage" />
                  <h3 className="text-2xl font-bold text-white">Request received</h3>
                  <p className="text-sm text-nn-on-surface-variant max-w-sm mx-auto">
                    We'll call you within one working day to coordinate your trial breakfast morning. Prefer chat? You can also{" "}
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
                    Submit another location
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="club" className="text-xs text-nn-on-surface-variant">Club / Team Name</Label>
                      <Input 
                        id="club" 
                        placeholder="e.g. Noida Runners Club"
                        className="bg-nn-bg border-white/[0.08] text-white text-xs h-9"
                        value={clubName}
                        onChange={(e) => setClubName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="contact" className="text-xs text-nn-on-surface-variant">Lead Coordinator Name</Label>
                      <Input 
                        id="contact" 
                        placeholder="e.g. Vikramaditya"
                        className="bg-nn-bg border-white/[0.08] text-white text-xs h-9"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="email" className="text-xs text-nn-on-surface-variant">Work Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="e.g. coordinator@noidarunners.in"
                        className="bg-nn-bg border-white/[0.08] text-white text-xs h-9"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="size" className="text-xs text-nn-on-surface-variant">Active Group Size</Label>
                      <select
                        id="size"
                        className="w-full bg-nn-bg border border-white/[0.08] rounded-md px-3 text-white text-xs h-9 focus:outline-none"
                        value={membersCount}
                        onChange={(e) => setMembersCount(e.target.value)}
                      >
                        {TEAM_SIZE_BANDS.map((band) => (
                          <option key={band.value} value={band.value}>{band.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="whatsapp" className="text-xs text-nn-on-surface-variant">WhatsApp Number for Coordination (optional)</Label>
                    <Input
                      id="whatsapp"
                      placeholder="e.g. +91 98111 22222"
                      className="bg-nn-bg border-white/[0.08] text-white text-xs h-9"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="location" className="text-xs text-nn-on-surface-variant">Meetup / Finish Point Coordinates or Landmarks (optional)</Label>
                    <Input
                      id="location"
                      placeholder="e.g. Leisure Valley Park Gate 2, Gurgaon"
                      className="bg-nn-bg border-white/[0.08] text-white text-xs h-9"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-nn-primary text-action-text hover:bg-nn-primary/90 font-medium text-xs h-10 mt-2 disabled:opacity-60"
                  >
                    {submitting ? "Submitting…" : "Request Trial Breakfast Drop-off"}
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
