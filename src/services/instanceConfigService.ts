import { getStore, updateStore } from '@/services/demoStore'
import { isDemo, getCurrentBusinessId, messageFromError } from '@/lib/dataClient'
import { supabase } from '@/lib/supabase'
import type { InstanceConfig } from '@/types'

export const INSTANCE_CONFIG_KEY = 'instance_config'

export const DEFAULT_INSTANCE_CONFIG: InstanceConfig = {
  app_name: null,
  custom_domain: null,
  primary_color: null,
  features: {
    public_shopfront: true,
    online_payments: true,
    customer_reviews: false,
    guest_bookings: false,
  },
}

export function mergeInstanceConfig(raw: unknown): InstanceConfig {
  const parsed = (raw ?? {}) as Partial<InstanceConfig>
  return {
    ...DEFAULT_INSTANCE_CONFIG,
    ...parsed,
    features: { ...DEFAULT_INSTANCE_CONFIG.features, ...(parsed.features ?? {}) },
  }
}

export async function getInstanceConfig(): Promise<InstanceConfig> {
  if (isDemo()) {
    const row = getStore().settings.find((s) => s.key === INSTANCE_CONFIG_KEY)
    if (!row?.value) return DEFAULT_INSTANCE_CONFIG
    try {
      return mergeInstanceConfig(JSON.parse(row.value))
    } catch {
      return DEFAULT_INSTANCE_CONFIG
    }
  }
  const businessId = await getCurrentBusinessId()
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('business_id', businessId)
    .eq('key', INSTANCE_CONFIG_KEY)
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to load instance configuration.'))
  if (!data?.value) return DEFAULT_INSTANCE_CONFIG
  try {
    return mergeInstanceConfig(JSON.parse(data.value))
  } catch {
    return DEFAULT_INSTANCE_CONFIG
  }
}

export async function saveInstanceConfig(config: InstanceConfig): Promise<void> {
  const value = JSON.stringify(config)
  if (isDemo()) {
    updateStore((s) => {
      const idx = s.settings.findIndex((row) => row.key === INSTANCE_CONFIG_KEY)
      if (idx >= 0) {
        s.settings[idx] = { ...s.settings[idx], value, updated_at: new Date().toISOString() }
      } else {
        s.settings.push({
          id: 'settings-' + INSTANCE_CONFIG_KEY,
          business_id: s.business.id,
          key: INSTANCE_CONFIG_KEY,
          value,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }
    })
    return
  }
  const businessId = await getCurrentBusinessId()
  const { data: existing } = await supabase
    .from('settings')
    .select('id')
    .eq('business_id', businessId)
    .eq('key', INSTANCE_CONFIG_KEY)
    .maybeSingle()
  if (existing?.id) {
    const { error } = await supabase
      .from('settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) throw new Error(messageFromError(error, 'Failed to save instance configuration.'))
  } else {
    const { error } = await supabase.from('settings').insert({
      business_id: businessId,
      key: INSTANCE_CONFIG_KEY,
      value,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    if (error) throw new Error(messageFromError(error, 'Failed to save instance configuration.'))
  }
}