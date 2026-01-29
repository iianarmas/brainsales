import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Server-side client with admin privileges
// IMPORTANT: Only use in API routes, never expose to client
function createAdminClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing Supabase environment variables. Please check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export const supabaseAdmin = createAdminClient();