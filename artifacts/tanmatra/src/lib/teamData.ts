import type { DishKitchen, DishData } from "@workspace/menu-catalog";
import { DISHES } from "@workspace/menu-catalog";
import type { Lifestyle } from "./dishEnrichment";

export type TeamRole = "chef" | "rd";

export interface TeamMember {
  slug: string;
  name: string;
  role: TeamRole;
  title: string;
  credentials: string[];
  bio: string;
  yearsExperience: number;
  signatureLine: string;
  kitchens?: DishKitchen[];
  lifestyles?: Exclude<Lifestyle, "all">[];
  ownedDishSlugs?: string[];
  initials: string;
  accent: "gold" | "sage" | "blue";
  councilNumber?: string;
  councilName?: string;
  verifyUrl?: string;
}

export const TEAM: TeamMember[] = [
  {
    slug: "chef-arjun-kapoor",
    name: "Arjun Kapoor",
    role: "chef",
    title: "Head Chef — Continental",
    credentials: ["Le Cordon Bleu, Paris", "Ex-Sous Chef, The Oberoi"],
    bio: "Arjun trained in classical French technique before moving back to India to lead our continental kitchen. He insists on cold-pressed oils, oven-roasted finishes over deep-frying, and breakfast recipes that hold their macro split even after delivery.",
    yearsExperience: 14,
    signatureLine: "Breakfast and wraps that travel well without losing their crunch.",
    kitchens: ["continental"],
    initials: "AK",
    accent: "gold",
  },
  {
    slug: "chef-mei-lin-tan",
    name: "Mei Lin Tan",
    role: "chef",
    title: "Head Chef — Asian",
    credentials: ["At-Sunrice GlobalChef Academy, Singapore", "Pan-Asian residency, Bangkok"],
    bio: "Mei Lin runs the Asian kitchen with a focus on bowls and broths. She blooms her own spice pastes, controls sodium with citrus and aromatics, and treats every grain base as the structural anchor of the dish.",
    yearsExperience: 11,
    signatureLine: "Bowls where every grain is rested for fluff before plating.",
    kitchens: ["asian"],
    initials: "MT",
    accent: "gold",
  },
  {
    slug: "chef-priya-iyer",
    name: "Priya Iyer",
    role: "chef",
    title: "Head Chef — Indian",
    credentials: ["IHM Mumbai", "Bawarchi mentorship, Hyderabad"],
    bio: "Priya leads our Indian kitchen with a respect for regional technique. Spice base bloomed in a separate pan, salt added post-tasting, and proteins finished sous-vide-style to retain moisture without extra fat.",
    yearsExperience: 16,
    signatureLine: "Restaurant-style mains, without the salt and oil load.",
    kitchens: ["indian"],
    initials: "PI",
    accent: "gold",
  },
  {
    slug: "chef-marco-bianchi",
    name: "Marco Bianchi",
    role: "chef",
    title: "Head Chef — Mediterranean",
    credentials: ["ALMA, Italian Culinary School", "Olive-oil sommelier (ONAOO)"],
    bio: "Marco oversees Mediterranean — salads, soups, light pasta. He triple-washes greens within the hour of plating and emulsifies dressings in-house. Every soup is slow-simmered for ninety minutes from a vegetable or bone broth base.",
    yearsExperience: 18,
    signatureLine: "Salads spun within the hour, dressings emulsified by hand.",
    kitchens: ["mediterranean"],
    initials: "MB",
    accent: "gold",
  },
  // RD identity fields below MIRROR artifacts/api-server/src/lib/rdIdentity.ts,
  // which is canonical. They are copied rather than imported because this is a
  // separate package that cannot reach into the api-server's source; if these
  // ever have a live consumer again, promote rdIdentity.ts to a shared lib/*
  // package and import it here instead of maintaining a second copy.
  //
  // This file held a third, higher set of claims — "Dr." on all three names,
  // "PhD Clinical Nutrition, AIIMS", 17 years for Anjali and 12 for Kavya —
  // that neither server record agreed with. Nothing routes TEAM in this app any
  // more (customer routes were removed 2026-07-26; no /team route exists in
  // src/routes.ts), so it rendered nowhere, but a credential claim that strong
  // should not sit in the repo waiting to be re-mounted.
  {
    slug: "rd-anjali-nair",
    name: "Anjali Nair",
    role: "rd",
    title: "Lead Registered Dietitian",
    credentials: ["RD (India)", "MSc Clinical Nutrition", "CDE"],
    bio: "Anjali designs our heart-healthy and diabetes-management protocols. She reviews every dish for sodium load, glycaemic index, and saturated-fat ratio, and signs off the daily macro targets used across the app.",
    yearsExperience: 12,
    signatureLine: "Every plate signed off for sodium, GI, and saturated-fat ratio.",
    lifestyles: ["heart-healthy", "diabetes-management"],
    initials: "AN",
    accent: "sage",
  },
  {
    slug: "rd-vikram-sethi",
    name: "Vikram Sethi",
    role: "rd",
    title: "Performance Dietitian",
    credentials: ["RD", "ISAK Level 2", "CISSN"],
    bio: "Vikram owns the fitness-gains protocol. He sets protein floors per category, designs our high-protein bowls, and writes the post-workout recovery notes you see on dishes flagged for muscle-gain goals.",
    yearsExperience: 9,
    signatureLine: "Protein floors, recovery windows, and zero hidden carbs.",
    lifestyles: ["fitness-gains"],
    initials: "VS",
    accent: "blue",
  },
  {
    slug: "rd-kavya-menon",
    name: "Kavya Menon",
    role: "rd",
    title: "Family & Gut-Health Dietitian",
    credentials: ["RD", "MSc Nutrition & Dietetics", "Monash FODMAP-trained"],
    bio: "Kavya curates our junior-explorers and silver-vitality lines. She reviews every kid-friendly dish for hidden sugar, fibre adequacy, and digestibility, and signs off on the gentle-textured options used by our older guests.",
    yearsExperience: 8,
    signatureLine: "Gentle on the gut, friendly on the palate, honest on the label.",
    lifestyles: ["junior-explorers", "silver-vitality"],
    initials: "KM",
    accent: "sage",
  },
];

