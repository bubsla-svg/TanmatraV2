import type { MetaFunction } from "react-router";
import V2Track from "@/tanmatra-v2/Track";

export const meta: MetaFunction = () => [
  { title: "Track Order | Tanmatra" },
  { name: "robots", content: "noindex, nofollow" },
];

export const handle = { chrome: false };

export default function Track() {
  return <V2Track />;
}
