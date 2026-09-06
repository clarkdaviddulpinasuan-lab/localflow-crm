import { useEffect, useState } from 'react'
import { WifiOff, X } from 'lucide-react'
import { useOnlineStatus } from '@/lib/useOnlineStatus'

export function OfflineBanner() {
  const online = useOnlineStatus()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!online) setDismissed(false)
  }, [online])

  if (online || dismissed) return null

  return (
    <div className="fixed inset-x-0 top-0 z-[70] flex justify-center px-4 pt-3">
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 rounded-lg border border-warning-200 bg-warning-50 px-4 py-2 text-sm text-warning-700 shadow-soft"
      >
        <WifiOff className="h-4 w-4 shrink-0" />
        <p className="font-medium">You're offline — changes won't save until you're back online.</p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss offline notice"
          className="p-1 -m-1 rounded-md text-warning-700 hover:bg-warning-100 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}