export function getTeamMemberBySlug(slug: string): TeamMember | undefined {
  return TEAM.find((m) => m.slug === slug);
}

export function getChefForDish(dish: DishData): TeamMember | undefined {
  return TEAM.find((m) => m.role === "chef" && m.kitchens?.includes(dish.kitchen));
}

export function getRdForDish(dish: DishData): TeamMember | undefined {
  const sugarNum = parseFloat(dish.sugarPerServing) || 0;
  if (dish.macros.protein >= 22) {
    return TEAM.find((m) => m.slug === "rd-vikram-sethi");
  }
  if (dish.glycaemicIndex === "low" && sugarNum <= 10 && dish.macros.fat <= 18) {
    return TEAM.find((m) => m.slug === "rd-anjali-nair");
  }
  return TEAM.find((m) => m.slug === "rd-kavya-menon");
}

/**
 * `catalog` defaults to the static build-time seed (its isAvailable is
 * always true); pass the live catalog from `useMenuCatalog()` whenever one
 * is in scope so a dish pulled from the menu never keeps showing up as
 * "owned" on a public chef/RD profile page.
 */
export function getOwnedDishesForMember(member: TeamMember, catalog: DishData[] = DISHES): DishData[] {
  if (member.role === "chef") {
    return catalog.filter(
      (d) => d.isAvailable && member.kitchens?.includes(d.kitchen),
    ).slice(0, 8);
  }
  return catalog.filter((d) => {
    if (!d.isAvailable) return false;
    const matched = getRdForDish(d);
    return matched?.slug === member.slug;
  }).slice(0, 8);
}

export const ACCENT_CLASSES: Record<TeamMember["accent"], { ring: string; text: string; bg: string; chip: string }> = {
  gold: {
    ring: "ring-nn-primary/30",
    text: "text-nn-primary",
    bg: "bg-nn-primary/10",
    chip: "bg-nn-primary/15 text-nn-primary border-nn-primary/30",
  },
  sage: {
    ring: "ring-clinical-sage/30",
    text: "text-clinical-sage",
    bg: "bg-clinical-sage/10",
    chip: "bg-clinical-sage/15 text-clinical-sage border-clinical-sage/30",
  },
  blue: {
    ring: "ring-nn-tertiary/30",
    text: "text-nn-tertiary",
    bg: "bg-nn-tertiary/10",
    chip: "bg-nn-tertiary/15 text-nn-tertiary border-nn-tertiary/30",
  },
};
