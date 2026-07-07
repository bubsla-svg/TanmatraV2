import type { MetaFunction } from "react-router";
import V2Terms from "@/tanmatra-v2/Terms";

export const meta: MetaFunction = () => [
  { title: "Terms of Service · Tanmatra" },
  {
    name: "description",
    content:
      "The terms governing your use of Tanmatra — accounts, orders, payments, refunds, content and liability.",
  },
];

export const handle = { chrome: false };

export default function Terms() {
  return <V2Terms />;
}
