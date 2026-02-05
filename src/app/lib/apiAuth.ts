import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

/**
 * Shared authentication helpers for API routes.
 * Extracted to avoid duplicating auth logic across sandbox/community/admin routes.
 */

export async function getUser(authHeader: string | null) {
  if (!authHeader || !supabaseAdmin) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  return user;
}

export async function isAdmin(authHeader: string | null): Promise<boolean> {
  const user = await getUser(authHeader);
  if (!user) return false;

  const { data } = await supabaseAdmin!
    .from("admins")
    .select("id")
    .eq("user_id", user.id)
    .single();

  return !!data;
}

export async function isUserAdmin(userId: string): Promise<boolean> {
  if (!supabaseAdmin) return false;

  const { data } = await supabaseAdmin
    .from("admins")
    .select("id")
    .eq("user_id", userId)
    .single();

  return !!data;
}

export async function canAccessProduct(user: any, productId: string): Promise<boolean> {
  if (!user || !supabaseAdmin) return false;

  // Admins can access all products
  const { data: admin } = await supabaseAdmin
    .from("admins")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (admin) return true;

  // Check if user is assigned to this specific product
  const { data: productUser } = await supabaseAdmin
    .from("product_users")
    .select("product_id")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .single();

  if (productUser) return true;

  // Allow any authenticated user to access active products (viewer access)
  // This matches the /api/products behavior which returns all active products to all users
  const { data: activeProduct } = await supabaseAdmin
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("is_active", true)
    .single();

  return !!activeProduct;
}

export async function getProductId(request: NextRequest, authHeader: string | null): Promise<string | null> {
  const productIdHeader = request.headers.get("X-Product-Id");
  if (productIdHeader) return productIdHeader;

  if (!authHeader || !supabaseAdmin) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return null;

  const { data: productUser } = await supabaseAdmin
    .from("product_users")
    .select("product_id")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .limit(1)
    .single();

  return productUser?.product_id || null;
}

/**
 * Get the display name and avatar for a user from the profiles table.
 */
export async function getUserProfile(userId: string): Promise<{ name: string; avatarUrl: string | null } | null> {
  if (!supabaseAdmin) return null;

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("first_name, last_name, profile_picture_url, company_email")
    .eq("user_id", userId)
    .single();

  if (!data) return null;

  const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || data.company_email || "Unknown";
  return { name, avatarUrl: data.profile_picture_url };
}
