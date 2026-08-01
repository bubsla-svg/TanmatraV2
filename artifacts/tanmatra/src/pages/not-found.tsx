import { Link, type MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Page Not Found | Tanmatra" },
  { name: "description", content: "The page you were looking for doesn't exist or has moved. Head back to the Tanmatra admin console." },
  { name: "robots", content: "noindex, follow" },
];

// Chrome-less native v2 (.tnm2) route — appbar-less centered state, matching
// the other v2 pages (Home, Cart, Menu …).
export const handle = { chrome: false };

export default function NotFound() {
  return (
    <div
      className="tnm2 nn"
      style={{
        minHeight: "100dvh",
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 360, width: "100%", textAlign: "center" }}>
        <i className="ph-bold ph-compass" style={{ fontSize: 40, color: "var(--safb)" }} />
        <div className="lab" style={{ marginTop: 16 }}>Error 404</div>
        <h1 className="h2" style={{ marginTop: 8 }}>This page wandered off</h1>
        <p className="fine" style={{ marginTop: 8 }}>
          We couldn&apos;t find the page you were looking for. It may have moved, or the
          link is out of date.
        </p>
        {/* This app is the internal Admin ERP; its consumer routes were
            removed in July. The old "Browse the menu" button pointed at
            /menu — which this router now resolves to THIS page, so the 404's
            own primary action was a loop back to the 404. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
          <Link to="/admin" className="btn btn-p btn-blk btn-lg" style={{ textDecoration: "none" }}>
            <i className="ph-bold ph-squares-four" /> Back to the admin console
          </Link>
          <a
            href="https://tanmatra.food"
            className="btn btn-g btn-blk"
            style={{ textDecoration: "none" }}
          >
            <i className="ph-bold ph-house" /> Tanmatra storefront
          </a>
        </div>
      </div>
    </div>
  );
}
