import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { AppLayout } from '@/layouts/AppLayout'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, isDemo } = useAuth()
  const location = useLocation()

  if (!isDemo && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="h-8 w-8 rounded-full border-2 border-surface-200 border-t-primary-600 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <AppLayout>{children}</AppLayout>
}
