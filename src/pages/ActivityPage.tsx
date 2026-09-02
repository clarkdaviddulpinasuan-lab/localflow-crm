import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { listActivities } from '@/services/activityService'
import type { Activity } from '@/types'

const entityColors: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  customer: 'primary',
  booking: 'info',
  order: 'success',
  task: 'warning',
  lead: 'info',
  notification: 'default',
}

export function ActivityPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    listActivities(50).then(setActivities)
  }, [])

  const filtered = filter === 'all' ? activities : activities.filter((a) => a.entity_type === filter)
  const entityTypes = Array.from(new Set(activities.map((a) => a.entity_type)))

  return (
    <div className="space-y-6">
      <PageHeader title="Activity Log" description="A chronological record of all actions across your workspace." />

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${filter === 'all' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-surface-600 border-surface-200 hover:bg-surface-50'}`}
        >
          All
        </button>
        {entityTypes.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1.5 text-sm rounded-full border capitalize transition-colors ${filter === t ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-surface-600 border-surface-200 hover:bg-surface-50'}`}
          >
            {t.replace('_', ' ')}
          </button>
        ))}
      </div>

      <Card>
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-surface-500">No activity recorded yet.</div>
        ) : (
          <ol className="relative border-l border-surface-200 ml-3 space-y-5">
            {filtered.map((a) => (
              <li key={a.id} className="ml-5">
                <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-primary-500" />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={entityColors[a.entity_type] ?? 'default'}>{a.entity_type.replace('_', ' ')}</Badge>
                  <span className="text-xs text-surface-400">{new Date(a.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-surface-700 mt-1">{a.description}</p>
                <p className="text-xs text-surface-400 mt-0.5">Action: {a.action}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}
