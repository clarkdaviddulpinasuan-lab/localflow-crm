import { getStore } from '@/services/demoStore'
import { isDemo, messageFromError } from '@/lib/dataClient'
import { supabase } from '@/lib/supabase'
import type { Activity } from '@/types'

export async function listActivities(limit = 20): Promise<Activity[]> {
  if (isDemo()) {
    return getStore()
      .activities.slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
  }
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(messageFromError(error, 'Failed to load activities'))
  return (data as Activity[]) ?? []
}

export async function getCustomerActivities(customerId: string, limit = 20): Promise<Activity[]> {
  if (isDemo()) {
    return getStore()
      .activities.filter((a) => a.entity_id === customerId && a.entity_type !== 'customer_note')
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
  }
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
