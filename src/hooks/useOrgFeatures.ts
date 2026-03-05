"use client";

import { useAuth } from "@/context/AuthContext";

export function useOrgFeatures() {
  const { orgFeatures } = useAuth();

  const hasFeature = (key: string): boolean =>
    orgFeatures.some((f) => f.feature_key === key);

  const getFeatureConfig = (key: string): Record<string, unknown> | null =>
    orgFeatures.find((f) => f.feature_key === key)?.config ?? null;

  return { orgFeatures, hasFeature, getFeatureConfig };
}
