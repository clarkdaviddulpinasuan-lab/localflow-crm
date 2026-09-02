import { isDemoMode, supabase } from '@/lib/supabase'
import type { PaginatedResponse } from '@/types'

export type DataSource = 'demo' | 'supabase'

export function dataSource(): DataSource {
  return isDemoMode() ? 'demo' : 'supabase'
}

export function isDemo(): boolean {
  return dataSource() === 'demo'
}

// Build a PaginatedResponse from an already-sliced array + total count
export function paginate<T>(rows: T[], total: number, page = 1, perPage = 50): PaginatedResponse<T> {
  return {
    data: rows,
    total,
    page,
    per_page: perPage,
    total_pages: Math.max(1, Math.ceil(total / perPage)),
  }
}

// Extract a clean error message from a Supabase error
export function messageFromError(error: { message?: string } | null, fallback: string): string {
  if (error?.message) return error.message
  return fallback
}

// Throw a consistent error for a missing record
export function notFound(resource: string): never {
  throw new Error(`${resource} not found`)
}

// Resolve the current user's business id from the database. Relies on the
// authenticated session and the profiles row (created by the signup trigger).
// Throws if the user isn't fully provisioned (no business) so callers can
// surface a clear message instead of inserting a bad row.
export async function getCurrentBusinessId(): Promise<string> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData?.user?.id
  if (!userId) {
    throw new Error('You must be signed in to do that.')
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(messageFromError(error, 'Unable to load your workspace.'))
  }
  if (!data?.business_id) {
    throw new Error(
      'Your account is not fully set up yet. Please sign out and sign in again, or contact support.'
    )
  }
  return data.business_id as string
}
