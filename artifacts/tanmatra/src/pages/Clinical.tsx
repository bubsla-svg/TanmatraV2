import { type MetaFunction } from "react-router";
import V2Protocol from "@/tanmatra-v2/Protocol";

export const meta: MetaFunction = () => [
  { title: "Clinical Nutrition Protocol | Tanmatra" },
  { name: "description", content: "Evidence-based therapeutic meal plans for diabetes, hypertension, PCOS, thyroid disorders, and post-surgical recovery — supervised by registered dietitians." },
  { property: "og:title", content: "Clinical Nutrition Protocol | Tanmatra" },
  { property: "og:description", content: "Evidence-based therapeutic meal plans for diabetes, PCOS, and other clinical conditions — supervised by registered dietitians." },
  { property: "og:image", content: "https://tanmatra.food/opengraph.jpg" },
];

export const handle = { chrome: false };

export default function Clinical() {
  return <V2Protocol which="clinical" />;
}
