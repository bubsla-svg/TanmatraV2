import { type MetaFunction } from "react-router";
import V2Protocol from "@/tanmatra-v2/Protocol";

export const meta: MetaFunction = () => [
  { title: "Performance Protocol | Tanmatra" },
  { name: "description", content: "High-protein, macro-calibrated meals built for athletes, gym-goers, and anyone optimising for physical performance and recovery." },
  { property: "og:title", content: "Performance Protocol | Tanmatra" },
  { property: "og:description", content: "High-protein meals built for athletes and anyone optimising for physical performance." },
  { property: "og:image", content: "https://tanmatra.food/opengraph.jpg" },
];

export const handle = { chrome: false };

export default function Performance() {
  return <V2Protocol which="performance" />;
}
