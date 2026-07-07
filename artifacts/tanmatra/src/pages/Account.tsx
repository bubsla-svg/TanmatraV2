import type { MetaFunction } from "react-router";
import V2Account from "@/tanmatra-v2/Account";

export const meta: MetaFunction = () => [
  { title: "Account | Tanmatra" },
  { name: "robots", content: "noindex, nofollow" },
];

export const handle = { chrome: false };

export default function Account() {
  return <V2Account />;
}
