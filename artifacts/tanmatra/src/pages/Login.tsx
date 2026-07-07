import { type MetaFunction } from "react-router";
import V2Login from "@/tanmatra-v2/Login";

export const meta: MetaFunction = () => [
  { title: "Sign in | Tanmatra" },
  { name: "robots", content: "noindex, nofollow" },
];

export const handle = { chrome: false };

export default function Login() {
  return <V2Login />;
}
