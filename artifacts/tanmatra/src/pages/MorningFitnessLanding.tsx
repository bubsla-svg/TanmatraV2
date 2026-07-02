import { useState } from "react";
import { Link, type MetaFunction } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ArrowRight, 
  Compass, 
  MapPin, 
  Clock, 
  CheckCircle, 
  Coffee,
  Users,
  UtensilsCrossed,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";

export const meta: MetaFunction = () => [
  { title: "Morning Fitness & Running Clubs | Tanmatra" },
  { name: "description", content: "Post-workout breakfast drop-offs for running, cycling, and morning bootcamps. Healthy, dietitian-designed recovery meals delivered directly to your meetup spots." },
];

export default function MorningFitnessLanding() {
  const [submitted, setSubmitted] = useState(false);
  const [clubName, setClubName] = useState("");
  const [contactName, setContactName] = useState("");
  const [city, setCity] = useState("Delhi NCR");
  const [membersCount, setMembersCount] = useState("20-50");
  const [whatsapp, setWhatsapp] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clubName || !contactName || !whatsapp) {
      toast.error("Please fill in all details");
      return;
    }
    setSubmitted(true);
    toast.success("Morning Club proposal submitted! We'll coordinate your sample breakfast setup.");
  };

  return (
    <div className="bg-[#050505] text-white min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-clinical-border py-20 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-12 items-center">
          <div className="space-y-6">
            <Badge className="bg-clinical-gold/15 text-clinical-gold border-clinical-gold/30 uppercase tracking-widest text-[10px] px-3 py-1">
              MORNING RUNNING & CYCLING CLUBS
            </Badge>
            <h1 className="font-serif text-4xl sm:text-6xl leading-tight">
              Post-workout recovery, <span className="text-clinical-gold">delivered to your finish line.</span>
            </h1>
            <p className="text-base sm:text-lg text-clinical-zinc max-w-xl leading-relaxed">
              Ditch the sugary tea stall stops. Coordinate fresh, dietitian-approved post-workout breakfasts delivered warm directly to your meetup, park, or trail finish line by 7:00 AM.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <a href="#propose-club">
                <Button className="bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90 h-11 px-6 text-sm font-medium gap-2">
                  Register Your Club
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </a>
              <a href="#how-it-works" className="text-xs text-clinical-zinc hover:text-white transition-colors">
                How Delivery Works →
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 text-xs text-clinical-zinc">
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
            <div className="absolute inset-0 bg-gradient-to-tr from-clinical-gold/10 to-transparent blur-3xl -z-10 rounded-full" />
            <img 
              src="https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=800&q=80" 
              alt="Running club outdoors"
              className="rounded-2xl border border-clinical-border w-full object-cover max-h-[400px] shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section id="how-it-works" className="py-16 border-b border-clinical-border px-4">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="font-serif text-3xl sm:text-4xl">Fueling runners and cyclists across NCR</h2>
            <p className="text-sm text-clinical-zinc">
              We coordinate bulk, site-specific drop-offs so your group can rehydrate and refuel together instantly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-clinical-surface border-clinical-border">
              <CardContent className="p-6 space-y-4">
                <div className="w-10 h-10 rounded-lg bg-clinical-gold/15 flex items-center justify-center border border-clinical-gold/25">
                  <Clock className="w-5 h-5 text-clinical-gold" />
                </div>
                <h3 className="text-lg font-semibold text-white">7:00 AM Delivery Guarantee</h3>
                <p className="text-xs text-clinical-zinc leading-relaxed">
                  We schedule dispatch to meet you immediately after your cooldown. No late deliveries, no cold food. Kept warm in specialized insulated carrier boxes.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-clinical-surface border-clinical-border">
              <CardContent className="p-6 space-y-4">
                <div className="w-10 h-10 rounded-lg bg-clinical-gold/15 flex items-center justify-center border border-clinical-gold/25">
                  <Coffee className="w-5 h-5 text-clinical-gold" />
                </div>
                <h3 className="text-lg font-semibold text-white">Clean Recovery Macros</h3>
                <p className="text-xs text-clinical-zinc leading-relaxed">
                  Menu items like *Boiled Egg Plates*, *Buckwheat Mung Khichdi*, and *High-Protein Berry Smoothies* replenish glycogen and repair muscle fibers instantly without sugars.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-clinical-surface border-clinical-border">
              <CardContent className="p-6 space-y-4">
                <div className="w-10 h-10 rounded-lg bg-clinical-gold/15 flex items-center justify-center border border-clinical-gold/25">
                  <Users className="w-5 h-5 text-clinical-gold" />
                </div>
                <h3 className="text-lg font-semibold text-white">Group Subscriptions</h3>
                <p className="text-xs text-clinical-zinc leading-relaxed">
                  Members configure their own meal preferences online. Club admins get a single dispatch manifest, or we deploy a local courier setup directly at your park drop-off.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Menu Highlight */}
      <section className="py-16 border-b border-clinical-border bg-clinical-surface/10 px-4">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h2 className="font-serif text-3xl">Perfect Post-Run Fuel</h2>
            <p className="text-xs text-clinical-zinc">A sneak peek at our popular recovery breakfast options.</p>
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
              <Card key={d.name} className="bg-clinical-surface border-clinical-border overflow-hidden">
                <img src={d.img} alt={d.name} className="w-full h-40 object-cover" />
                <CardContent className="p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-white">{d.name}</h4>
                  <p className="text-[10px] text-clinical-gold font-mono">{d.macros}</p>
                  <p className="text-[11px] text-clinical-zinc leading-relaxed">{d.desc}</p>
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
            <p className="text-xs text-clinical-zinc">
              Tell us where your group trains. We will coordinate a trial delivery morning complete with complimentary protein shakes and sample menus for your next group session.
            </p>
          </div>

          <Card className="bg-clinical-surface border-clinical-border">
            <CardContent className="p-6">
              {submitted ? (
                <div className="text-center py-10 space-y-4">
                  <CheckCircle className="w-16 h-16 mx-auto text-clinical-sage" />
                  <h3 className="text-2xl font-bold text-white">Proposal Received!</h3>
                  <p className="text-sm text-clinical-zinc max-w-sm mx-auto">
                    We will review the drop-off logistics for your meetup point and coordinate your trial breakfast morning. Expect a call shortly.
                  </p>
                  <Button 
                    onClick={() => setSubmitted(false)}
                    variant="outline" 
                    className="border-clinical-border text-white hover:text-white"
                  >
                    Submit another location
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="club" className="text-xs text-clinical-zinc">Club / Team Name</Label>
                      <Input 
                        id="club" 
                        placeholder="e.g. Noida Runners Club"
                        className="bg-clinical-dark border-clinical-border text-white text-xs h-9"
                        value={clubName}
                        onChange={(e) => setClubName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="contact" className="text-xs text-clinical-zinc">Lead Coordinator Name</Label>
                      <Input 
                        id="contact" 
                        placeholder="e.g. Vikramaditya"
                        className="bg-clinical-dark border-clinical-border text-white text-xs h-9"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="whatsapp" className="text-xs text-clinical-zinc">WhatsApp Number for Coordination</Label>
                      <Input 
                        id="whatsapp" 
                        placeholder="e.g. +91 98111 22222"
                        className="bg-clinical-dark border-clinical-border text-white text-xs h-9"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="size" className="text-xs text-clinical-zinc">Active Group Size</Label>
                      <select 
                        id="size"
                        className="w-full bg-clinical-dark border border-clinical-border rounded-md px-3 text-white text-xs h-9 focus:outline-none"
                        value={membersCount}
                        onChange={(e) => setMembersCount(e.target.value)}
                      >
                        <option value="10-20">10-20 athletes</option>
                        <option value="20-50">20-50 athletes</option>
                        <option value="50-100">50-100 athletes</option>
                        <option value="100+">100+ athletes</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="location" className="text-xs text-clinical-zinc">Meetup / Finish Point Coordinates or Landmarks</Label>
                    <Input 
                      id="location" 
                      placeholder="e.g. Leisure Valley Park Gate 2, Gurgaon"
                      className="bg-clinical-dark border-clinical-border text-white text-xs h-9"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90 font-medium text-xs h-10 mt-2"
                  >
                    Request Trial Breakfast Drop-off
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
