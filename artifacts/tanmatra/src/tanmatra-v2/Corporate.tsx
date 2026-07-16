import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { corporateApi, type Company } from "@/lib/corporateApi";
import { F } from "@/tanmatra-v2/data";

const BENEFITS = [
  { title: "Budget Stipends", desc: "Set monthly meal allowances redeemed at checkout." },
  { title: "Team Lunch Cater", desc: "Insulated, bulk drops for recurring office meals." },
  { title: "Dietitian Access", desc: "Bundle direct consultations with registered dietitians." },
];

export default function V2Corporate() {
  const nav = useNavigate();
  const [companies, setCompanies] = useState<
    Array<{ company: Company; role: string; status: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [budgetRupees, setBudgetRupees] = useState("3000");
  const [creating, setCreating] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  // Marketing "Request Corporate Proposal" lead form (shown to unauthenticated
  // visitors). No lead API exists yet, so it hands the inquiry to the
  // partnerships WhatsApp line with the details pre-filled — the lead is never
  // silently dropped.
  const [leadName, setLeadName] = useState("");
  const [leadCompany, setLeadCompany] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadHeadcount, setLeadHeadcount] = useState("10 - 50 employees");

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

  // ── Marketing view (unauthenticated / 401) ────────────────────────────────
  if (unauthorized) {
    return (
      <div className="tnm2 nn" style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="appbar">
            <Link className="iconbtn" to="/" aria-label="Home"><i className="ph-bold ph-arrow-left" /></Link>
            <div className="abt">For Business</div>
          </div>
          <div className="content" style={{ paddingBottom: 32 }}>
            <div className="padx" style={{ paddingTop: 8 }}>
              <div className="lab safc mb10">Tanmatra for Business</div>
              <h1 className="disp mb10">
                Fuel your team with <span className="safc">clinical nutrition.</span>
              </h1>
              <p className="small mut">
                Ditch the office junk food. Set monthly wellness budgets, schedule recurring catered lunches, and provide dietitian consulting to reduce sick leaves and elevate collective focus.
              </p>
            </div>

            <div className="padx mt20">
              {BENEFITS.map((b) => (
                <div key={b.title} className="card mb10">
                  <div className="tt">{b.title}</div>
                  <div className="fine mt4">{b.desc}</div>
                </div>
              ))}
            </div>

            <div className="padx mt10">
              <div className="banner">
                <div className="small" style={{ fontWeight: 600 }}>Already registered as an HR admin?</div>
                <div className="fine mt4">Sign in to manage employees, view invoices, and manage credit lines.</div>
                <button className="btn btn-p btn-blk mt12" onClick={() => nav("/login?next=/corporate")}>
                  Sign in to Console
                </button>
              </div>
            </div>

            <div className="secrow" style={{ marginTop: 24 }}>
              <span className="sh">Request Corporate Proposal</span>
            </div>
            <div className="padx">
              <p className="fine mb14">
                Fill in details and our enterprise specialist will share customized plan tiers.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!leadName.trim() || !leadCompany.trim() || !leadEmail.trim()) {
                    toast.error("Please fill in all details");
                    return;
                  }
                  const message = [
                    "Corporate plan inquiry — Tanmatra",
                    `Contact: ${leadName}`,
                    `Company: ${leadCompany}`,
                    `Work email: ${leadEmail}`,
                    `Headcount: ${leadHeadcount}`,
                  ].join("\n");
                  window.open(
                    `https://wa.me/919289213115?text=${encodeURIComponent(message)}`,
                    "_blank",
                    "noopener,noreferrer",
                  );
                  toast.success("Almost done — send the pre-filled WhatsApp message and our enterprise team will follow up.");
                }}
              >
                <div className="lab mb6">Contact Name</div>
                <div className="inp mb12">
                  <i className="ph-bold ph-user" />
                  <input placeholder="HR Manager / Admin" required value={leadName} onChange={(e) => setLeadName(e.target.value)} />
                </div>

                <div className="lab mb6">Company Name</div>
                <div className="inp mb12">
                  <i className="ph-bold ph-buildings" />
                  <input placeholder="e.g. Acme Corp" required value={leadCompany} onChange={(e) => setLeadCompany(e.target.value)} />
                </div>

                <div className="lab mb6">Work Email</div>
                <div className="inp mb12">
                  <i className="ph-bold ph-envelope-simple" />
                  <input type="email" placeholder="hr@acme.com" required value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} />
                </div>

                <div className="lab mb6">Estimated Headcount</div>
                <select
                  className="mb12"
                  value={leadHeadcount}
                  onChange={(e) => setLeadHeadcount(e.target.value)}
                  style={{
                    height: 46,
                    width: "100%",
                    borderRadius: 10,
                    background: "var(--s1)",
                    border: "1px solid var(--ln2)",
                    color: "var(--tx)",
                    padding: "0 14px",
                    fontSize: "14.5px",
                  }}
                >
                  <option>10 - 50 employees</option>
                  <option>50 - 200 employees</option>
                  <option>200 - 1000 employees</option>
                  <option>1000+ employees</option>
                </select>

                <button type="submit" className="btn btn-p btn-lg btn-blk mt6">
                  Request Proposals
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Authenticated console view ────────────────────────────────────────────
  return (
    <div className="tnm2 nn" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="appbar">
          <Link className="iconbtn" to="/" aria-label="Home"><i className="ph-bold ph-arrow-left" /></Link>
          <div className="abt">Corporate Plans</div>
        </div>
        <div className="content padx" style={{ paddingTop: 4, paddingBottom: 32 }}>
          <p className="fine mb20">
            Subsidize meals for your team, run office lunch programs, and gift wellness vouchers.
          </p>

          <div className="lab mb10">Your companies</div>
          {loading ? (
            <>
              <div className="skel mb10" style={{ height: 68, borderRadius: 12 }} />
              <div className="skel mb10" style={{ height: 68, borderRadius: 12 }} />
            </>
          ) : companies.length === 0 ? (
            <div className="card tc mb10" style={{ padding: "22px 16px" }}>
              <i className="ph-bold ph-buildings" style={{ fontSize: 30, color: "var(--fnt)" }} />
              <div className="fine mt10">
                You're not part of any company yet. Create one below or accept an invite from your admin.
              </div>
            </div>
          ) : (
            companies.map(({ company, role }) => (
              <Link key={company.id} className="door" to={`/corporate/${company.slug}`}>
                <span className="dic"><i className="ph-bold ph-buildings" /></span>
                <span className="f1" style={{ minWidth: 0 }}>
                  <span className="tt" style={{ display: "block" }}>{company.name}</span>
                  <span className="fine">
                    {role.toUpperCase()} · Budget {F(company.perEmployeeMonthlyBudgetPaise)}/mo per employee
                  </span>
                </span>
                <i className="ph-bold ph-arrow-right safc" />
              </Link>
            ))
          )}

          <div className="lab mt20 mb10">Create a company</div>
          <div className="card">
            <div className="lab mb6">Company name</div>
            <div className="inp mb12">
              <i className="ph-bold ph-buildings" />
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc." />
            </div>

            <div className="lab mb6">Monthly budget per employee (₹)</div>
            <div className="inp mb14">
              <i className="ph-bold ph-currency-inr" />
              <input type="number" value={budgetRupees} onChange={(e) => setBudgetRupees(e.target.value)} />
            </div>

            <button
              className={"btn btn-p btn-blk" + (creating ? " dis" : "")}
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? "Creating…" : "Create company"}
            </button>
          </div>

          <div className="fine tc mt20">
            Looking for vouchers?{" "}
            <Link to="/vouchers" className="safc" style={{ fontWeight: 600 }}>
              Buy or redeem a wellness voucher
            </Link>
            .
          </div>
        </div>
      </div>
    </div>
  );
}
