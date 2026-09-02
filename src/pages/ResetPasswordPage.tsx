import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Waves } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { isDemoMode, supabase } from '@/lib/supabase'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (isDemoMode()) {
      setError('Password reset is available once Supabase is connected.')
      return
    }

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setSuccess(true)
      setTimeout(() => navigate('/login', { replace: true }), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password. Please try again.')
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
          <h1 className="text-2xl font-semibold tracking-tight text-surface-900">Set a new password</h1>
          <p className="text-sm text-surface-500 mt-1">Choose a new password for your account</p>
        </div>

        {success ? (
          <div className="bg-white rounded-xl border border-success-200 shadow-sm p-6 space-y-4 text-center">
            <p className="text-sm font-medium text-success-700">Password updated successfully!</p>
            <p className="text-sm text-surface-500">Redirecting you to sign in…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-surface-200 shadow-sm p-6 space-y-4">
            <Input
              id="password"
              label="New password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              hint="At least 8 characters"
            />
            <Input
              id="confirm"
              label="Confirm new password"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
            />

            {error && (
              <p className="text-sm text-danger-600 bg-danger-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <Button type="submit" loading={loading} className="w-full">
              Update password
            </Button>

            <p className="text-center text-sm text-surface-500">
              <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
