import { useEffect, useState } from 'react'
import { Save, Trash2, RotateCcw } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { useAuth } from '@/contexts/AuthContext'
import { isDemoMode } from '@/lib/supabase'
import {
  getProfile,
  updateProfile,
  getPreferences,
  savePreferences,
  resetDemoData,
  ROLE_LABELS,
  type Preferences,
} from '@/services/settingsService'
import { can } from '@/utils/permissions'
import type { Profile } from '@/types'
import { cn } from '@/lib/cn'

type SettingsTab = 'profile' | 'preferences' | 'notifications' | 'data'

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-surface-900">{label}</p>
        {hint && <p className="text-xs text-surface-500">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
          checked ? 'bg-primary-600' : 'bg-surface-200'
        )}
      >
        <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
      </button>
    </div>
  )
}

export function SettingsPage() {
  const { role, business } = useAuth()
  const [tab, setTab] = useState<SettingsTab>('profile')

  const [p, setP] = useState<Profile | null>(null)
  const [prefs, setPrefs] = useState<Preferences>(() => getPreferences())

  useEffect(() => {
    getProfile().then(setP)
  }, [])

  const canManageSettings = can(role, 'manage:settings')

  const tabs: { value: SettingsTab; label: string }[] = [
    { value: 'profile', label: 'My Profile' },
    { value: 'preferences', label: 'Preferences' },
    { value: 'notifications', label: 'Notification Settings' },
    { value: 'data', label: 'Data & Safety' },
  ]

  async function handleSaveProfile() {
    if (!p) return
    await updateProfile(p)
  }

  function handleSavePreferences() {
    savePreferences(prefs)
  }

  function handleReset() {
    if (window.confirm('Reset all demo data to the original sample dataset? This cannot be undone.')) {
      resetDemoData()
      window.location.reload()
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your account, preferences, and data." />

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

      {tab === 'profile' && p && (
        <Card>
          <h3 className="text-lg font-semibold text-surface-900 mb-5">Personal Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Input label="First name" value={p.first_name} onChange={(e) => setP({ ...p, first_name: e.target.value })} />
            <Input label="Last name" value={p.last_name} onChange={(e) => setP({ ...p, last_name: e.target.value })} />
            <Input label="Email" type="email" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} />
            <Input label="Phone" value={p.phone ?? ''} onChange={(e) => setP({ ...p, phone: e.target.value })} />
          </div>
          <div className="mt-6 pt-5 border-t border-surface-200 flex items-center justify-between">
            <p className="text-sm text-surface-500">
              You are <span className="font-medium text-surface-900">{ROLE_LABELS[role ?? 'staff']}</span> for{' '}
              <span className="font-medium text-surface-900">{business?.name}</span>
            </p>
            <Button icon={<Save className="h-4 w-4" />} onClick={handleSaveProfile}>Save Profile</Button>
          </div>
        </Card>
      )}

      {tab === 'preferences' && (
        <Card>
          <h3 className="text-lg font-semibold text-surface-900 mb-5">Preferences</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
            <Select
              label="Date format"
              options={[
                { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
              ]}
              value={prefs.dateFormat}
              onChange={(e) => setPrefs({ ...prefs, dateFormat: e.target.value as Preferences['dateFormat'] })}
            />
            <Select
              label="Week starts on"
              options={[
                { value: 'monday', label: 'Monday' },
                { value: 'sunday', label: 'Sunday' },
              ]}
              value={prefs.weekStartsOn}
              onChange={(e) => setPrefs({ ...prefs, weekStartsOn: e.target.value as Preferences['weekStartsOn'] })}
            />
          </div>
          <div className="divide-y divide-surface-200 border-t border-surface-200">
            <Toggle
              checked={prefs.compactLayout}
              onChange={(v) => setPrefs({ ...prefs, compactLayout: v })}
              label="Compact layout"
              hint="Show more rows on each page by using a denser layout."
            />
          </div>
          <div className="mt-6 pt-5 border-t border-surface-200 flex justify-end">
            <Button icon={<Save className="h-4 w-4" />} onClick={handleSavePreferences}>Save Preferences</Button>
          </div>
        </Card>
      )}

      {tab === 'notifications' && (
        <Card>
          <h3 className="text-lg font-semibold text-surface-900 mb-2">Notification Channels</h3>
          <p className="text-sm text-surface-500 mb-4">Choose how and when you want to be notified.</p>
          <div className="divide-y divide-surface-200 border-t border-surface-200">
            <Toggle checked={prefs.notificationEmail} onChange={(v) => setPrefs({ ...prefs, notificationEmail: v })} label="Email notifications" />
            <Toggle checked={prefs.notificationPush} onChange={(v) => setPrefs({ ...prefs, notificationPush: v })} label="In-app / push notifications" />
            <Toggle checked={prefs.notificationSms} onChange={(v) => setPrefs({ ...prefs, notificationSms: v })} label="SMS notifications" />
          </div>
          <h3 className="text-lg font-semibold text-surface-900 mt-6 mb-2">What to notify me about</h3>
          <div className="divide-y divide-surface-200 border-t border-surface-200">
            <Toggle checked={prefs.notifyNewBooking} onChange={(v) => setPrefs({ ...prefs, notifyNewBooking: v })} label="New bookings / reservations" />
            <Toggle checked={prefs.notifyTaskAssigned} onChange={(v) => setPrefs({ ...prefs, notifyTaskAssigned: v })} label="Tasks assigned to me" />
            <Toggle checked={prefs.notifyNewCustomer} onChange={(v) => setPrefs({ ...prefs, notifyNewCustomer: v })} label="New customers" />
            <Toggle checked={prefs.weeklyDigest} onChange={(v) => setPrefs({ ...prefs, weeklyDigest: v })} label="Weekly digest" hint="A summary of your business performance every Monday." />
            <Toggle checked={prefs.marketing} onChange={(v) => setPrefs({ ...prefs, marketing: v })} label="Product updates & tips" />
          </div>
          <div className="mt-6 pt-5 border-t border-surface-200 flex justify-end">
            <Button icon={<Save className="h-4 w-4" />} onClick={handleSavePreferences}>Save Notification Settings</Button>
          </div>
        </Card>
      )}

      {tab === 'data' && (
        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold text-surface-900 mb-2">Data & Safety</h3>
            <p className="text-sm text-surface-600 leading-relaxed">
              You are currently using {isDemoMode() ? 'demo mode' : 'the connected Supabase backend'}. In demo mode, all data is
              stored locally in your browser for demonstration purposes.
              {business && (
                <span className="block mt-2">Connected business: <span className="font-medium text-surface-900">{business.name}</span></span>
              )}
            </p>
          </Card>

          {isDemoMode() && (
            <Card className="border-danger-200">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-danger-50 text-danger-600 flex items-center justify-center shrink-0">
                  <RotateCcw className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-surface-900">Reset demo data</h3>
                  <p className="text-sm text-surface-600 mt-1">
                    Restore the database to the original sample dataset. All your changes will be lost.
                  </p>
                  <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} className="mt-4" onClick={handleReset}>
                    Reset Demo Data
                  </Button>
                </div>
              </div>
            </Card>
          )}

          <Card className={cn(!canManageSettings && 'hidden')}>
            <h3 className="text-base font-semibold text-danger-600 flex items-center gap-2">
              <Trash2 className="h-4 w-4" /> Danger Zone
            </h3>
            <p className="text-sm text-surface-600 mt-1">
              Your role ({ROLE_LABELS[role ?? 'staff']}) determines what management actions are available here. Only owners can
              permanently delete the business or its data.
            </p>
          </Card>
        </div>
      )}
    </div>
  )
}
