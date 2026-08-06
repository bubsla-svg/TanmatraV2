import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchOrderStatus } from "@/lib/orderStatus";
import OrderConfirmedClient from "./OrderConfirmedClient";

export const metadata: Metadata = {
  title: "Order Confirmed | Tanmatra",
};

interface PageProps {
  params: Promise<{ orderId: string }>;
}

export default async function OrderConfirmedPage({ params }: PageProps) {
  const resolvedParams = await params;
  
  const apiBase = process.env.API_BASE_URL ?? "http://localhost:3000";
  const result = await fetchOrderStatus(resolvedParams.orderId, apiBase);
  
  if (result.kind === "not_found") {
    notFound();
  }
  
  return <OrderConfirmedClient orderId={resolvedParams.orderId} />;
}
