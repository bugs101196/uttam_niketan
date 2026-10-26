import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicSupabaseEnv, serviceRoleKey } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Service-role client. BYPASSES ROW LEVEL SECURITY.
 *
 * Only for operations RLS cannot express (creating auth users, resetting
 * passwords), and only after the caller has passed requireAdmin(). Always
 * scope queries to the admin's school explicitly.
 */
export function createAdminClient() {
  const { url } = publicSupabaseEnv();
  return createClient<Database>(url, serviceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
