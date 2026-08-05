import type { Metadata } from "next";
import OrdersClient from "./OrdersClient";

export const metadata: Metadata = {
  title: "ORDERS | Tanmatra",
};

export default function OrdersPage() {
  return <OrdersClient />;
}
