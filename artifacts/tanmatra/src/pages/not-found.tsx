import { Link, type MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Page Not Found | Tanmatra" },
  { name: "description", content: "The page you were looking for doesn't exist or has moved. Browse the Tanmatra menu or head back home." },
  { name: "robots", content: "noindex, follow" },
];

// Chrome-less native v2 (.tnm2) route — appbar-less centered state, matching
// the other v2 pages (Home, Cart, Menu …).
export const handle = { chrome: false };

export default function NotFound() {
  return (
    <div
      className="tnm2"
      style={{
        minHeight: "100vh",
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
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
          <Link to="/menu" className="btn btn-p btn-blk btn-lg" style={{ textDecoration: "none" }}>
            <i className="ph-bold ph-cooking-pot" /> Browse the menu
          </Link>
          <Link to="/" className="btn btn-g btn-blk" style={{ textDecoration: "none" }}>
            <i className="ph-bold ph-house" /> Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
