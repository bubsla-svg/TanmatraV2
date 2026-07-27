import type { CopyLeaf } from "./types";

export const premiumCopy = {
  header: {
    title: "Tanmatra Premium",
    subtitle: "Unlocking advanced clinical diagnostics, priority consultations, and macro customization.",
  },
  // [OWNER] Gated perk list: null until entitlement API verification
  ownerPerksLeaf: null as CopyLeaf,
  pricingNote: "Billed annually or monthly. Cancel anytime.",
} as const;
