import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import {
  corporateApi,
  type Company,
  type CompanyMember,
  type OfficeOrder,
} from "@/lib/corporateApi";
import { formatPrice } from "@/lib/api/adapter";

/* Full-parity re-port of the System-A CorporateAdmin (git 2507084) into v2. */

export default function V2CorporateAdmin() {
  const { slug = "" } = useParams<{ slug: string }>();
  const nav = useNavigate();
  const [data, setData] = useState<{
    company: Company;
    members: CompanyMember[];
    membership: CompanyMember;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [budgetRupees, setBudgetRupees] = useState("");
  const [officeOrders, setOfficeOrders] = useState<OfficeOrder[]>([]);

  // Office order form
  const [ooTitle, setOoTitle] = useState("Team lunch");
  const [ooBudget, setOoBudget] = useState("400");
  const [ooLine, setOoLine] = useState("");
  const [ooCity, setOoCity] = useState("Noida");
  const [ooPincode, setOoPincode] = useState("");

  const refresh = async () => {
    try {
      const r = await corporateApi.getCompany(slug);
      setData({
        company: r.company,
        members: r.members,
        membership: r.membership,
      });
      setBudgetRupees(String(r.company.perEmployeeMonthlyBudgetPaise / 100));
      const o = await corporateApi.listOfficeOrders(slug);
      setOfficeOrders(o.officeOrders);
    } catch (e) {
      toast.error("Could not load company");
      nav("/corporate");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (loading || !data) {
    return (
      <div className="tnm2 nn" style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="appbar">
            <Link className="iconbtn" to="/corporate" aria-label="All companies">
              <i className="ph-bold ph-arrow-left" />
            </Link>
            <div className="abt">Company</div>
          </div>
          <div className="content padx" style={{ paddingTop: 4 }}>
            <div className="trust mb14">
              <div className="tcell"><div className="skel" style={{ height: 18, margin: "0 auto", width: "50%" }} /><div className="ttx">Members</div></div>
              <div className="tcell"><div className="skel" style={{ height: 18, margin: "0 auto", width: "60%" }} /><div className="ttx">Spent</div></div>
              <div className="tcell"><div className="skel" style={{ height: 18, margin: "0 auto", width: "60%" }} /><div className="ttx">Budget</div></div>
            </div>
            <div className="skel mb10" style={{ height: 64 }} />
            <div className="skel mb10" style={{ height: 120 }} />
            <div className="fine tc mt20">Loading…</div>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = data.membership.role === "admin";

  const handleInvite = async () => {
    if (!inviteEmail.includes("@")) {
      toast.error("Valid email required");
      return;
    }
    try {
      const r = await corporateApi.invite(slug, inviteEmail.trim());
      const url = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}${r.inviteUrl}`;
      await navigator.clipboard.writeText(url).catch(() => undefined);
      toast.success(`Invite sent — link copied to clipboard`);
      setInviteEmail("");
      refresh();
    } catch {
      toast.error("Could not send invite");
    }
  };

  const handleRemove = async (memberId: number) => {
    try {
      await corporateApi.removeMember(slug, memberId);
      toast.success("Member removed");
      refresh();
    } catch {
      toast.error("Could not remove member");
    }
  };

  const handleBudget = async () => {
    const paise = Math.max(0, Math.round(Number(budgetRupees || 0) * 100));
    try {
      await corporateApi.updateBudget(slug, paise);
      toast.success("Budget updated");
      refresh();
    } catch {
      toast.error("Could not update budget");
    }
  };

  const handleCreateOfficeOrder = async () => {
    const budget = Math.max(0, Math.round(Number(ooBudget || 0) * 100));
    if (!ooLine.trim() || !ooPincode.trim()) {
      toast.error("Address required");
      return;
    }
    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + 1);
    scheduledFor.setHours(13, 0, 0, 0);
    const windowClosesAt = new Date(scheduledFor);
    windowClosesAt.setHours(scheduledFor.getHours() - 3);
    try {
      await corporateApi.createOfficeOrder({
        companySlug: slug,
        title: ooTitle,
        scheduledFor: scheduledFor.toISOString(),
        windowClosesAt: windowClosesAt.toISOString(),
        perEmployeeBudgetPaise: budget,
        address: {
          line: ooLine.trim(),
          city: ooCity.trim(),
          pincode: ooPincode.trim(),
        },
      });
      toast.success("Office lunch scheduled");
      setOoLine("");
      setOoPincode("");
      refresh();
    } catch {
      toast.error("Could not schedule office lunch");
    }
  };

  const totalSpent = data.members.reduce(
    (s, m) => s + (m.spentThisMonthPaise ?? 0),
    0,
  );
  const activeCount = data.members.filter((m) => m.status === "active").length;

  const memberStatusColor = (status: string) =>
    status === "active"
      ? "var(--sage)"
      : status === "invited"
        ? "var(--safb)"
        : "var(--fnt)";

  return (
    <div className="tnm2 nn" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="appbar">
          <Link className="iconbtn" to="/corporate" aria-label="All companies">
            <i className="ph-bold ph-arrow-left" />
          </Link>
          <div className="abt clamp1">{data.company.name}</div>
        </div>

        <div className="content padx" style={{ paddingTop: 4, paddingBottom: 24 }}>
          <div className="fx ac g6 mb4">
            <i className="ph-fill ph-buildings safc" style={{ fontSize: 17 }} />
            <span className="lab">
              {isAdmin ? "Admin console" : "Member view"}
            </span>
          </div>
          <p className="fine mb14">Slug: {data.company.slug}</p>

          {/* Stats */}
          <div className="trust mb14">
            <div className="tcell">
              <div className="tn">{activeCount}</div>
              <div className="ttx">Active members</div>
            </div>
            <div className="tcell">
              <div className="tn">{formatPrice(totalSpent)}</div>
              <div className="ttx">Spent this month</div>
            </div>
            <div className="tcell">
              <div className="tn safc">
                {formatPrice(data.company.perEmployeeMonthlyBudgetPaise)}
              </div>
              <div className="ttx">Budget / employee</div>
            </div>
          </div>

          {/* Per-employee budget (admin) */}
          {isAdmin && (
            <div className="card mb14">
              <div className="lab fx ac g6 mb10">
                <i className="ph-bold ph-wallet safc" /> Per-employee monthly budget
              </div>
              <div className="fx ac gap8">
                <span className="inp f1">
                  <i className="ph-bold ph-currency-inr" />
                  <input
                    type="number"
                    inputMode="numeric"
                    value={budgetRupees}
                    onChange={(e) => setBudgetRupees(e.target.value)}
                    placeholder="0"
                  />
                </span>
                <button
                  type="button"
                  className="btn btn-p"
                  onClick={handleBudget}
                  style={{ flex: "none" }}
                >
                  Update
                </button>
              </div>
            </div>
          )}

          {/* Members */}
          <div className="card mb14">
            <div className="lab fx ac g6 mb10">
              <i className="ph-bold ph-users safc" /> Members
            </div>
            {isAdmin && (
              <div className="fx ac gap8 mb6">
                <span className="inp f1">
                  <i className="ph-bold ph-envelope" />
                  <input
                    placeholder="employee@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </span>
                <button
                  type="button"
                  className="btn btn-p"
                  onClick={handleInvite}
                  style={{ flex: "none" }}
                >
                  <i className="ph-bold ph-paper-plane-tilt" /> Invite
                </button>
              </div>
            )}
            {data.members.map((m) => (
              <div key={m.id} className="rowi" style={{ gap: 10 }}>
                <div className="f1" style={{ minWidth: 0 }}>
                  <div className="small clamp1" style={{ fontWeight: 600 }}>
                    {m.email}
                  </div>
                  <div className="fx ac gap8 wrap mt4">
                    <span className="pill" style={{ textTransform: "capitalize" }}>
                      {m.role}
                    </span>
                    <span
                      className="pill"
                      style={{
                        textTransform: "capitalize",
                        color: memberStatusColor(m.status),
                        background:
                          m.status === "active"
                            ? "var(--saged)"
                            : m.status === "invited"
                              ? "var(--safd)"
                              : "var(--s3)",
                      }}
                    >
                      {m.status}
                    </span>
                    <span className="fine">
                      Spent {formatPrice(m.spentThisMonthPaise ?? 0)}
                    </span>
                  </div>
                </div>
                <div className="fx ac gap8" style={{ flex: "none" }}>
                  {m.status === "invited" && m.inviteToken && (
                    <button
                      type="button"
                      className="qbtn"
                      aria-label="Copy invite link"
                      onClick={async () => {
                        const url = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/corporate/invite/${m.inviteToken}`;
                        await navigator.clipboard.writeText(url).catch(() => undefined);
                        toast.success("Invite link copied");
                      }}
                    >
                      <i className="ph-bold ph-copy" style={{ fontSize: 14 }} />
                    </button>
                  )}
                  {isAdmin &&
                    m.userId !== data.company.ownerUserId &&
                    m.status !== "removed" && (
                      <button
                        type="button"
                        className="qbtn"
                        aria-label={`Remove ${m.email}`}
                        onClick={() => handleRemove(m.id)}
                        style={{ color: "var(--dgr)" }}
                      >
                        <i className="ph-bold ph-trash" style={{ fontSize: 14 }} />
                      </button>
                    )}
                </div>
              </div>
            ))}
          </div>

          {/* Office lunch */}
          <div className="card">
            <div className="fx ac jb gap8 mb10">
              <div className="lab fx ac g6">
                <i className="ph-bold ph-calendar-check safc" /> Office lunch
              </div>
              <Link
                to={`/corporate/${slug}/lunch-planner`}
                className="linkq"
              >
                Weekly planner <i className="ph-bold ph-arrow-right" />
              </Link>
            </div>

            {isAdmin && (
              <>
                <div className="grid mb10" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <div className="lab mb4">Title</div>
                    <span className="inp">
                      <input
                        value={ooTitle}
                        onChange={(e) => setOoTitle(e.target.value)}
                      />
                    </span>
                  </div>
                  <div>
                    <div className="lab mb4">Budget / emp (₹)</div>
                    <span className="inp">
                      <input
                        type="number"
                        inputMode="numeric"
                        value={ooBudget}
                        onChange={(e) => setOoBudget(e.target.value)}
                      />
                    </span>
                  </div>
                </div>
                <span className="inp mb10">
                  <i className="ph-bold ph-map-pin" />
                  <input
                    placeholder="Office address"
                    value={ooLine}
                    onChange={(e) => setOoLine(e.target.value)}
                  />
                </span>
                <div className="grid mb10" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <span className="inp">
                    <input
                      placeholder="City"
                      value={ooCity}
                      onChange={(e) => setOoCity(e.target.value)}
                    />
                  </span>
                  <span className="inp">
                    <input
                      placeholder="Pincode"
                      inputMode="numeric"
                      value={ooPincode}
                      onChange={(e) => setOoPincode(e.target.value)}
                    />
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-p btn-blk mb14"
                  onClick={handleCreateOfficeOrder}
                >
                  <i className="ph-bold ph-calendar-plus" /> Schedule for tomorrow 1pm
                </button>
              </>
            )}

            {officeOrders.length === 0 ? (
              <p className="fine">No office lunches yet.</p>
            ) : (
              <div>
                {officeOrders.map((o) => (
                  <Link key={o.id} to={`/office-lunch/${o.id}`} className="rowi">
                    <div className="f1" style={{ minWidth: 0 }}>
                      <div className="small clamp1" style={{ fontWeight: 600 }}>
                        {o.title}
                      </div>
                      <div className="fine mt2 clamp1">
                        {new Date(o.scheduledFor).toLocaleString([], {
                          weekday: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {" · "}
                        {o.picks.length} picks · {formatPrice(o.totalPaise)} · {o.status}
                      </div>
                    </div>
                    <i className="ph-bold ph-caret-right car" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
