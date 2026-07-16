import { Link } from "react-router";

/* Full-parity re-port of the System-A Privacy page (git 2507084) into the
 * v2 (.tnm2) design language — same content, links and structure, v2 UI.
 * DPDP Act 2023 policy; the "Health & wearable data" section is deep-linked
 * by name from the Wellness screen, so it carries an id="health" anchor. */

const B = ({ children }: any) => <strong style={{ color: "var(--tx)", fontWeight: 600 }}>{children}</strong>;

export default function V2Privacy() {
  return (
    <div className="tnm2 nn" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh" }}>
        {/* App bar */}
        <div className="appbar">
          <Link className="iconbtn" to="/" aria-label="Home"><i className="ph-bold ph-arrow-left" /></Link>
          <div className="abt">Privacy</div>
        </div>

        <div className="content padx" style={{ paddingTop: 4, paddingBottom: 40 }}>
          {/* Header */}
          <div className="lab mb6">Effective May 2026</div>
          <div className="h2">Privacy Policy</div>
          <div className="fine mt6">Compliant with the Digital Personal Data Protection Act, 2023 (India).</div>

          {/* What we collect */}
          <div className="card mt16">
            <div className="sh">What we collect</div>
            <div className="col g6 mt10">
              <div className="small fx g6"><i className="ph-bold ph-circle-fill safc" style={{ fontSize: 6, marginTop: 6 }} /><span className="f1 mut"><B>Account:</B> phone number, optional name and email.</span></div>
              <div className="small fx g6"><i className="ph-bold ph-circle-fill safc" style={{ fontSize: 6, marginTop: 6 }} /><span className="f1 mut"><B>Orders:</B> delivery address, order history, dietary preferences you choose to share.</span></div>
              <div className="small fx g6"><i className="ph-bold ph-circle-fill safc" style={{ fontSize: 6, marginTop: 6 }} /><span className="f1 mut"><B>Attribution:</B> the source that brought you to Tanmatra (e.g. a Google Ad, a friend's referral link). Stored once at sign-up.</span></div>
              <div className="small fx g6"><i className="ph-bold ph-circle-fill safc" style={{ fontSize: 6, marginTop: 6 }} /><span className="f1 mut"><B>Operational telemetry:</B> error reports and basic usage signals to keep the app reliable.</span></div>
            </div>
          </div>

          {/* How we use it */}
          <div className="card mt12">
            <div className="sh">How we use it</div>
            <div className="fine mt10">To fulfil your orders, personalise your menu, keep your account secure, and improve the service. We do not sell your personal data to third parties.</div>
          </div>

          {/* Marketing communication */}
          <div className="card mt12">
            <div className="sh">Marketing communication</div>
            <div className="fine mt10">
              We only send marketing SMS if you explicitly opted in at sign-up. You can withdraw consent any time by replying STOP to any marketing SMS, or by toggling the option in your{" "}
              <Link to="/account" style={{ color: "var(--safb)" }}>account</Link>{" "}page.
            </div>
          </div>

          {/* Health & wearable data */}
          <div className="card mt12" id="health">
            <div className="sh">Health &amp; wearable data</div>
            <div className="fine mt10">
              If you choose to connect Apple Health, Health Connect, or another wearable, we receive only the metrics you explicitly authorise — currently <B>daily steps</B> and <B>active calories burned</B>. We never read heart rate, sleep, weight, blood glucose, ECG, location history, or any other category from these sources.
            </div>
            <div className="fine mt10">
              Wearable readings are treated as <B>sensitive personal data</B> under the DPDP Act 2023. They are stored encrypted, accessible only to you and the registered dietitian you explicitly book a consult with, and are never used for advertising or shared with third parties. You can disconnect the integration at any time from{" "}
              <Link to="/wellness" style={{ color: "var(--safb)" }}>Wellness</Link>{" "}— disconnecting stops new data inflows; the Erasure Right below covers existing readings.
            </div>
            <div className="fine mt10">
              We do not write data back to your wearable platform and hold the HealthKit / Health Connect entitlements required by Apple and Google. We follow each platform&apos;s data-handling guidelines.
            </div>
          </div>

          {/* Your rights */}
          <div className="card mt12">
            <div className="sh">Your rights</div>
            <div className="fine mt10">
              Under the DPDP Act you may request access, correction, or erasure of your personal data. Email our Grievance Officer at{" "}
              <a href="mailto:dpo@tanmatra.food" style={{ color: "var(--safb)" }}>dpo@tanmatra.food</a>. We respond within 30 days.
            </div>
          </div>

          {/* Retention */}
          <div className="card mt12">
            <div className="sh">Retention</div>
            <div className="fine mt10">We retain order data for 7 years for tax and consumer-law reasons. Account data is deleted on request unless retention is required by law.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
