import { useEffect, useState } from 'react'
import { Save, Building2, Shield, User } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Field'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { getProfile, updateProfile, ROLE_LABELS } from '@/services/settingsService'
import type { Profile } from '@/types'

const ROLE_BADGE: Record<Profile['role'], 'primary' | 'success' | 'default'> = {
  owner: 'primary',
  manager: 'success',
  staff: 'default',
}

const ROLE_DESC: Record<Profile['role'], string> = {
  owner: 'Has full access to manage your business.',
  manager: 'Can manage most business operations.',
  staff: 'Has limited access for day-to-day work.',
}

export function ProfilePage() {
  const { business } = useAuth()
  const [p, setP] = useState<Profile | null>(null)
  const [confirmed, setConfirmed] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getProfile()
      .then(setP)
      .catch(() => setError('Unable to load your profile. Please try again.'))
  }, [])

  useEffect(() => {
    let active = true
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active) setConfirmed(!!data.user?.email_confirmed_at)
      })
      .catch(() => {
        if (active) setConfirmed(null)
      })
    return () => {
      active = false
    }
  }, [])

  async function handleSave() {
    if (!p) return
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const updated = await updateProfile(p)
      setP(updated)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save your profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!p) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Profile" description="View and manage your account information." />
        <Card>
          <div className="py-10 text-center text-sm text-surface-500">
            {error ? error : 'Loading your profile...'}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        description="View and manage your account information."
        actions={
          <Button icon={<Save className="h-4 w-4" />} onClick={handleSave} loading={saving}>
            Save Profile
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col items-center text-center">
              <Avatar firstName={p.first_name} lastName={p.last_name} size="lg" />
              <h2 className="mt-3 text-lg font-semibold text-surface-900">
                {p.first_name} {p.last_name}
              </h2>
              <p className="text-sm text-surface-500">{p.email}</p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <Badge variant={ROLE_BADGE[p.role]}>{ROLE_LABELS[p.role]}</Badge>
                {confirmed === true && <Badge variant="success">Account active</Badge>}
                {confirmed === false && <Badge variant="warning">Not confirmed</Badge>}
              </div>
            </div>
            <p className="mt-4 text-xs text-surface-500 text-center">{ROLE_DESC[p.role]}</p>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-surface-900 mb-3">Workspace</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                  <Building2 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-surface-500">Business</p>
                  <p className="font-medium text-surface-900 truncate">{business?.name ?? '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                  <Shield className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-surface-500">Role</p>
                  <p className="font-medium text-surface-900">{ROLE_LABELS[p.role]}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                  <User className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-surface-500">Member since</p>
                  <p className="font-medium text-surface-900">
                    {new Date(p.created_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <h3 className="text-lg font-semibold text-surface-900 mb-5">Personal Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Input
                label="First name"
                value={p.first_name}
                onChange={(e) => setP({ ...p, first_name: e.target.value })}
              />
              <Input
                label="Last name"
                value={p.last_name}
                onChange={(e) => setP({ ...p, last_name: e.target.value })}
              />
              <div className="sm:col-span-2">
                <Input
                  label="Email"
                  type="email"
                  value={p.email}
                  onChange={(e) => setP({ ...p, email: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  label="Phone"
                  value={p.phone ?? ''}
                  onChange={(e) => setP({ ...p, phone: e.target.value })}
                />
              </div>
            </div>

            {saved && (
              <p className="mt-5 text-sm font-medium text-success-700 bg-success-50 rounded-lg px-3 py-2">
                Profile saved successfully.
              </p>
            )}
            {error && (
              <p className="mt-5 text-sm font-medium text-danger-700 bg-danger-50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="mt-6 pt-5 border-t border-surface-200 flex justify-end">
              <Button icon={<Save className="h-4 w-4" />} onClick={handleSave} loading={saving}>
                Save Profile
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
