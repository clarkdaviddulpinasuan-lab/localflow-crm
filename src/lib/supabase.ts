import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Fallbacks keep module load safe when Vite env vars are absent (e.g. CI runs
// in demo mode where this client is never used). Real credentials are required
// in production from VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.local'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key'

// Supabase client. Domain type safety is enforced at the service layer via the
// models in src/types — the client itself runs against the anon role which
// respects Row Level Security. In demo mode (VITE_DEMO_MODE=true) reads and
// writes go through the local demo store instead; production flows use this
// client. The full relational schema lives in supabase/migrations/001_init.sql
// and the generated types are documented in src/types/database.ts.
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey)

export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === 'true'
}
