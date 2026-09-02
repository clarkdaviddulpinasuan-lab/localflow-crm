import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { BusinessType } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import {
  getBusinessTypeConfig,
  fromDashboardConfigJSON,
  DEFAULT_WIDGETS,
  type BusinessTypeConfig,
} from '@/config/businessTypes'
import { getDashboardConfig, saveDashboardConfig } from '@/services/settingsService'

interface Terminology {
  mainEntity: string
  entitiesPlural: string
  bookingLabel: string
  orderLabel: string
  customerLabel: string
  resourceLabel: string
  defaultResources: string[]
  kpiLabels: {
    revenue: string
    bookings: string
    customers: string
  }
}

interface BusinessContextValue {
  terminology: Terminology
  currency: string
  timezone: string
  config: BusinessTypeConfig
  /** Persist an updated config to the settings table (no-op in demo). */
  updateConfig: (patch: Partial<BusinessTypeConfig>) => Promise<void>
}

const businessTypeToTerminology = (type: BusinessType, cfg: BusinessTypeConfig): Terminology => ({
  mainEntity: cfg.bookingLabel,
  entitiesPlural: cfg.bookingLabel + 's',
  bookingLabel: cfg.bookingLabel,
  orderLabel: cfg.orderLabel,
  customerLabel: cfg.customerLabel,
  resourceLabel: cfg.resourceLabel,
  defaultResources: cfg.defaultResources,
  kpiLabels: {
    revenue: cfg.primaryMetricLabel,
    bookings: cfg.bookingLabel,
    customers: cfg.customerLabel,
  },
})

const BusinessContext = createContext<BusinessContextValue | undefined>(undefined)

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const { business } = useAuth()
  const [override, setOverride] = useState<BusinessTypeConfig | null>(null)

  useEffect(() => {
    let cancelled = false
    setOverride(null)
    if (business) {
      getDashboardConfig()
        .then((json) => {
          if (cancelled) return
          const base = getBusinessTypeConfig(business.type ?? 'other')
          setOverride(fromDashboardConfigJSON(json, base))
        })
        .catch(() => {
          // fall back to defaults on any read error
          if (!cancelled) setOverride(getBusinessTypeConfig(business.type ?? 'other'))
        })
    } else {
      setOverride(null)
    }
    return () => {
      cancelled = true
    }
  }, [business])

  const value = useMemo<BusinessContextValue>(() => {
    const type: BusinessType = business?.type ?? 'other'
    const base = getBusinessTypeConfig(type)
    const merged = override ?? base
    const config: BusinessTypeConfig = { ...merged, widgets: merged.widgets ?? DEFAULT_WIDGETS }
    return {
      terminology: businessTypeToTerminology(type, config),
      currency: business?.currency ?? 'PHP',
      timezone: business?.timezone ?? 'UTC',
      config,
      updateConfig: async (patch: Partial<BusinessTypeConfig>) => {
        const next: BusinessTypeConfig = { ...config, ...patch }
        setOverride(next)
        const { toDashboardConfigJSON } = await import('@/config/businessTypes')
        try {
          await saveDashboardConfig(toDashboardConfigJSON(next))
        } catch {
          // keep the local override even if persistence fails
        }
      },
    }
  }, [business, override])

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>
}

export function useBusiness() {
  const context = useContext(BusinessContext)
  if (!context) {
    throw new Error('useBusiness must be used within a BusinessProvider')
  }
  return context
}
