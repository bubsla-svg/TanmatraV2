/**
 * SINGLE SOURCE OF TRUTH for operational policies, locked legal snippets, and tax disclosures.
 * Imported by all copy modules to ensure consistent messaging across the storefront.
 */
export const skipCutoffCopy =
  "Orders for tomorrow close at 10:00 PM tonight. Any changes made after cutoff apply to the following delivery." as const;

export const taxDisclosureCopy =
  "No platform fee. No surge. Prices include all taxes." as const;

export const creditExpiryCopy =
  "Unused meal credits expire 30 days after issuance." as const;

/**
 * [LOCKED] Cancellation Snippets — verbatim requirements per policy.
 */
export const cancellationSnippets = {
  beforeCutoff: "Cancel anytime before cutoff for a 100% refund to your original payment method.",
  afterCutoff: "Cancellations after 10:00 PM cutoff cannot be refunded as meal preparation has already begun.",
} as const;
