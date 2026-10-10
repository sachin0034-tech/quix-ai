import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

/** Service-role Supabase client, or null when not configured. Server only. */
export function db(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  client = url && key && url !== "your_supabase_project_url" ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return client;
}

/**
 * Best-effort write: the app must keep working before the migration in supabase/migrations has
 * been applied, so storage failures are logged and swallowed.
 */
export async function safeInsert(table: string, row: Record<string, unknown>): Promise<boolean> {
  const c = db();
  if (!c) return false;
  const { error } = await c.from(table).insert(row);
  if (error) {
    console.warn(`[db] insert into ${table} failed: ${error.message}`);
    return false;
  }
  return true;
}
