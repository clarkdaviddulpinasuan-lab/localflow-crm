import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'

// Real credentials are required in production from VITE_SUPABASE_URL /
// VITE_SUPABASE_ANON_KEY.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.'
  )
}

// Supabase client. Domain type safety is enforced at the service layer via the
// models in src/types — the client itself runs against the anon role which
// respects Row Level Security. The full relational schema lives in
// supabase/migrations/001_init.sql and the generated types are documented in
// src/types/database.ts.
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithTimeout(15_000) },
})
