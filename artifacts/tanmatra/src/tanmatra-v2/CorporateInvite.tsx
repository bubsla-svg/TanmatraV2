import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { corporateApi, type Company, type CompanyMember } from "@/lib/corporateApi";

/* Full-parity re-port of the System-A CorporateInvite (git 2507084) into v2.
 * Invite fetch + accept logic preserved verbatim; presentation only is v2. */

export default function V2CorporateInvite() {
  const { token = "" } = useParams<{ token: string }>();
  const nav = useNavigate();
  const [invite, setInvite] = useState<{ invite: CompanyMember; company: Company } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    corporateApi
      .getInvite(token)
      .then((r) => setInvite(r))
      .catch(() => setError("Invite not found or expired"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const r = await corporateApi.acceptInvite(token);
      toast.success(`Joined ${r.company.name}`);
      nav(`/corporate/${r.company.slug}`);
    } catch (e) {
      const msg = String((e as Error).message);
      if (msg.startsWith("401")) {
        nav(`/login?next=${encodeURIComponent(`/corporate/invite/${token}`)}`);
        return;
      }
      toast.error("Could not accept invite");
    } finally {
      setAccepting(false);
    }
  };

  const Shell = ({ children }: any) => (
    <div className="tnm2 nn" style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ maxWidth: 420, width: "100%", margin: "0 auto", padding: 20 }}>{children}</div>
    </div>
  );

  if (loading) {
    return (
      <Shell>
        <div className="tc mb20">
          <div className="dic" style={{ width: 48, height: 48, margin: "0 auto 12px", color: "var(--safb)", fontSize: 24 }}><i className="ph-bold ph-buildings" /></div>
          <div className="h2">Loading invite…</div>
          <div className="fine mt6">Fetching your invitation details.</div>
        </div>
        <div className="card">
          <div className="skel" style={{ height: 16, width: "60%", marginBottom: 12 }} />
          <div className="skel" style={{ height: 12, width: "90%", marginBottom: 8 }} />
          <div className="skel" style={{ height: 12, width: "75%" }} />
        </div>
      </Shell>
    );
  }

  if (error || !invite) {
    return (
      <Shell>
        <div className="tc mb20">
          <div className="dic" style={{ width: 48, height: 48, margin: "0 auto 12px", color: "var(--dgr)", background: "var(--s3)", fontSize: 24 }}><i className="ph-bold ph-warning-circle" /></div>
          <div className="h2">Invite unavailable</div>
          <div className="fine mt6">{error ?? "Invite not found or expired"}</div>
        </div>
        <div className="card">
          <div className="note" style={{ background: "var(--s3)", borderColor: "var(--ln2)", color: "var(--mut)" }}>
            <i className="ph-bold ph-info dgrc" />
            <span>This invitation link may have expired or already been used. Ask your company admin to send a fresh invite.</span>
          </div>
          <button className="btn btn-g btn-blk mt14" onClick={() => nav("/corporate")}><i className="ph-bold ph-arrow-left" /> Back to Corporate</button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="tc mb20">
        <div className="dic" style={{ width: 48, height: 48, margin: "0 auto 12px", color: "var(--safb)", fontSize: 24 }}><i className="ph-bold ph-buildings" /></div>
        <div className="h2">{invite.company.name}</div>
        <div className="fine mt6">
          You've been invited as a <strong style={{ color: "var(--tx)" }}>{invite.invite.role}</strong>. Accept to start using the company meal program.
        </div>
      </div>

      <div className="card">
        <div className="fx ac gap12 mb14">
          <div className="avatar big" style={{ color: "var(--safb)" }}><i className="ph-bold ph-buildings" style={{ fontSize: 22 }} /></div>
          <div style={{ minWidth: 0 }}>
            <div className="tt clamp1">{invite.company.name}</div>
            <div className="lab mt4">Company meal program</div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--ln)", paddingTop: 14 }}>
          <div className="lab mb6">Invitation for</div>
          <div className="small clamp1">{invite.invite.email}</div>
        </div>

        <div className="fx ac g6 mt14">
          <span className="pill sg"><i className="ph-fill ph-shield-check" /> {invite.invite.role}</span>
        </div>

        <button className="btn btn-p btn-lg btn-blk mt14" onClick={handleAccept} disabled={accepting}>
          <i className="ph-bold ph-check-circle" /> {accepting ? "Joining…" : "Accept invite"}
        </button>
      </div>

      <div className="fine tc mt14"><i className="ph-bold ph-lock-simple" style={{ color: "var(--sage)" }} /> Secure corporate invitation</div>
    </Shell>
  );
}
