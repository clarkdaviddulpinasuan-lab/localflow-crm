import { getStore, updateStore, nextId } from '@/services/demoStore'
import { isDemoMode, supabase } from '@/lib/supabase'
import { getCurrentBusinessId, messageFromError } from '@/lib/dataClient'
import type { Notification } from '@/types'

export async function listNotifications(limit = 50): Promise<Notification[]> {
  if (isDemoMode()) {
    return getStore()
      .notifications.slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
  }

  const businessId = await getCurrentBusinessId()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(messageFromError(error, 'Unable to load notifications.'))
  return (data ?? []) as Notification[]
}

export async function unreadCount(): Promise<number> {
  if (isDemoMode()) return getStore().notifications.filter((n) => !n.read).length

  const businessId = await getCurrentBusinessId()
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('read', false)
  if (error) throw new Error(messageFromError(error, 'Unable to count notifications.'))
  return count ?? 0
}

export async function markAllRead(): Promise<void> {
  if (isDemoMode()) {
    updateStore((s) => {
      s.notifications = s.notifications.map((n) => ({ ...n, read: true }))
    })
    return
  }

  const businessId = await getCurrentBusinessId()
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('business_id', businessId)
    .eq('read', false)
  if (error) throw new Error(messageFromError(error, 'Unable to update notifications.'))
}

export async function markRead(id: string): Promise<void> {
  if (isDemoMode()) {
    updateStore((s) => {
      s.notifications = s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
    })
    return
  }

  const businessId = await getCurrentBusinessId()
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('business_id', businessId)
    .eq('id', id)
  if (error) throw new Error(messageFromError(error, 'Unable to update notification.'))
}

// Demo-store helper. The public `notify()` below persists notifications in both
// demo and Supabase modes and is the single call sites should use.
export function createNotification(
  input: Omit<Notification, 'id' | 'read' | 'created_at'>
): Notification {
  const notification: Notification = {
    id: nextId('notif'),
    ...input,
    read: false,
    created_at: new Date().toISOString(),
  }
  updateStore((s) => {
    s.notifications.unshift(notification)
  })
  return notification
}

// Public helper used across the app to record notifications even in prod mode.
export interface NotificationInput {
  user_id: string
  business_id: string
  title: string
  message: string
  type: Notification['type']
  entity_type?: string | null
  entity_id?: string | null
}

export async function notify(data: NotificationInput): Promise<void> {
  if (isDemoMode()) {
    createNotification(data)
    return
  }
  await supabase.from('notifications').insert({
    user_id: data.user_id,
    business_id: data.business_id,
    title: data.title,
    message: data.message,
    type: data.type,
    entity_type: data.entity_type ?? null,
    entity_id: data.entity_id ?? null,
  })
}