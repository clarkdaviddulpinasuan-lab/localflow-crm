import { useEffect, useState } from 'react'
import { Save, Compass, Palette } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { useBusiness } from '@/contexts/BusinessContext'
import { useAuth } from '@/contexts/AuthContext'
import { getBusiness, updateBusiness } from '@/services/settingsService'
import { getInstanceConfig, saveInstanceConfig, DEFAULT_INSTANCE_CONFIG } from '@/services/instanceConfigService'
import { can } from '@/utils/permissions'
import type { Business, BusinessType, InstanceConfig, InstanceFeatures } from '@/types'

const FEATURE_LABELS: { key: keyof InstanceFeatures; label: string; hint: string }[] = [
  { key: 'public_shopfront', label: 'Public shopfront', hint: 'Allow a public, shareable page for this business.' },
  { key: 'online_payments', label: 'Online payments', hint: 'Enable card/payment collection on bookings and orders.' },
  { key: 'customer_reviews', label: 'Customer reviews', hint: 'Collect and display reviews from customers.' },
  { key: 'guest_bookings', label: 'Guest bookings', hint: 'Let customers book without an account.' },
]

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

export function BusinessProfilePage() {
  const { role } = useAuth()
  const { terminology, config, updateConfig } = useBusiness()
  const canManage = can(role, 'manage:business')
  const [business, setBusiness] = useState<Business | null>(null)
  const [instance, setInstance] = useState<InstanceConfig>(DEFAULT_INSTANCE_CONFIG)
  const [saved, setSaved] = useState(false)
  const [navLabels, setNavLabels] = useState(config.navLabels)

  useEffect(() => {
    Promise.all([getBusiness(), getInstanceConfig()]).then(([biz, inst]) => {
      setBusiness(biz)
      setInstance(inst)
    })
  }, [])

  useEffect(() => {
    setNavLabels(config.navLabels)
  }, [config.navLabels])

  async function save() {
    if (!business) return
    await updateBusiness(business)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function saveNavLabels() {
    await updateConfig({ navLabels })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function saveInstance() {
    await saveInstanceConfig(instance)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (!business) {
    return (
      <div className="space-y-6">
        <PageHeader title="Business Profile" description="Manage your business identity and preferences." />
        <Card><div className="py-10 text-center text-sm text-surface-500">Loading business profile...</div></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Profile"
        description="Manage your business identity and preferences."
        actions={canManage && <Button icon={<Save className="h-4 w-4" />} onClick={save}>{saved ? 'Saved' : 'Save Changes'}</Button>}
      />

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <h3 className="text-base font-semibold text-surface-900 mb-1">Business Information</h3>
            <p className="text-sm text-surface-500 mb-5">This is shown across your workspace.</p>
          </div>
          <Input label="Business name" value={business.name} onChange={(e) => setBusiness({ ...business, name: e.target.value })} disabled={!canManage} />
          <Select label="Business type" options={typeOptions} value={business.type} onChange={(e) => setBusiness({ ...business, type: e.target.value as BusinessType })} />
          <Input label="Location" value={business.location} onChange={(e) => setBusiness({ ...business, location: e.target.value })} disabled={!canManage} />
          <Select label="Timezone" options={[{ value: 'Asia/Manila', label: 'Asia/Manila (UTC+8)' }, { value: 'UTC', label: 'UTC' }, { value: 'America/New_York', label: 'America/New_York' }, { value: 'Europe/London', label: 'Europe/London' }, { value: 'Australia/Sydney', label: 'Australia/Sydney' }]} value={business.timezone} onChange={(e) => setBusiness({ ...business, timezone: e.target.value })} />
          <Select label="Currency" options={currencyOptions} value={business.currency} onChange={(e) => setBusiness({ ...business, currency: e.target.value })} />
          <Input label="Team size" type="number" value={String(business.team_size)} onChange={(e) => setBusiness({ ...business, team_size: Number(e.target.value) || 0 })} disabled={!canManage} />
        </div>

        <div className="mt-6 pt-5 border-t border-surface-200 flex justify-end">
          <Button icon={<Save className="h-4 w-4" />} onClick={save} disabled={!canManage}>{saved ? 'Saved' : 'Save Changes'}</Button>
        </div>
      </Card>

      <Card>
        <h3 className="text-base font-semibold text-surface-900 mb-3">Terminology</h3>
        <p className="text-sm text-surface-600 leading-relaxed">
          Terms throughout LocalFlow adapt to your business type. Here a{' '}
          <span className="font-medium text-surface-900">{terminology.resourceLabel}</span> is used for scheduling, and core
          metrics are labeled {terminology.kpiLabels.revenue}, {terminology.kpiLabels.bookings}, and{' '}
          {terminology.kpiLabels.customers}.
        </p>
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Compass className="h-5 w-5 text-primary-600" />
          <h3 className="text-base font-semibold text-surface-900">Dashboard & Navigation Labels</h3>
        </div>
        <p className="text-sm text-surface-500 mb-4">
          Customize how this workspace is labelled. These override the defaults for your business type and are
          stored in your business settings.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <Input
            label="Customers label"
            value={navLabels.customers}
            onChange={(e) => setNavLabels({ ...navLabels, customers: e.target.value })}
            disabled={!canManage}
          />
          <Input
            label="Bookings label"
            value={navLabels.bookings}
            onChange={(e) => setNavLabels({ ...navLabels, bookings: e.target.value })}
            disabled={!canManage}
          />
          <Input
            label="Orders label"
            value={navLabels.orders}
            onChange={(e) => setNavLabels({ ...navLabels, orders: e.target.value })}
            disabled={!canManage}
          />
        </div>
        {canManage && (
          <Button icon={<Save className="h-4 w-4" />} onClick={saveNavLabels}>
            {saved ? 'Saved' : 'Save Labels'}
          </Button>
        )}
      </Card>

      {canManage && (
        <Card>
          <h3 className="text-base font-semibold text-surface-900 mb-3">Quick Actions For Your Business</h3>
          <p className="text-sm text-surface-500 mb-4">
            These actions appear on your dashboard and the mobile action bar.
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

      {canManage && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Palette className="h-5 w-5 text-primary-600" />
            <h3 className="text-base font-semibold text-surface-900">White-label & Instance</h3>
          </div>
          <p className="text-sm text-surface-500 mb-5 leading-relaxed">
            Tenant-level settings for white-label deployments: an optional app name (shown in the browser title),
            a custom domain, a brand accent color applied to the primary palette, and feature switches.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
            <Input
              label="App name (browser title)"
              value={instance.app_name ?? ''}
              onChange={(e) => setInstance({ ...instance, app_name: e.target.value || null })}
              placeholder={business.name}
            />
            <Input
              label="Custom domain"
              value={instance.custom_domain ?? ''}
              onChange={(e) => setInstance({ ...instance, custom_domain: e.target.value || null })}
              placeholder="book.mydomain.com"
            />
            <div>
              <span className="mb-1.5 block text-sm font-medium text-surface-700">Brand accent color</span>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={instance.primary_color ?? '#4666a1'}
                  onChange={(e) => setInstance({ ...instance, primary_color: e.target.value || null })}
                  className="h-10 w-14 rounded-md border border-surface-200 bg-white p-1"
                />
                <span className="text-sm text-surface-500">{instance.primary_color ?? '#4666a1 (default)'}</span>
              </div>
            </div>
          </div>
          <div className="space-y-3 border-t border-surface-200 pt-5">
            {FEATURE_LABELS.map(({ key, label, hint }) => (
              <label key={key} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-primary-600"
                  checked={instance.features[key]}
                  onChange={(e) => setInstance({ ...instance, features: { ...instance.features, [key]: e.target.checked } })}
                />
                <span>
                  <span className="block text-sm font-medium text-surface-900">{label}</span>
                  <span className="block text-xs text-surface-500">{hint}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-6 flex justify-end">
            <Button icon={<Save className="h-4 w-4" />} onClick={saveInstance}>{saved ? 'Saved' : 'Save Instance'}</Button>
          </div>
        </Card>
      )}
    </div>
  )
}
