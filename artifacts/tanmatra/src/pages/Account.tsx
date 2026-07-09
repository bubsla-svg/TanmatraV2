import type { MetaFunction } from "react-router";
import V2Account from "@/tanmatra-v2/Account";

export const meta: MetaFunction = () => [
  { title: "Account | Tanmatra" },
  { name: "description", content: "Manage your Tanmatra profile, contact details, and account settings. Sign in to view your account." },
  { name: "robots", content: "noindex, follow" },
];

export const handle = { chrome: false };

export default function Account() {
  return <V2Account />;
}
