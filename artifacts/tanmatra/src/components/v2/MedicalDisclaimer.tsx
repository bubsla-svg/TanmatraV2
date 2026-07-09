/**
 * Medical disclaimer for the v2 surface. The legacy Footer (which carried
 * the only disclaimer) never renders on chrome-less v2 pages, so every
 * clinical-claim surface mounts this directly instead.
 */
export default function MedicalDisclaimer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="fine" style={{ fontSize: 10.5, lineHeight: 1.5, color: "var(--fnt)", padding: "10px 2px" }}>
        <i className="ph-bold ph-first-aid" style={{ marginRight: 5 }} />
        Tanmatra meals support — they don't replace — medical care. Consult your
        physician before starting any therapeutic nutrition programme.
      </p>
    );
  }
  return (
    <div
      className="card"
      style={{ background: "var(--s1)", borderColor: "var(--ln)", padding: "12px 14px", marginTop: 14 }}
    >
      <p className="lab" style={{ marginBottom: 6 }}>
        <i className="ph-bold ph-first-aid" /> Medical disclaimer
      </p>
      <p className="fine" style={{ fontSize: 11.5, lineHeight: 1.55 }}>
        Tanmatra meals and plans are designed as adjuncts to medical treatment —
        they do not diagnose, treat, or cure any condition and are not a
        substitute for care prescribed by your doctor. If you live with a
        medical condition, are pregnant, or take prescription medication,
        consult your physician or a registered dietitian before starting any
        therapeutic nutrition programme.
      </p>
    </div>
  );
}
