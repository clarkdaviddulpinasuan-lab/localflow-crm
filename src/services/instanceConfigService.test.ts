import { describe, it, expect, beforeEach } from 'vitest'
import { resetStore } from '@/services/demoStore'
import { getInstanceConfig, saveInstanceConfig, DEFAULT_INSTANCE_CONFIG, mergeInstanceConfig } from '@/services/instanceConfigService'

describe('instance config service', () => {
  beforeEach(() => {
    resetStore()
  })

  it('returns defaults when nothing is saved', async () => {
    const cfg = await getInstanceConfig()
    expect(cfg).toEqual(DEFAULT_INSTANCE_CONFIG)
    expect(cfg.features.public_shopfront).toBe(true)
  })

  it('persists and reloads a custom instance config', async () => {
    const custom = {
      app_name: 'Breeze Portal',
      custom_domain: 'book.breeze.ph',
      primary_color: '#246bce',
      features: { ...DEFAULT_INSTANCE_CONFIG.features, customer_reviews: true, guest_bookings: true },
    }
    await saveInstanceConfig(custom)
    const loaded = await getInstanceConfig()
    expect(loaded.app_name).toBe('Breeze Portal')
    expect(loaded.custom_domain).toBe('book.breeze.ph')
    expect(loaded.primary_color).toBe('#246bce')
    expect(loaded.features.customer_reviews).toBe(true)
    expect(loaded.features.guest_bookings).toBe(true)
  })

  it('merges partial saved configs over defaults', () => {
    const merged = mergeInstanceConfig({ app_name: 'Only Name' })
    expect(merged.app_name).toBe('Only Name')
    expect(merged.custom_domain).toBeNull()
    expect(merged.features.online_payments).toBe(true)
  })
})