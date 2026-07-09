import { type MetaFunction } from "react-router";
import V2CheckoutAppointment from "@/tanmatra-v2/CheckoutAppointment";

export const meta: MetaFunction = () => [
  { title: "Book RD Consultation | Tanmatra" },
  { name: "description", content: "Pick a time slot and confirm payment to book a consultation with a registered dietitian. Sign in to complete your booking." },
  { name: "robots", content: "noindex, follow" },
];

export const handle = { chrome: false };

export default function CheckoutAppointment() {
  return <V2CheckoutAppointment />;
}
