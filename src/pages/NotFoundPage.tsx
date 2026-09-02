import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Compass } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-100">
            <Compass className="h-7 w-7 text-surface-400" />
          </span>
        </div>
        <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-2">404</p>
        <h1 className="text-2xl font-semibold text-surface-900 mb-2">Page not found</h1>
        <p className="text-sm text-surface-500 mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/">
          <Button>Back to Overview</Button>
        </Link>
      </div>
    </div>
  )
}
