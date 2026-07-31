import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client for API route handlers.
 *
 * Prefers SUPABASE_SERVICE_ROLE_KEY, which bypasses Row Level Security — that's
 * what makes the API routes work before Supabase Auth is wired up. Falls back to
 * the anon key, at which point RLS applies and the policies in
 * supabase/schema.sql will (correctly) reject unauthenticated writes.
 *
 * This module must never be imported from a client component. Everything under
 * app/api/ is server-only, which is why it lives here and not in
 * lib/supabaseClient.js.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cached = null;

export function getSupabaseServerClient() {
  if (cached) return cached;

  const key = serviceRoleKey || anonKey;
  if (!supabaseUrl || !key) {
    throw new Error(
      "Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and either " +
        "SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    );
  }

  cached = createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** True when we're running with RLS bypassed. Handy for debug responses. */
export const usingServiceRole = Boolean(serviceRoleKey);
