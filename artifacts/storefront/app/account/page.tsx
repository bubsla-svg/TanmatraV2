import type { Metadata } from "next";
import AccountClient from "./AccountClient";

export const metadata: Metadata = {
  title: "ACCOUNT | Tanmatra",
};

export default function AccountPage() {
  return <AccountClient />;
}
