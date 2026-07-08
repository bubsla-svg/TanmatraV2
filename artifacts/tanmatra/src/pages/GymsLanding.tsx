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

export const meta: MetaFunction = () => [
  { title: "Partner with Tanmatra | Gyms & Fitness Centers" },
  { name: "description", content: "Bundle clinical-grade nutrition with your gym membership. Increase member retention, generate ancillary revenue, and provide complete fitness solutions." },
];

export default function GymsLanding() {
  const [members, setMembers] = useState(250);
  const [commissionTier, setCommissionTier] = useState(10); // 10%

  const monthlyAncillaryRevenue = Math.round(members * 0.15 * 6500 * (commissionTier / 100));

  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [gymName, setGymName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !gymName || !email || !phone) {
      toast.error("Please fill in all details");
      return;
    }
    // No partner-lead API exists yet — hand the inquiry to our real
    // partnerships channel (the same WhatsApp business line published on
    // the Refunds & Grievance page) with the details pre-filled.
    const message = [
      "Gym partnership inquiry — Tanmatra",
      `Name: ${name}`,
      `Gym / fitness center: ${gymName}`,
      `Email: ${email}`,
      `Phone: ${phone}`,
    ].join("\n");
    window.open(
      `https://wa.me/919289213115?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
    setSubmitted(true);
    toast.success("Almost done — send the pre-filled WhatsApp message to reach our partnerships team.");
  };

  return (
    <div className="bg-[#050505] text-white min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-clinical-border py-20 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
          <div className="space-y-6">
            <Badge className="bg-clinical-gold/15 text-clinical-gold border-clinical-gold/30 uppercase tracking-widest text-[10px] px-3 py-1">
              GYM & FITNESS CENTER PARTNERSHIPS
            </Badge>
            <h1 className="font-serif text-4xl sm:text-6xl leading-tight">
              70% of results come from nutrition. <span className="text-clinical-gold">Own that 70%.</span>
            </h1>
            <p className="text-base sm:text-lg text-clinical-zinc max-w-xl leading-relaxed">
              Integrate Tanmatra's dietitian-designed, macro-calibrated meals directly into your memberships. Increase client retention, accelerate their fat-loss or muscle-gain results, and unlock a passive revenue stream.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <a href="#partner-form">
                <Button className="bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90 h-11 px-6 text-sm font-medium gap-2">
                  Apply for Partnership
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </a>
              <a href="#calculator" className="text-xs text-clinical-zinc hover:text-white transition-colors">
                Calculate Ancillary Revenue →
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 text-xs text-clinical-zinc">
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
            <div className="absolute inset-0 bg-gradient-to-tr from-clinical-gold/10 to-transparent blur-3xl -z-10 rounded-full" />
            <img 
              src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80" 
              alt="Gym workouts and health"
              className="rounded-2xl border border-clinical-border w-full object-cover max-h-[400px] shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* Value Propositions */}
      <section className="py-16 border-b border-clinical-border px-4">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="font-serif text-3xl sm:text-4xl">Why gyms partner with Tanmatra</h2>
            <p className="text-sm text-clinical-zinc">
              Workout sessions are only half the battle. Bridge the gap between training and nutrition seamlessly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-clinical-surface border-clinical-border hover:border-clinical-gold/30 transition-all duration-300">
              <CardContent className="p-6 space-y-4">
                <div className="w-10 h-10 rounded-lg bg-clinical-gold/15 flex items-center justify-center border border-clinical-gold/25">
                  <TrendingUp className="w-5 h-5 text-clinical-gold" />
                </div>
                <h3 className="text-lg font-semibold text-white">Higher Client Retention</h3>
                <p className="text-xs text-clinical-zinc leading-relaxed">
                  When gym members get real results, they renew. By addressing their dietary needs alongside their training, they reach milestones faster.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-clinical-surface border-clinical-border hover:border-clinical-gold/30 transition-all duration-300">
              <CardContent className="p-6 space-y-4">
                <div className="w-10 h-10 rounded-lg bg-clinical-gold/15 flex items-center justify-center border border-clinical-gold/25">
                  <Percent className="w-5 h-5 text-clinical-gold" />
                </div>
                <h3 className="text-lg font-semibold text-white">Ancillary Monthly Profits</h3>
                <p className="text-xs text-clinical-zinc leading-relaxed">
                  Earn up to 15% recurring commission on every meal plan subscription sold through your gym. Completely handled by our fulfillment.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-clinical-surface border-clinical-border hover:border-clinical-gold/30 transition-all duration-300">
              <CardContent className="p-6 space-y-4">
                <div className="w-10 h-10 rounded-lg bg-clinical-gold/15 flex items-center justify-center border border-clinical-gold/25">
                  <Smartphone className="w-5 h-5 text-clinical-gold" />
                </div>
                <h3 className="text-lg font-semibold text-white">Digital Co-Branded Portal</h3>
                <p className="text-xs text-clinical-zinc leading-relaxed">
                  Provide members a customized interface where your logo stands alongside Tanmatra's dietitian console, prescribing meals matching your trainer recommendations.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Revenue Calculator */}
      <section id="calculator" className="py-16 border-b border-clinical-border bg-clinical-surface/30 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h2 className="font-serif text-3xl">Ancillary Revenue Calculator</h2>
            <p className="text-xs text-clinical-zinc">Estimate your recurring monthly payout based on subscriber volume.</p>
          </div>

          <Card className="bg-clinical-surface border-clinical-border p-6">
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <Label className="text-white">Active Gym Members</Label>
                  <span className="text-clinical-gold font-bold">{members} members</span>
                </div>
                <input 
                  type="range" 
                  min="50" 
                  max="1500" 
                  step="25"
                  value={members} 
                  onChange={(e) => setMembers(Number(e.target.value))}
                  className="w-full accent-clinical-gold"
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <Label className="text-white">Commission Tier</Label>
                  <span className="text-clinical-gold font-bold">{commissionTier}%</span>
                </div>
                <div className="flex gap-2">
                  {[10, 12.5, 15].map((val) => (
                    <Button 
                      key={val}
                      onClick={() => setCommissionTier(val)}
                      variant={commissionTier === val ? "default" : "outline"}
                      className={`flex-1 text-xs h-8 ${commissionTier === val ? "bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90" : "border-clinical-border text-white hover:text-white"}`}
                    >
                      {val}% ({val === 10 ? "Standard" : val === 12.5 ? "Silver" : "Gold"})
                    </Button>
                  ))}
                </div>
              </div>

              <div className="border-t border-clinical-border pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <p className="text-xs text-clinical-zinc uppercase tracking-wider">Estimated Monthly Earnings</p>
                  <p className="text-3xl sm:text-4xl font-bold text-white mt-1">₹{monthlyAncillaryRevenue.toLocaleString("en-IN")}</p>
                </div>
                <div className="text-xs text-clinical-zinc leading-relaxed">
                  * Assumes a conservative 15% adoption rate among gym members on our standard 30-day (₹6,500/mo) plan. Actual numbers may vary based on member profile.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Integration Options */}
      <section className="py-16 border-b border-clinical-border px-4">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <h2 className="font-serif text-3xl">Flexible Integration Models</h2>
            <p className="text-xs text-clinical-zinc">Choose how you want to partner and scale with Tanmatra.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="rounded-xl border border-clinical-border bg-clinical-surface p-6 space-y-4">
              <Badge className="bg-clinical-gold/10 text-clinical-gold border-clinical-gold/20 uppercase tracking-widest text-[9px]">MODEL A</Badge>
              <h3 className="text-xl font-bold text-white">Affiliate Partnership</h3>
              <p className="text-xs text-clinical-zinc leading-relaxed">
                Promote Tanmatra to your members via your custom landing page, physical flyers, and trainer referrals. Your unique link tracks all signups automatically. Perfect for rapid launches.
              </p>
              <ul className="space-y-2 text-xs text-white pt-2">
                <li className="flex items-center gap-2">✓ 10% commission on all sales</li>
                <li className="flex items-center gap-2">✓ Free branded welcome kits & brochures</li>
                <li className="flex items-center gap-2">✓ Digital trainer dashboard to assign goals</li>
              </ul>
            </div>

            <div className="rounded-xl border border-clinical-border bg-clinical-surface p-6 space-y-4">
              <Badge className="bg-clinical-gold/10 text-clinical-gold border-clinical-gold/20 uppercase tracking-widest text-[9px]">MODEL B</Badge>
              <h3 className="text-xl font-bold text-white">Bundled Membership</h3>
              <p className="text-xs text-clinical-zinc leading-relaxed">
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
            <p className="text-xs text-clinical-zinc">
              Enter your details below and send them to our partnerships team on WhatsApp. A partnership specialist will verify your center and follow up.
            </p>
          </div>

          <Card className="bg-clinical-surface border-clinical-border">
            <CardContent className="p-6">
              {submitted ? (
                <div className="text-center py-10 space-y-4">
                  <CheckCircle className="w-16 h-16 mx-auto text-clinical-sage" />
                  <h3 className="text-2xl font-bold text-white">One step left</h3>
                  <p className="text-sm text-clinical-zinc max-w-sm mx-auto">
                    We've opened WhatsApp with your details pre-filled. Send the message and our partnerships team will get back to you on WhatsApp or email.
                  </p>
                  <Button 
                    onClick={() => setSubmitted(false)}
                    variant="outline" 
                    className="border-clinical-border text-white hover:text-white"
                  >
                    Submit another form
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-xs text-clinical-zinc">Full Name</Label>
                      <Input 
                        id="name" 
                        placeholder="e.g. Rahul Sharma"
                        className="bg-clinical-dark border-clinical-border text-white text-xs h-9"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="gym" className="text-xs text-clinical-zinc">Fitness Center / Gym Name</Label>
                      <Input 
                        id="gym" 
                        placeholder="e.g. Iron Gym NCR"
                        className="bg-clinical-dark border-clinical-border text-white text-xs h-9"
                        value={gymName}
                        onChange={(e) => setGymName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs text-clinical-zinc">Work Email Address</Label>
                      <Input 
                        id="email" 
                        type="email"
                        placeholder="e.g. partner@irongym.in"
                        className="bg-clinical-dark border-clinical-border text-white text-xs h-9"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="text-xs text-clinical-zinc">Mobile Number (WhatsApp Enabled)</Label>
                      <Input 
                        id="phone" 
                        placeholder="e.g. +91 99999 88888"
                        className="bg-clinical-dark border-clinical-border text-white text-xs h-9"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90 font-medium text-xs h-10 mt-2"
                  >
                    Send Inquiry via WhatsApp
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
