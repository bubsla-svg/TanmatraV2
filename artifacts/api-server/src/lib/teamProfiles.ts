import { eq } from "drizzle-orm";
import { db, teamProfilesTable, type TeamProfile } from "@workspace/db";
import { rdIdentity } from "./rdIdentity";

export type TeamProfileRow = TeamProfile;

const SEED: Array<typeof teamProfilesTable.$inferInsert> = [
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
  // The RD entries take their name, title, credentials and years from
  // rdIdentity.ts — the same values `/rd/directory` serves. They used to be
  // spelled out here a second time and disagreed with that record on every one
  // of those fields; see rdIdentity.ts for the conflict and which side won.
  // The bio and signature line stay local: they describe what this person does
  // for Tanmatra, which is this surface's job to say.
  {
    ...rdIdentity("rd-anjali-nair"),
    role: "rd",
    bio: "Anjali designs our heart-healthy and diabetes-management protocols. She reviews every dish for sodium load, glycaemic index, and saturated-fat ratio, and signs off the daily macro targets used across the app.",
    signatureLine: "Every plate signed off for sodium, GI, and saturated-fat ratio.",
    lifestyles: ["heart-healthy", "diabetes-management"],
    initials: "AN",
    accent: "sage",
  },
  {
    ...rdIdentity("rd-vikram-sethi"),
    role: "rd",
    bio: "Vikram owns the fitness-gains protocol. He sets protein floors per category, designs our high-protein bowls, and writes the post-workout recovery notes you see on dishes flagged for muscle-gain goals.",
    signatureLine: "Protein floors, recovery windows, and zero hidden carbs.",
    lifestyles: ["fitness-gains"],
    initials: "VS",
    accent: "blue",
  },
  {
    ...rdIdentity("rd-kavya-menon"),
    role: "rd",
    bio: "Kavya curates our junior-explorers and silver-vitality lines. She reviews every kid-friendly dish for hidden sugar, fibre adequacy, and digestibility, and signs off on the gentle-textured options used by our older guests.",
    signatureLine: "Gentle on the gut, friendly on the palate, honest on the label.",
    lifestyles: ["junior-explorers", "silver-vitality"],
    initials: "KM",
    accent: "sage",
  },
];

let seeded = false;

/**
 * UPSERT, not insert-if-absent.
 *
 * This used to be `onConflictDoNothing`, which meant that once a row existed
 * the SEED above could never correct it — so fixing the RD credentials in code
 * would have changed nothing on any environment that had already booted once,
 * and `/team` would have gone on serving "Dr. Anjali Nair, PhD AIIMS, 17 years"
 * against a directory saying MSc and 12. A reconciliation that cannot reach the
 * data it is reconciling is not one.
 *
 * Safe because SEED is the only writer of these columns: nothing in the repo
 * updates team_profiles (orders.ts and the /team routes only read it), so there
 * is no hand-edited value for this to clobber. These rows are code-owned.
 *
 * The set list is deliberate rather than a blanket overwrite: it covers the
 * display facts, and leaves `initials`, `accent`, `kitchens`, `lifestyles` and
 * `ownedDishSlugs` alone — `ownedDishSlugs` in particular is not in SEED at all
 * and a blanket write would blank it.
 */
export async function ensureTeamProfileSeeds(): Promise<void> {
  if (seeded) return;
  for (const p of SEED) {
    await db
      .insert(teamProfilesTable)
      .values(p)
      .onConflictDoUpdate({
        target: teamProfilesTable.slug,
        set: {
          name: p.name,
          title: p.title,
          bio: p.bio ?? "",
          yearsExperience: p.yearsExperience ?? 0,
          credentials: p.credentials ?? [],
        },
      });
  }
  seeded = true;
}

export async function listTeamProfiles(role?: string): Promise<TeamProfileRow[]> {
  await ensureTeamProfileSeeds();
  if (role === "chef" || role === "rd") {
    return db.select().from(teamProfilesTable).where(eq(teamProfilesTable.role, role));
  }
  return db.select().from(teamProfilesTable);
}

export async function getTeamProfileBySlug(slug: string): Promise<TeamProfileRow | undefined> {
  await ensureTeamProfileSeeds();
  const rows = await db
    .select()
    .from(teamProfilesTable)
    .where(eq(teamProfilesTable.slug, slug))
    .limit(1);
  return rows[0];
}
