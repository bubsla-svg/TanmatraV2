// schema.org JSON-LD. Server components — no client JS. No fabricated fields
// (no social `sameAs`, no `logo`, no OG image) until real brand assets exist;
// everything here is derived from data the site already ships.
import type { DishData } from "@workspace/menu-catalog";
import { SITE_URL, absoluteUrl } from "@/lib/siteUrl";

const DESCRIPTION =
  "RD-designed lunches delivered to your desk. Real food, verified macros, no jargon.";

/** Emit an escaped ld+json <script>. Escaping `<` stops any dish name /
 *  description containing `</script>` from breaking out of the tag. */
function ldScript(obj: unknown) {
  const json = JSON.stringify(obj).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

/** Organization + WebSite, emitted once site-wide from the root layout. */
export function SiteStructuredData() {
  return ldScript({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "Tanmatra",
        url: SITE_URL,
        description: DESCRIPTION,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: "Tanmatra",
        url: SITE_URL,
        description: DESCRIPTION,
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
    ],
  });
}

/** Product schema for a dish detail page — price + availability rich snippet. */
export function DishStructuredData({ dish }: { dish: DishData }) {
  return ldScript({
    "@context": "https://schema.org",
    "@type": "Product",
    name: dish.name,
    description: dish.tasteDescription || dish.description,
    image: absoluteUrl(dish.image),
    category: "Prepared meal",
    brand: { "@type": "Brand", name: "Tanmatra" },
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: (dish.price / 100).toFixed(2),
      availability: dish.isAvailable
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `${SITE_URL}/dish/${dish.slug}`,
    },
  });
}
