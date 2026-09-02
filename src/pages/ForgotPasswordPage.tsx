import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Waves } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { isDemoMode, supabase } from '@/lib/supabase'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (isDemoMode()) {
      setError('Password reset is available once Supabase is connected.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send reset link. Please try again.')
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
          <h1 className="text-2xl font-semibold tracking-tight text-surface-900">Reset password</h1>
          <p className="text-sm text-surface-500 mt-1">We'll email you a link to reset your password</p>
        </div>

        {sent ? (
          <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-6 space-y-4">
            <p className="text-sm text-surface-700">
              If an account exists for <span className="font-medium">{email}</span>, a password reset
              link has been sent. Check your inbox and follow the instructions.
            </p>
            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center h-9 px-4 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
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

            {error && (
              <p className="text-sm text-danger-600 bg-danger-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <Button type="submit" loading={loading} className="w-full">
              Send reset link
            </Button>

            <p className="text-center text-sm text-surface-500">
              Remembered it?{' '}
              <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
