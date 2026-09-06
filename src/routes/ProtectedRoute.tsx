import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { AppLayout } from '@/layouts/AppLayout'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'

interface ProtectedRouteProps {
  children: ReactNode
}

function AccessRevokedScreen() {
  const { signOut } = useAuth()
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-surface-900">Access revoked</h1>
        <p className="text-sm text-surface-500 mt-2">
          Your account is no longer part of this business. If you think this is a
          mistake, contact the business owner.
        </p>
        <Button className="mt-6" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </div>
  )
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, accessRevoked } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (accessRevoked) {
    return <AccessRevokedScreen />
  }

  return <AppLayout>{children}</AppLayout>
}