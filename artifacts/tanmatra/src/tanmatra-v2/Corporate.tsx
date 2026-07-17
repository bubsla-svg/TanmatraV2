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
  const [leadPhone, setLeadPhone] = useState("");
  const [leadMessage, setLeadMessage] = useState("");
  const [submittingInquiry, setSubmittingInquiry] = useState(false);
  const [submittedInquiry, setSubmittedInquiry] = useState(false);

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
      <div className="tnm2 nn min-h-screen bg-[var(--tnm-surface-ink)] text-white antialiased">
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
                <div key={b.title} className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 mb10">
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
              {submittedInquiry ? (
                <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-clinical-sage/10 text-clinical-sage flex items-center justify-center mx-auto mb-4 border border-clinical-sage/20">
                    <i className="ph-bold ph-check" style={{ fontSize: 24 }} />
                  </div>
                  <div className="tt">Inquiry Received</div>
                  <p className="fine mt8 leading-relaxed">
                    Inquiry sent! Our corporate wellness lead will contact you within 24 hours.
                  </p>
                </div>
              ) : (
                <>
                  <p className="fine mb14">
                    Fill in details and our enterprise specialist will share customized plan tiers.
                  </p>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (
                        !leadName.trim() ||
                        !leadCompany.trim() ||
                        !leadEmail.trim() ||
                        !leadPhone.trim() ||
                        !leadMessage.trim()
                      ) {
                        toast.error("Please fill in all details");
                        return;
                      }
                      if (!/.+@.+\..+/.test(leadEmail)) {
                        toast.error("Please enter a valid email");
                        return;
                      }
                      setSubmittingInquiry(true);
                      try {
                        const body = {
                          companyName: leadCompany.trim(),
                          contactPerson: leadName.trim(),
                          email: leadEmail.trim().toLowerCase(),
                          phone: leadPhone.trim(),
                          size: leadHeadcount,
                          message: leadMessage.trim(),
                        };
                        const res = await fetch("/api/corporate/inquiries", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(body),
                        });
                        if (!res.ok) {
                          const j = (await res.json().catch(() => ({}))) as {
                            error?: string;
                          };
                          throw new Error(j.error ?? `HTTP ${res.status}`);
                        }
                        setSubmittedInquiry(true);
                        toast.success("Inquiry sent successfully!");
                      } catch (err) {
                        toast.error("Submission failed", {
                          description:
                            (err as Error).message ??
                            "Please check your network and try again.",
                        });
                      } finally {
                        setSubmittingInquiry(false);
                      }
                    }}
                  >
                    <div className="lab mb6">Contact Name</div>
                    <div className="inp mb12">
                      <i className="ph-bold ph-user" />
                      <input
                        placeholder="HR Manager / Admin"
                        required
                        value={leadName}
                        onChange={(e) => setLeadName(e.target.value)}
                        disabled={submittingInquiry}
                      />
                    </div>

                    <div className="lab mb6">Company Name</div>
                    <div className="inp mb12">
                      <i className="ph-bold ph-buildings" />
                      <input
                        placeholder="e.g. Acme Corp"
                        required
                        value={leadCompany}
                        onChange={(e) => setLeadCompany(e.target.value)}
                        disabled={submittingInquiry}
                      />
                    </div>

                    <div className="lab mb6">Work Email</div>
                    <div className="inp mb12">
                      <i className="ph-bold ph-envelope-simple" />
                      <input
                        type="email"
                        placeholder="hr@acme.com"
                        required
                        value={leadEmail}
                        onChange={(e) => setLeadEmail(e.target.value)}
                        disabled={submittingInquiry}
                      />
                    </div>

                    <div className="lab mb6">Phone Number</div>
                    <div className="inp mb12">
                      <i className="ph-bold ph-phone" />
                      <input
                        type="tel"
                        placeholder="+91 XXXXX XXXXX"
                        required
                        value={leadPhone}
                        onChange={(e) => setLeadPhone(e.target.value)}
                        disabled={submittingInquiry}
                      />
                    </div>

                    <div className="lab mb6">Estimated Headcount</div>
                    <select
                      className="mb12"
                      value={leadHeadcount}
                      onChange={(e) => setLeadHeadcount(e.target.value)}
                      disabled={submittingInquiry}
                      style={{
                        height: 46,
                        width: "100%",
                        borderRadius: 10,
                        background: "var(--tnm-surface-ink-2)",
                        border: "1px solid white/[0.08]",
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

                    <div className="lab mb6">Inquiry details / Message</div>
                    <div className="inp mb12" style={{ height: "auto" }}>
                      <textarea
                        placeholder="Describe your requirements (e.g. daily lunch, wellness seminars, dietitian consulting)..."
                        required
                        value={leadMessage}
                        onChange={(e) => setLeadMessage(e.target.value)}
                        disabled={submittingInquiry}
                        style={{
                          width: "100%",
                          background: "transparent",
                          border: "none",
                          color: "white",
                          padding: "10px 0",
                          fontSize: "14px",
                          outline: "none",
                          minHeight: "80px",
                          resize: "vertical",
                        }}
                      />
                    </div>

                    <button
                      type="submit"
                      className="btn btn-p btn-lg btn-blk mt6"
                      disabled={submittingInquiry}
                    >
                      {submittingInquiry ? "Submitting..." : "Request Proposals"}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Authenticated console view ────────────────────────────────────────────
  return (
    <div className="tnm2 nn min-h-screen bg-[var(--tnm-surface-ink)] text-white antialiased">
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
            <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 tc mb10">
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
          <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4">
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
