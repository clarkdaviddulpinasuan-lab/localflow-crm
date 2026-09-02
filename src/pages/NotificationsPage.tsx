import { useEffect, useState } from 'react'
import { CheckCheck } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { listNotifications, markRead, markAllRead, unreadCount } from '@/services/notificationService'
import type { Notification } from '@/types'

const typeStyles: Record<Notification['type'], 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  booking: 'primary',
  task: 'warning',
  payment: 'success',
  lead: 'info',
  customer: 'info',
  system: 'default',
}

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all([listNotifications(50), unreadCount()]).then(([items, count]) => {
      if (!active) return
      setNotifications(items)
      setUnread(count)
    })
    return () => {
      active = false
    }
  }, [])

  async function toggleRead(n: Notification) {
    await markRead(n.id)
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
    setUnread((u) => Math.max(0, u - 1))
  }

  async function readAll() {
    await markAllRead()
    setNotifications((prev) => prev.map((x) => ({ ...x, read: true })))
    setUnread(0)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={unread > 0 ? `You have ${unread} unread notification${unread === 1 ? '' : 's'}.` : 'You are all caught up.'}
        actions={
          <Button variant="secondary" icon={<CheckCheck className="h-4 w-4" />} onClick={readAll} disabled={unread === 0}>
            Mark all read
          </Button>
        }
      />

      <Card>
        {notifications.length === 0 ? (
          <div className="py-12 text-center text-sm text-surface-500">No notifications yet.</div>
        ) : (
          <ul className="divide-y divide-surface-100">
            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => toggleRead(n)}
                  className={cn(
                    'w-full text-left px-4 py-3.5 flex items-start gap-3 hover:bg-surface-50 transition-colors',
                    !n.read && 'bg-primary-50/40'
                  )}
                >
                  <span className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', n.read ? 'bg-surface-200' : 'bg-primary-500')} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn('text-sm text-surface-900', !n.read && 'font-semibold')}>{n.title}</p>
                      <Badge variant={typeStyles[n.type]}>{n.type}</Badge>
                    </div>
                    <p className="text-sm text-surface-600 mt-0.5">{n.message}</p>
                    <p className="text-xs text-surface-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
