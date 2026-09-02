import { useEffect, useState, type ReactNode } from 'react'
import { Sidebar } from '@/layouts/Sidebar'
import { Header } from '@/layouts/Header'
import { MobileActionBar } from '@/components/MobileActionBar'
import { CommandPalette } from '@/components/CommandPalette'
import { getInstanceConfig } from '@/services/instanceConfigService'
import type { InstanceConfig } from '@/types'

interface AppLayoutProps {
  children: ReactNode
}

function applyBranding(config: InstanceConfig) {
  const root = document.documentElement
  const hex = config.primary_color
  if (hex) {
    const shades = primaryShades(hex)
    ;(Object.keys(shades) as (keyof typeof shades)[]).forEach((key) => {
      root.style.setProperty(`--color-${key}`, shades[key])
    })
  }
  if (config.app_name) {
    document.title = config.app_name
  }
}

function mixChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t)
}

function mix(hex: string, target: [number, number, number], t: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const to = (c: number) => mixChannel(r, target[0], c)
  const g2 = (c: number) => mixChannel(g, target[1], c)
  const b2 = (c: number) => mixChannel(b, target[2], c)
  const hexStr = (n: number) => n.toString(16).padStart(2, '0')
  return `#${hexStr(to(t))}${hexStr(g2(t))}${hexStr(b2(t))}`
}

function primaryShades(hex: string): Record<string, string> {
  const white: [number, number, number] = [255, 255, 255]
  const black: [number, number, number] = [0, 0, 0]
  return {
    'primary-50': mix(hex, white, 0.93),
    'primary-100': mix(hex, white, 0.85),
    'primary-200': mix(hex, white, 0.7),
    'primary-300': mix(hex, white, 0.5),
    'primary-400': mix(hex, white, 0.25),
    'primary-500': hex,
    'primary-600': mix(hex, black, 0.12),
    'primary-700': mix(hex, black, 0.24),
    'primary-800': mix(hex, black, 0.36),
    'primary-900': mix(hex, black, 0.48),
  }
}

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    getInstanceConfig().then(applyBranding)
  }, [])

  return (
    <div className="min-h-screen bg-surface-50">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="lg:pl-64">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto pb-24 lg:pb-8">{children}</main>
      </div>
      <MobileActionBar />
      <CommandPalette />
    </div>
  )
}