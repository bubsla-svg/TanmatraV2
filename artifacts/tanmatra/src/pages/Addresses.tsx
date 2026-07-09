import { type MetaFunction } from "react-router";
import V2Addresses from "@/tanmatra-v2/Addresses";

export const meta: MetaFunction = () => [
  { title: "Saved Addresses | Tanmatra" },
  { name: "description", content: "Add, edit, or remove your saved delivery addresses. Sign in to manage your addresses." },
  { name: "robots", content: "noindex, follow" },
];

export const handle = { chrome: false };

export default function Addresses() {
  return <V2Addresses />;
}
