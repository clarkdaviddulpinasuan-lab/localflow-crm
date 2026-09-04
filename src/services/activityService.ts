import { messageFromError } from '@/lib/dataClient'
import { getProfile } from '@/services/settingsService'
import { supabase } from '@/lib/supabase'
import type { Activity } from '@/types'

export type LogActivityInput = {
  action: string
  entity_type: string
  entity_id: string
  description: string
  metadata?: Record<string, unknown>
}

// Record an activity entry in the audit trail. Resolves the current user's
// profile (for their business + profile id) so the insert satisfies RLS and the
// foreign keys on the activities table (user_id -> profiles.id).
export async function logActivity(input: LogActivityInput): Promise<void> {
  const profile = await getProfile()
  const { error } = await supabase.from('activities').insert({
    business_id: profile.business_id,
    user_id: profile.id,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    description: input.description,
    metadata: input.metadata ?? null,
  })
  if (error) throw new Error(messageFromError(error, 'Failed to record activity'))
}

export async function listActivities(limit = 20): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(messageFromError(error, 'Failed to load activities'))
  return (data as Activity[]) ?? []
}

export async function getCustomerActivities(customerId: string, limit = 20): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('entity_id', customerId)
    .neq('entity_type', 'customer_note')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(messageFromError(error, 'Failed to load activities'))
  return (data as Activity[]) ?? []
}
