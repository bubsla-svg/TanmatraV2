import { Link, type MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Billing & Mandates | Tanmatra" },
  { name: "robots", content: "noindex, follow" },
];

export const handle = { chrome: false };

export default function BillingStub() {
  return (
    <div className="tnm2 nn" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center" }}>
        <h1>Billing & Mandates</h1>
        <div style={{ marginTop: 24 }}>
          <Link to="/menu" className="btn btn-p">Back to Menu</Link>
        </div>
      </div>
    </div>
  );
}
