import { Link, NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { buildNavGroups } from '@/routes/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useBusiness } from '@/contexts/BusinessContext'
import { Waves, LogOut, X, ChevronRight } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Business } from '@/types'

interface SidebarProps {
  mobileOpen: boolean
  onClose: () => void
}

function BusinessSwitcher({ onClose }: { onClose: () => void }) {
  const { memberships, business, switchBusiness } = useAuth()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const ids = Array.from(new Set(memberships.map((m) => m.business_id))).filter(Boolean)
    if (ids.length < 2) {
      setBusinesses([])
      return
    }
    let cancelled = false
    supabase
      .from('businesses')
      .select('*')
      .in('id', ids)
      .then(({ data }) => {
        if (!cancelled && data) setBusinesses(data as Business[])
      })
    return () => {
      cancelled = true
    }
  }, [memberships])

  if (businesses.length < 2) return null

  return (
    <div className="px-2 pb-3">
      <label htmlFor="business-switcher" className="sr-only">
        Switch business
      </label>
      <select
        id="business-switcher"
        value={business?.id ?? ''}
        disabled={busy}
        onChange={async (e) => {
          const next = e.target.value
          if (!next || next === business?.id) return
          setBusy(true)
          try {
            await switchBusiness(next)
            onClose()
          } catch (err) {
            console.error('Failed to switch business:', err)
          } finally {
            setBusy(false)
          }
        }}
        className="w-full h-9 rounded-[10px] border border-surface-200 bg-surface-50 px-3 text-sm font-medium text-surface-900 focus:outline-none focus:ring-2 focus:ring-[#7b6bf2]/40"
      >
        {businesses.map((b) => {
          const role = memberships.find((m) => m.business_id === b.id)?.role
          return (
            <option key={b.id} value={b.id}>
              {b.name}
              {role === 'owner' ? ' (Owner)' : ''}
            </option>
          )
        })}
      </select>
    </div>
  )
}

function SidebarContent({ onClose }: { onClose: () => void }) {
  const { profile, business, memberships, signOut } = useAuth()
  const { config } = useBusiness()
  const navGroups = buildNavGroups(config.navLabels)

  return (
    <div className="flex h-full flex-col bg-white border-r border-surface-200">
      <div className="flex items-center justify-between px-5 h-[70px] border-b border-surface-100">
        <Link to="/" className="flex items-center gap-2.5" onClick={onClose}>
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#ede9fe]">
            <Waves className="h-5 w-5 text-[#7b6bf2]" />
          </span>
          <div className="leading-tight">
            <span className="block text-sm font-bold tracking-tight text-surface-900">LocalFlow</span>
          </div>
        </Link>
        <button
          onClick={onClose}
          className="lg:hidden text-surface-500 hover:text-surface-900 p-1"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-5">
        {navGroups.map((group, i) => (
          <div key={i} className="mb-2">
            {group.label && (
              <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-surface-400">
                {group.label}
              </p>
            )}
            <ul>
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      end={item.path === '/'}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-3 px-3 rounded-[10px] text-sm font-medium transition-colors h-12',
                          isActive
                            ? 'bg-[#ede9fe] text-surface-900 font-semibold'
                            : 'text-surface-500 hover:bg-surface-50 hover:text-surface-900'
                        )
                      }
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', 'text-surface-400 group-hover:text-[#7b6bf2]')} />
                      <span className="flex-1">{item.label}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-surface-300 opacity-0 transition-opacity group-hover:opacity-100" />
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-surface-100 p-4">
        {memberships.length > 1 && <BusinessSwitcher onClose={onClose} />}
        <div className="flex items-center gap-3 px-2 py-2 rounded-[10px]">
          <Avatar
            firstName={profile?.first_name ?? 'Local'}
            lastName={profile?.last_name ?? 'Flow'}
            src={profile?.avatar_url}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-surface-900">
              {profile ? `${profile.first_name} ${profile.last_name}` : 'Local Flow'}
            </p>
            <p className="truncate text-xs text-surface-400">
              {business?.name ?? 'LocalFlow Workspace'}
            </p>
          </div>
          <button
            onClick={signOut}
            className="text-surface-400 hover:text-surface-900 p-1.5 rounded-[10px] transition-colors"
            title="Log out"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex w-64 h-full flex-col">
        <SidebarContent onClose={onClose} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-rhombus-bg/50" onClick={onClose} />
          <aside className="fixed inset-y-0 left-0 w-72 animate-in slide-in-from-left duration-200 max-h-full overflow-y-auto">
            <SidebarContent onClose={onClose} />
          </aside>
        </div>
      )}
    </>
  )
}
