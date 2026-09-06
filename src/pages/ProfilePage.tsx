import { useEffect, useRef, useState } from 'react'
import {
  Save,
  Building2,
  Shield,
  User,
  Camera,
  CheckCircle2,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input, Select } from '@/components/ui/Field'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/contexts/AuthContext'
import { useBusiness } from '@/contexts/BusinessContext'
import { supabase } from '@/lib/supabase'
import {
  getProfile,
  updateProfile,
  getBusiness,
  updateBusiness,
  ROLE_LABELS,
} from '@/services/settingsService'
import { can } from '@/utils/permissions'
import { cn } from '@/lib/cn'
import type {
  Business,
  BusinessType,
  Profile,
} from '@/types'

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

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

const typeOptions: { value: BusinessType; label: string }[] = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'resort', label: 'Resort' },
  { value: 'guesthouse', label: 'Guesthouse' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'sari_sari', label: 'Sari-Sari Store' },
  { value: 'retail', label: 'Retail' },
  { value: 'service', label: 'Service Business' },
  { value: 'other', label: 'Other' },
]

const currencyOptions = [
  { value: 'PHP', label: '₱ Philippine Peso (PHP)' },
  { value: 'USD', label: '$ US Dollar (USD)' },
  { value: 'EUR', label: '€ Euro (EUR)' },
  { value: 'GBP', label: '£ British Pound (GBP)' },
  { value: 'SGD', label: 'S$ Singapore Dollar (SGD)' },
  { value: 'AUD', label: 'A$ Australian Dollar (AUD)' },
  { value: 'JPY', label: '¥ Japanese Yen (JPY)' },
  { value: 'CNY', label: '¥ Chinese Yuan (CNY)' },
]

