import { Link } from "react-router";

/* Full-parity re-port of the System-A Terms page (git 2507084) into v2. */

const SECTIONS = [
  {
    n: "01",
    title: "Your account",
    body:
      "You are responsible for keeping your phone number, OTP, and account details secure. Tanmatra may suspend accounts used in violation of these terms or applicable law.",
  },
  {
    n: "02",
    title: "Orders, payments, refunds",
    body:
      "All prices are inclusive of applicable taxes. Order cancellation and refund policies are explained at checkout. Disputes should be raised within 24 hours of delivery via the in-app support channel.",
  },
  {
    n: "03",
    title: "Content & conduct",
    body:
      "Reviews, photos, and other content you submit must be your own and comply with applicable law. Tanmatra may remove content that violates these terms.",
  },
  {
    n: "04",
    title: "Limitation of liability",
    body:
      "Subject to applicable consumer-protection law, Tanmatra's aggregate liability for any claim is limited to the value of the order giving rise to the claim.",
  },
  {
    n: "05",
    title: "Changes",
    body:
      "We may update these terms; material changes will be notified at sign-in. Continued use after a change constitutes acceptance.",
  },
];

export default function V2Terms() {
  return (
    <div className="tnm2 nn min-h-dvh bg-[var(--tnm-surface-ink)] text-white antialiased">
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="appbar">
          <Link className="iconbtn" to="/">
            <i className="ph-bold ph-arrow-left" />
          </Link>
          <div className="abt">Terms</div>
        </div>

        {/* Header */}
        <div className="padx mt6 mb16">
          <div className="lab mb6">Effective May 2026</div>
          <div className="disp">Terms of Service</div>
        </div>

        {/* Intro */}
        <div className="padx">
          <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4">
            <div className="small" style={{ color: "var(--tx)", lineHeight: 1.5 }}>
              Welcome to Tanmatra. By placing an order, signing in, or using any
              part of our service you agree to these terms.
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="padx mt12">
          {SECTIONS.map((s) => (
            <div key={s.n} className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 mb10 fx gap12">
              <div className="lab" style={{ color: "var(--safb)", flex: "none", marginTop: 2 }}>
                {s.n}
              </div>
              <div className="f1">
                <div className="text-[11px] font-semibold tracking-[0.06em] uppercase text-white/50 mb6">{s.title}</div>
                <div className="fine">{s.body}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="padx mt6 mb20">
          <div className="note">
            <i className="ph-bold ph-info" />
            <div>
              Questions? See our{" "}
              <Link to="/privacy" style={{ color: "var(--safb)", fontWeight: 600 }}>
                Privacy Policy
              </Link>{" "}
              or contact support from your{" "}
              <Link to="/account" style={{ color: "var(--safb)", fontWeight: 600 }}>
                account
              </Link>{" "}
              page.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
