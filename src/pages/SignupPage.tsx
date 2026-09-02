import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Waves } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { isDemoMode, supabase } from '@/lib/supabase'

export function SignupPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (isDemoMode()) {
      setError('Account creation is enabled once Supabase is connected.')
      return
    }

    setLoading(true)
    try {
      const parts = name.trim().split(/\s+/)
      const first_name = parts[0] ?? ''
      const last_name = parts.slice(1).join(' ') || ''

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { first_name, last_name },
          emailRedirectTo: window.location.origin,
        },
      })
      if (error) throw error

      if (data.session) {
        navigate('/', { replace: true })
      } else {
        setError(
          'Account created! Please check your email to confirm your account before signing in.'
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account. Please try again.')
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
          <h1 className="text-2xl font-semibold tracking-tight text-surface-900">Create your account</h1>
          <p className="text-sm text-surface-500 mt-1">Start managing your business with LocalFlow</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-surface-200 shadow-sm p-6 space-y-4"
        >
          <Input
            id="name"
            label="Full name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
          <Input
            id="email"
            label="Work email"
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
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
          <Input
            id="confirm"
            label="Confirm password"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter your password"
          />

          {error && <p className="text-sm text-danger-600 bg-danger-50 rounded-lg px-3 py-2">{error}</p>}

          <Button type="submit" loading={loading} className="w-full">
            Create account
          </Button>
        </form>

        <p className="text-center text-sm text-surface-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
