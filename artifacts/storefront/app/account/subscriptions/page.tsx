import type { Metadata } from "next";
import AccountSubscriptionsClient from "./AccountSubscriptionsClient";

export const metadata: Metadata = {
  title: "Account Subscriptions | Tanmatra",
};

export default function AccountSubscriptionsPage() {
  return <AccountSubscriptionsClient />;
}
