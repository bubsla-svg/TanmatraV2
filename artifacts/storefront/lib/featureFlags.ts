/**
 * Phase 2 - Feature Flags
 * Static boolean flags for progressive rollout.
 */

export const FeatureFlags = {
  // Enabled Phase 2 features
  ENABLE_B2B_LAYOUT: true,
  ENABLE_WEARABLES: false,
  ENABLE_CLINICAL_COACHING: false,
  
  // A/B Testing flags
  NEW_CHECKOUT_FLOW: false,
  
  // Overrides
  FORCE_THEME: null as "light" | "dark" | null,
};
