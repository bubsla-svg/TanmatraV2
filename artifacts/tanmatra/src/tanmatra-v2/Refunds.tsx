import { Link } from "react-router";

/* Full-parity re-port of the System-A Refund & Cancellation policy
 * (git 2507084) into the v2 (.tnm2) design language. Same links / content,
 * v2 UI. Phosphor icons only. */

// Fixed to the month this policy's content was last materially revised.
// Must NOT be derived from `new Date()` — that would falsely re-stamp the
// page as "updated this month" on every render (and break prerender
// determinism). Bump this only when the policy text below actually changes.
const LAST_UPDATED = "July 2026";

export default function V2Refunds() {
  return (
    <div className="tnm2 nn" style={{ minHeight: "100dvh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100dvh" }}>
        {/* App bar */}
        <div className="appbar">
          <Link className="iconbtn" to="/" aria-label="Home"><i className="ph-bold ph-arrow-left" /></Link>
          <div className="abt">Refunds</div>
        </div>

        <div className="content padx" style={{ paddingTop: 4, paddingBottom: 40 }}>
          {/* Header */}
          <div className="mb20" style={{ borderBottom: "1px solid var(--ln)", paddingBottom: 16 }}>
            <div className="h2">Refund &amp; Cancellation</div>
            <div className="lab mt6">Last updated: {LAST_UPDATED}</div>
            <div className="small mut mt10">
              We hold ourselves to a clinical-grade standard. If a meal arrives in a
              condition that doesn&apos;t meet that standard — or if anything has
              gone wrong with your order — write to us within the windows below
              and we will refund or replace promptly.
            </div>
          </div>

          {/* One-off orders */}
          <div className="sh mb10 fx ac g6"><i className="ph-bold ph-clock" style={{ color: "var(--safb)" }} /> One-off orders</div>
          <div className="card mb20">
            <div className="small" style={{ fontWeight: 600 }}>Cancellation</div>
            <div className="fine mt2">
              Cancel free of charge until your order moves to{" "}
              <span className="safc">Preparing</span>. Once the kitchen has started,
              the order cannot be cancelled — it will be delivered.
            </div>

            <div className="small mt14" style={{ fontWeight: 600 }}>Refunds for issues</div>
            <ul className="fine mt2" style={{ listStyle: "disc", paddingLeft: 18 }}>
              <li>Wrong item, missing item, or damaged packaging — full refund or free replacement.</li>
              <li>Quality concern (taste, temperature, hygiene) — full refund on the affected item.</li>
              <li>Late delivery beyond the promised window — partial credit applied automatically.</li>
            </ul>

            <div className="small mt14" style={{ fontWeight: 600 }}>How to raise an issue</div>
            <div className="fine mt2">
              Use the <Link to="/track" className="safc" style={{ fontWeight: 600 }}>Track</Link> page within 4 hours of delivery, or
              WhatsApp us at <a href="https://wa.me/919289213115" className="safc" style={{ fontWeight: 600 }} target="_blank" rel="noopener noreferrer">+91 92892 13115</a>. Refunds are processed
              in 3-5 business days to the original payment method.
            </div>
          </div>

          {/* Subscriptions & meal plans */}
          <div className="sh mb10 fx ac g6"><i className="ph-bold ph-arrows-clockwise" style={{ color: "var(--safb)" }} /> Subscriptions &amp; meal plans</div>
          <div className="card mb20">
            <div className="fine">
              <span className="small" style={{ fontWeight: 600, color: "var(--tx)" }}>Skip a delivery</span> — free up
              to 24 hours before the scheduled slot. The skipped value is added back
              to your wallet automatically.
            </div>
            <div className="fine mt10">
              <span className="small" style={{ fontWeight: 600, color: "var(--tx)" }}>Pause your plan</span> — pause
              for up to 8 weeks via the <Link to="/subscriptions" className="safc" style={{ fontWeight: 600 }}>My Plans</Link> page. Your delivery
              window is held; resume any time.
            </div>
            <div className="fine mt10">
              <span className="small" style={{ fontWeight: 600, color: "var(--tx)" }}>Cancel a subscription</span> —
              cancel any time from the same page. Upcoming deliveries are removed.
              Prepaid balance remains as wallet credit, usable on one-off orders.
            </div>
            <div className="fine mt10">
              <span className="small" style={{ fontWeight: 600, color: "var(--tx)" }}>Refunds against unused weeks</span>
              — if a plan is cancelled mid-cycle, we refund unused full weeks
              (deliveries not yet despatched) within 7 business days, less any
              welcome-offer credit applied at signup.
            </div>
          </div>

          {/* RD consults & appointments */}
          <div className="sh mb10 fx ac g6"><i className="ph-bold ph-calendar-x" style={{ color: "var(--safb)" }} /> RD consults &amp; appointments</div>
          <div className="card mb20">
            <div className="fine">
              <span className="small" style={{ fontWeight: 600, color: "var(--tx)" }}>Free cancellation up to 12 hours</span>
              before your scheduled consult. Full refund processed in 3-5 business days.
            </div>
            <div className="fine mt10">
              Within 12 hours, the consult fee becomes non-refundable but you may
              reschedule once at no charge from <Link to="/appointments" className="safc" style={{ fontWeight: 600 }}>My Care</Link>.
            </div>
            <div className="fine mt10">
              No-shows are non-refundable. The RD will dial in at the scheduled
              time and wait 10 minutes before releasing the slot.
            </div>
          </div>

          {/* Grievance Officer */}
          <div className="sh mb10 fx ac g6" id="grievance"><i className="ph-bold ph-shield-warning" style={{ color: "var(--safb)" }} /> Grievance Officer</div>
          <div className="card mb20">
            <div className="fine">
              In compliance with the Digital Personal Data Protection Act 2023 §32
              and the Consumer Protection (E-Commerce) Rules 2020, complaints
              that cannot be resolved through normal customer support can be
              escalated to our Grievance Officer:
            </div>
            <div className="mt10" style={{ borderRadius: 10, border: "1px solid var(--ln)", background: "var(--s2)", padding: 12 }}>
              <div className="small" style={{ fontWeight: 600 }}>Tanmatra Health Technologies Pvt. Ltd.</div>
              <div className="fine mt4">Grievance Officer · Care Operations</div>
              <div className="fine mt4 fx ac g6"><i className="ph-bold ph-envelope" style={{ color: "var(--safb)" }} /> <a href="mailto:grievance@tanmatra.food" className="mut">grievance@tanmatra.food</a></div>
              <div className="fine mt4 fx ac g6"><i className="ph-bold ph-phone" style={{ color: "var(--safb)" }} /> <a href="tel:+919289213115" className="mut">+91 92892 13115</a> (Mon-Sat 09:00-19:00 IST)</div>
              <div className="fine mt4 fx ac g6"><i className="ph-bold ph-whatsapp-logo" style={{ color: "var(--sage)" }} /> <a href="https://wa.me/919289213115" target="_blank" rel="noopener noreferrer" className="mut">WhatsApp +91 92892 13115</a></div>
            </div>
            <div className="fine mt10">
              We acknowledge complaints within 24 hours and aim to resolve them
              within 7 business days. Issues unresolved after 30 days may be
              escalated to the National Consumer Helpline (1915) or the
              consumer commission having jurisdiction.
            </div>
          </div>

          {/* Footer note */}
          <div className="fine" style={{ borderTop: "1px solid var(--ln)", paddingTop: 16, fontSize: 11.5 }}>
            This policy is provided for transparency and may be updated. Material
            changes will be notified by email + in-app banner. The most recent
            version always lives at this URL. See also our{" "}
            <Link to="/privacy" className="safc" style={{ fontWeight: 600 }}>Privacy Policy</Link>{" "}
            and <Link to="/terms" className="safc" style={{ fontWeight: 600 }}>Terms of Service</Link>.
          </div>
        </div>
      </div>
    </div>
  );
}
