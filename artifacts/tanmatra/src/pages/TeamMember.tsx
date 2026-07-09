import { type MetaFunction } from "react-router";
import { getTeamMemberBySlug } from "@/lib/teamData";
import V2TeamMember from "@/tanmatra-v2/TeamMember";

export const meta: MetaFunction = ({ params }) => {
  const member = getTeamMemberBySlug(params.slug ?? "");
  if (!member) return [{ title: "Team Member | Tanmatra" }];
  const title = `${member.name} — ${member.title} | Tanmatra`;
  const description = member.bio;
  const image = "https://tanmatra.food/opengraph.jpg";
  const url = `https://tanmatra.food/team/${member.slug}`;
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
        "jobTitle": member.title,
        "description": member.bio,
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

export default function TeamMember() {
  return <V2TeamMember />;
}
