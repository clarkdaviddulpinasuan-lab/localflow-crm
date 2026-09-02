import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Waves } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { useAuth } from '@/contexts/AuthContext'
import { isDemoMode } from '@/lib/supabase'

interface LocationState {
  from?: { pathname?: string }
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const from = (location.state as LocationState)?.from?.pathname ?? '/'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 mb-4">
            <Waves className="h-7 w-7 text-white" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-surface-900">LocalFlow CRM</h1>
          <p className="text-sm text-surface-500 mt-1">Sign in to your workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-surface-200 shadow-sm p-6 space-y-4">
          <Input
            id="email"
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@business.com"
          />
          <Input
            id="password"
            label="Password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          <div className="flex items-center justify-between">
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-primary-600 hover:text-primary-700"
            >
              Forgot password?
            </Link>
          </div>

          {error && (
            <p className="text-sm text-danger-600 bg-danger-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <Button type="submit" loading={loading} className="w-full">
            Sign in
          </Button>
        </form>

        <p className="text-center text-sm text-surface-500 mt-6">
          Don't have an account?{' '}
          <Link to="/signup" className="font-medium text-primary-600 hover:text-primary-700">
            Create one
          </Link>
        </p>

        {isDemoMode() && (
          <div className="mt-6 text-center bg-info-50 border border-info-100 rounded-lg px-4 py-3">
            <p className="text-xs text-info-700">
              <span className="font-semibold">Demo mode is active.</span> Authentication will be
              enabled once Supabase is connected.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
