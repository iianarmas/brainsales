export const FEATURE_FLAGS = {
  AI_COMPANION: "ai_companion",
  ADVANCED_ANALYTICS: "advanced_analytics",
  CUSTOM_BRANDING: "custom_branding",
  EARLY_ACCESS: "early_access",
} as const;

export type FeatureKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

export interface OrgFeature {
  feature_key: string;
  config: Record<string, unknown>;
  enabled_at: string;
}