const timezoneOptions = [
  { value: 'Asia/Manila', label: 'Asia/Manila (UTC+8)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America/New_York' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney' },
]

type ProfileTab = 'profile' | 'business'

export function ProfilePage() {
  const { role, refresh } = useAuth()
  const { config } = useBusiness()
  const canManage = can(role, 'manage:business')
  const [tab, setTab] = useState<ProfileTab>('profile')

  const [p, setP] = useState<Profile | null>(null)
  const [confirmed, setConfirmed] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedBusiness, setSavedBusiness] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [business, setBusiness] = useState<Business | null>(null)

  useEffect(() => {
    getProfile()
      .then(setP)
      .catch(() => setError('Unable to load your profile. Please try again.'))
    getBusiness().then(setBusiness)
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

  async function handleAvatarUpload(file: File) {
    if (!p) return
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Please upload a JPEG, PNG, WebP, or GIF image.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('Image must be smaller than 5 MB.')
      return
    }

    setUploading(true)
    setError('')
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${p.user_id}/avatar.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const avatarUrl = urlData.publicUrl

      const updated = await updateProfile({ ...p, avatar_url: avatarUrl })
      setP(updated)
      setAvatarPreview(null)
      setSavedBusiness(true)
      setTimeout(() => setSavedBusiness(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setAvatarPreview(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleConfirmUpload() {
    if (!avatarPreview || !fileInputRef.current) return
    fetch(avatarPreview)
      .then((res) => res.blob())
      .then((blob) => {
        const file = new File([blob], 'avatar.jpg', { type: blob.type })
        handleAvatarUpload(file)
      })
  }

  async function handleRemoveAvatar() {
    if (!p) return
    setUploading(true)
    setError('')
    try {
      const ext = p.avatar_url?.split('.').pop() ?? 'jpg'
      const path = `${p.user_id}/avatar.${ext}`
      await supabase.storage.from('avatars').remove([path]).catch(() => {})
      const updated = await updateProfile({ ...p, avatar_url: null })
      setP(updated)
      setAvatarPreview(null)
      setSavedBusiness(true)
      setTimeout(() => setSavedBusiness(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove image.')
    } finally {
      setUploading(false)
    }
  }

  async function handleSaveProfile() {
    if (!p) return
    setSaving(true)
    setSavedBusiness(false)
    setError('')
    try {
      const updated = await updateProfile(p)
      setP(updated)
      await refresh()
      setSavedBusiness(true)
      setTimeout(() => setSavedBusiness(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save your profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function saveBusiness() {
    if (!business) return
    await updateBusiness(business)
    await refresh()
    setSavedBusiness(true)
    setTimeout(() => setSavedBusiness(false), 2500)
  }

  if (!p || !business) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Profile" description="Manage your account, workspace, and business information." />
        <Card>
          <div className="py-10 flex justify-center">
            {error ? (
              <p className="text-center text-sm text-surface-500">{error}</p>
            ) : (
              <Spinner className="gap-3" label="Loading your profile…" />
            )}
          </div>
        </Card>
      </div>
    )
  }

  const currentAvatar = avatarPreview || p.avatar_url

  const tabs: { value: ProfileTab; label: string }[] = [
    { value: 'profile', label: 'My Profile' },
    { value: 'business', label: 'Business Profile' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        description="Manage your account, workspace, and business information."
        actions={
          tab === 'profile' ? (
            <Button icon={<Save className="h-4 w-4" />} onClick={handleSaveProfile} loading={saving}>
              Save Profile
            </Button>
          ) : (
            canManage && (
              <Button icon={<Save className="h-4 w-4" />} onClick={saveBusiness}>
                {savedBusiness ? 'Saved' : 'Save Changes'}
              </Button>
            )
          )
        }
      />

      {tab === 'business' && savedBusiness && (
        <div className="flex items-center gap-2 rounded-lg border border-success-200 bg-success-50 px-3 py-2.5 shadow-soft">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success-600" />
          <p className="text-sm font-semibold text-success-700">Saved changes</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-surface-200 pb-4">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              tab === t.value ? 'bg-primary-50 text-primary-700' : 'text-surface-600 hover:bg-surface-50'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {savedBusiness && (
            <div className="col-span-full flex items-center gap-2 rounded-lg border border-success-200 bg-success-50 px-3 py-2.5 shadow-soft">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success-600" />
              <p className="text-sm font-semibold text-success-700">Saved changes</p>
            </div>
          )}
          <div className="space-y-6">
            <Card>
              <div className="flex flex-col items-center text-center">
                <div className="relative group">
                  <Avatar
                    firstName={p.first_name}
                    lastName={p.last_name}
                    src={currentAvatar}
                    size="lg"
                    className="h-20 w-20 text-xl"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                    aria-label="Change profile picture"
                  >
                    <Camera className="h-5 w-5 text-white" />
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(',')}
                  className="hidden"
                  onChange={handleFileChange}
                />

                {avatarPreview && (
                  <div className="mt-3 flex items-center gap-2">
                    <Button size="sm" onClick={handleConfirmUpload} loading={uploading}>
                      Save photo
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setAvatarPreview(null)}
                      disabled={uploading}
                    >
                      Cancel
                    </Button>
                  </div>
                )}

                {p.avatar_url && !avatarPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={uploading}
                    className="mt-2 text-xs text-surface-400 hover:text-danger-600 transition-colors disabled:opacity-50"
                  >
                    Remove photo
                  </button>
                )}

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

              {error && (
                <p className="mt-5 text-sm font-medium text-danger-700 bg-danger-50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === 'business' && (
        <div className="space-y-6">
          <Card>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <h3 className="text-base font-semibold text-surface-900 mb-1">Business Information</h3>
                <p className="text-sm text-surface-500 mb-5">This is shown across your workspace.</p>
              </div>
              <Input label="Business name" value={business.name} onChange={(e) => setBusiness({ ...business, name: e.target.value })} disabled={!canManage} />
              <Select label="Business type" options={typeOptions} value={business.type} onChange={(e) => setBusiness({ ...business, type: e.target.value as BusinessType })} />
              <Input label="Location" value={business.location} onChange={(e) => setBusiness({ ...business, location: e.target.value })} disabled={!canManage} />
              <Select label="Timezone" options={timezoneOptions} value={business.timezone} onChange={(e) => setBusiness({ ...business, timezone: e.target.value })} />
              <Select label="Currency" options={currencyOptions} value={business.currency} onChange={(e) => setBusiness({ ...business, currency: e.target.value })} />
              <Input label="Team size" type="number" value={String(business.team_size)} onChange={(e) => setBusiness({ ...business, team_size: Number(e.target.value) || 0 })} disabled={!canManage} />
            </div>
          </Card>

          {canManage && (
            <Card>
              <h3 className="text-base font-semibold text-surface-900 mb-3">Dashboard Quick Actions</h3>
              <p className="text-sm text-surface-500 mb-4">
                Every workspace shares the same quick actions on the dashboard and the mobile action bar.
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {config.quickActions.map((qa) => (
                  <li key={qa.id} className="flex items-center gap-2 rounded-lg border border-surface-100 bg-surface-50/60 px-3 py-2 text-sm text-surface-700">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-50 text-primary-600">
                      <Save className="h-3 w-3" aria-hidden />
                    </span>
                    {qa.label}
                  </li>
                ))}
              </ul>
            </Card>
          )}

        </div>
      )}
    </div>
  )
}
