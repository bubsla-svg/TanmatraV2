/**
 * Tanmatra Phase P0 Quarantine & Terminology Enforcer
 * 
 * Banned vocabulary check prevents multi-vendor aggregator language 
 * from reaching customer-facing surfaces.
 */

const BANNED_AGGREGATOR_TERMS = [
  "pick a restaurant",
  "compare providers",
  "all restaurants",
  "restaurant rating",
  "available providers",
  "choose a seller"
] as const;

const APPROVED_SOLE_OPERATOR_TERMS = [
  "choose your meal plan",
  "recommended for your goal",
  "meals in this plan",
  "build my plan",
  "other plans that may fit",
  "rd-reviewed",
  "tanmatra recommendation"
] as const;

export class VocabularySanitizer {
  /**
   * Asserts that a UI string does not contain banned aggregator terms.
   */
  static validate(text: string): { isValid: boolean; violation?: string } {
    const lower = text.toLowerCase();
    for (const banned of BANNED_AGGREGATOR_TERMS) {
      if (lower.includes(banned)) {
        return { isValid: false, violation: banned };
      }
    }
    return { isValid: true };
  }

  /**
   * Replaces common aggregator terms with approved sole-operator terms.
   */
  static sanitize(text: string): string {
    let sanitized = text;
    sanitized = sanitized.replace(/restaurant/gi, "Therapeutic Kitchen");
    sanitized = sanitized.replace(/provider/gi, "Meal Plan");
    sanitized = sanitized.replace(/seller/gi, "Tanmatra Specialist");
    return sanitized;
  }
}
