import { Link, type MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Order Confirmed | Tanmatra" },
  { name: "robots", content: "noindex, follow" },
];

export const handle = { chrome: false };

export default function OrderConfirmedStub() {
  return (
    <div className="tnm2" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center" }}>
        <h1>Order Confirmed</h1>
        <div style={{ marginTop: 24 }}>
          <Link to="/menu" className="btn btn-p">Back to Menu</Link>
        </div>
      </div>
    </div>
  );
}
