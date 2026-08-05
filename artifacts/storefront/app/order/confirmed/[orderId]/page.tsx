import type { Metadata } from "next";
import OrderConfirmedClient from "./OrderConfirmedClient";

export const metadata: Metadata = {
  title: "Order Confirmed | Tanmatra",
};

interface PageProps {
  params: Promise<{ orderId: string }>;
}

export default async function OrderConfirmedPage({ params }: PageProps) {
  const resolvedParams = await params;
  
  return <OrderConfirmedClient orderId={resolvedParams.orderId} />;
}
