import { type MetaFunction } from "react-router";
import { getRdMember, getRdProfile } from "@/lib/rdBookingData";
import V2RdProfile from "@/tanmatra-v2/RdProfile";

export const meta: MetaFunction = ({ params }) => {
  const slug = params.slug ?? "";
  const profile = getRdProfile(slug);
  const member = getRdMember(slug);
  if (!profile || !member) return [{ title: "Registered Dietitian | Tanmatra" }];
  const title = `${member.name}, Registered Dietitian | Tanmatra`;
  const description = `${member.credentials.join(", ")}. Specialises in ${profile.specialties.join(", ")}. Book a consultation with ${member.name} on Tanmatra.`;
  const image = "https://tanmatra.food/opengraph.jpg";
  const url = `https://tanmatra.food/rd/${slug}`;
  return [
    { title },
    { name: "description", content: description },
    { property: "og:type", content: "profile" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: image },
    { property: "og:url", content: url },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
    { tagName: "link", rel: "canonical", href: url },
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": member.name,
        "jobTitle": "Registered Dietitian",
        "description": member.bio,
        "knowsLanguage": profile.languages,
        "url": url,
        "worksFor": {
          "@type": "Organization",
          "name": "Tanmatra",
          "url": "https://tanmatra.food",
        },
      },
    },
  ];
};

export const handle = { chrome: false };

export default function RdProfile() {
  return <V2RdProfile />;
}
