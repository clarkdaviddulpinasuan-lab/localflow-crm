import { supabase } from '@/lib/supabase'
import { withRetry } from '@/lib/withRetry'
import type { PaginatedResponse } from '@/types'

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

// Resolve the current user's active business. The database answers from the
// user_current_business preference (migration 018) and falls back to a single
// membership, so resolution can never drift from RLS. Throws if the user isn't
// fully provisioned (no business) so callers can surface a clear message
// instead of inserting a bad row.
export async function getCurrentBusinessId(): Promise<string> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData?.user?.id
  if (!userId) {
    throw new Error('You must be signed in to do that.')
  }

  const { data, error } = await withRetry(() => supabase.rpc('get_current_business'))

  if (error) {
    throw new Error(messageFromError(error, 'Unable to load your workspace.'))
  }
  if (!data) {
    throw new Error(
      'Your account is not fully set up yet. Please sign out and sign in again, or contact support.'
    )
  }
  return data as string
}
