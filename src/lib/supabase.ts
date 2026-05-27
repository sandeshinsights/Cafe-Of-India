import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Client
 * 
 * Connects to the Supabase database.
 * Uses the anon key (safe for browser-side code).
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);