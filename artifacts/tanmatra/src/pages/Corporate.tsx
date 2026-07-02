import { useEffect, useState } from "react";
import { Link, useNavigate, type MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Corporate Wellness | Tanmatra" },
  { name: "description", content: "Bring clinical-grade nutrition to your workplace. Tanmatra's corporate wellness programme delivers dietitian-designed meals and team nutrition plans." },
  { property: "og:title", content: "Corporate Wellness | Tanmatra" },
  { property: "og:description", content: "Bring clinical-grade nutrition to your workplace with dietitian-designed meals and team nutrition plans." },
  { property: "og:image", content: "https://tanmatra.food/opengraph.jpg" },
];
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Plus, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { corporateApi, type Company } from "@/lib/corporateApi";
import { formatPrice } from "@/lib/api/adapter";

export default function Corporate() {
  const nav = useNavigate();
  const [companies, setCompanies] = useState<
    Array<{ company: Company; role: string; status: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [budgetRupees, setBudgetRupees] = useState("3000");
  const [creating, setCreating] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    corporateApi
      .listMine()
      .then((r) => setCompanies(r.companies))
      .catch((e: Error) => {
        if (String(e.message).startsWith("401")) setUnauthorized(true);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Company name required");
      return;
    }
    const paise = Math.max(0, Math.round(Number(budgetRupees || 0) * 100));
    setCreating(true);
    try {
      const r = await corporateApi.createCompany(name.trim(), paise);
      toast.success(`${r.company.name} created`);
      nav(`/corporate/${r.company.slug}`);
    } catch {
      toast.error("Could not create company");
    } finally {
      setCreating(false);
    }
  };

  if (unauthorized) {
    return (
      <div className="bg-[#050505] text-white min-h-screen pb-16">
        {/* Main Pitch Hero */}
        <div className="max-w-6xl mx-auto px-4 py-16 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
          <div className="space-y-6">
            <Badge className="bg-clinical-gold/15 text-clinical-gold border-clinical-gold/30 uppercase tracking-widest text-[10px] px-3 py-1">
              TANMATRA FOR BUSINESS
            </Badge>
            <h1 className="font-serif text-4xl sm:text-5xl leading-tight">
              Fuel your team with <span className="text-clinical-gold">clinical nutrition.</span>
            </h1>
            <p className="text-sm sm:text-base text-clinical-zinc leading-relaxed">
              Ditch the office junk food. Set monthly wellness budgets, schedule recurring catered lunches, and provide dietitian consulting to reduce sick leaves and elevate collective focus.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {[
                { title: "Budget Stipends", desc: "Set monthly meal allowances redeemed at checkout." },
                { title: "Team Lunch Cater", desc: "Insulated, bulk drops for recurring office meals." },
                { title: "Dietitian Access", desc: "Bundle direct consultations with registered dietitians." },
              ].map((b) => (
                <div key={b.title} className="rounded-lg border border-clinical-border bg-clinical-surface p-4 space-y-1">
                  <p className="text-xs font-semibold text-white">{b.title}</p>
                  <p className="text-[10px] text-clinical-zinc">{b.desc}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-clinical-gold/20 bg-clinical-gold/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-white">Already registered as an HR admin?</p>
                <p className="text-[11px] text-clinical-zinc mt-0.5">Sign in to manage employees, view invoices, and manage credit lines.</p>
              </div>
              <Button
                onClick={() => nav("/login?next=/corporate")}
                className="bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90 text-xs shrink-0 h-9"
              >
                Sign in to Console
              </Button>
            </div>
          </div>

          {/* Lead capture form */}
          <Card className="bg-clinical-surface border-clinical-border">
            <CardContent className="p-6 space-y-4">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">Request Corporate Proposal</h3>
                <p className="text-xs text-clinical-zinc">Fill in details and our enterprise specialist will share customized plan tiers.</p>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                toast.success("Lead registered! Our enterprise team will email your proposal shortly.");
              }} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-clinical-zinc text-[11px]">Contact Name</Label>
                    <Input placeholder="HR Manager / Admin" className="bg-clinical-dark border-clinical-border text-white text-xs h-9" required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-clinical-zinc text-[11px]">Company Name</Label>
                    <Input placeholder="e.g. Acme Corp" className="bg-clinical-dark border-clinical-border text-white text-xs h-9" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-clinical-zinc text-[11px]">Work Email</Label>
                    <Input type="email" placeholder="hr@acme.com" className="bg-clinical-dark border-clinical-border text-white text-xs h-9" required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-clinical-zinc text-[11px]">Estimated Headcount</Label>
                    <select className="w-full bg-clinical-dark border border-clinical-border rounded-md px-3 text-white text-xs h-9 focus:outline-none">
                      <option>10 - 50 employees</option>
                      <option>50 - 200 employees</option>
                      <option>200 - 1000 employees</option>
                      <option>1000+ employees</option>
                    </select>
                  </div>
                </div>
                <Button type="submit" className="w-full bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90 text-xs h-9 font-medium mt-2">
                  Request Proposals
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6 animate-in fade-in duration-500">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Building2 className="w-6 h-6 text-clinical-gold" /> Corporate Plans
        </h1>
        <p className="text-sm text-clinical-zinc">
          Subsidize meals for your team, run office lunch programs, and gift wellness vouchers.
        </p>
      </div>

      <Card className="bg-clinical-surface border-clinical-border">
        <CardContent className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">Your companies</h2>
          {loading ? (
            <p className="text-xs text-clinical-zinc">Loading…</p>
          ) : companies.length === 0 ? (
            <p className="text-xs text-clinical-zinc">
              You're not part of any company yet. Create one below or accept an invite from your admin.
            </p>
          ) : (
            <div className="space-y-2">
              {companies.map(({ company, role }) => (
                <Link
                  key={company.id}
                  to={`/corporate/${company.slug}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-clinical-border bg-clinical-dark hover:border-clinical-gold/40 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{company.name}</p>
                    <p className="text-[10px] text-clinical-zinc">
                      {role.toUpperCase()} · Budget {formatPrice(company.perEmployeeMonthlyBudgetPaise)}/mo per employee
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-clinical-gold" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-clinical-surface border-clinical-border">
        <CardContent className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-clinical-gold" /> Create a company
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-clinical-zinc">Company name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Inc."
                className="h-9 text-xs bg-clinical-dark border-clinical-border"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-clinical-zinc">
                Monthly budget per employee (Rs.)
              </Label>
              <Input
                type="number"
                value={budgetRupees}
                onChange={(e) => setBudgetRupees(e.target.value)}
                className="h-9 text-xs bg-clinical-dark border-clinical-border"
              />
            </div>
          </div>
          <Button
            onClick={handleCreate}
            disabled={creating}
            className="bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90"
          >
            {creating ? "Creating…" : "Create company"}
          </Button>
        </CardContent>
      </Card>

      <div className="text-xs text-clinical-zinc">
        Looking for vouchers?{" "}
        <Link to="/vouchers" className="text-clinical-gold underline">
          Buy or redeem a wellness voucher
        </Link>
        .
      </div>
    </div>
  );
}
