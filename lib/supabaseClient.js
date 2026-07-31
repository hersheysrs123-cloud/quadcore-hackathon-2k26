import { createClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client.
 *
 * Uses the anon key, so every query runs through Row Level Security as the
 * signed-in user. Import this from components — never from an API route
 * (routes use lib/supabaseServer.js instead).
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copy .env.example to .env.local and fill them in.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
