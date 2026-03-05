import { supabaseAdmin } from "@/app/lib/supabaseServer";
import type { OrgFeature } from "@/lib/featureFlags";

export async function hasOrgFeature(orgId: string, featureKey: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("organization_features")
    .select("id")
    .eq("organization_id", orgId)
    .eq("feature_key", featureKey)
    .maybeSingle();
  return !!data;
}

export async function getOrgFeatureConfig(
  orgId: string,
  featureKey: string
): Promise<Record<string, unknown> | null> {
  const { data } = await supabaseAdmin
    .from("organization_features")
    .select("config")
    .eq("organization_id", orgId)
    .eq("feature_key", featureKey)
    .maybeSingle();
  return data?.config ?? null;
}

export async function getOrgFeatures(orgId: string): Promise<OrgFeature[]> {
  const { data } = await supabaseAdmin
    .from("organization_features")
    .select("feature_key, config, enabled_at")
    .eq("organization_id", orgId);
  return data ?? [];
}
