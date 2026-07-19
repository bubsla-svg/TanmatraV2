// Shared shape for editing a subscription member (eater) — used by the
// Subscribe flow (creating a subscription's initial member list) and by the
// Subscriptions dashboard (adding/removing members on an existing plan) so
// the two don't diverge on field shape, defaults, or the allergen/lifestyle
// option lists.

export type MemberDiet = "any" | "veg" | "nonveg";
export type MemberSpiceLevel = "mild" | "medium" | "hot";

export interface MemberDraft {
  name: string;
  diet: MemberDiet;
  allergens: string[];
  lifestyle: string;
  spiceLevel: MemberSpiceLevel;
}

export const blankMember = (): MemberDraft => ({
  name: "",
  diet: "any",
  allergens: [],
  lifestyle: "",
  spiceLevel: "medium",
});

export const COMMON_ALLERGENS = ["dairy", "gluten", "nuts", "soy", "eggs", "shellfish"];

export const LIFESTYLE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "No preference" },
  { value: "heart-healthy", label: "Heart-Healthy" },
  { value: "fitness-gains", label: "Fitness Gains" },
  { value: "diabetes-management", label: "Diabetes Mgmt" },
  { value: "junior-explorers", label: "Junior Explorer" },
  { value: "silver-vitality", label: "Silver Vitality" },
];
