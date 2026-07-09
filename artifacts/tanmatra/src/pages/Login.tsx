import { type MetaFunction } from "react-router";
import V2Login from "@/tanmatra-v2/Login";

export const meta: MetaFunction = () => [
  { title: "Sign In | Tanmatra" },
  { name: "description", content: "Sign in to your Tanmatra account to manage orders, meal plans, and preferences." },
  { name: "robots", content: "noindex, follow" },
];

export const handle = { chrome: false };

export default function Login() {
  return <V2Login />;
}
