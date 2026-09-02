import { Link, NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { buildNavGroups } from '@/routes/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useBusiness } from '@/contexts/BusinessContext'
import { getInitials } from '@/utils/format'
import { Waves, LogOut, X } from 'lucide-react'

interface SidebarProps {
  mobileOpen: boolean
  onClose: () => void
}

function SidebarContent({ onClose }: { onClose: () => void }) {
  const { profile, business, signOut } = useAuth()
  const { config } = useBusiness()
  const navGroups = buildNavGroups(config.navLabels)

  return (
    <div className="flex h-full flex-col bg-navy-900 text-white">
      <div className="flex items-center justify-between px-5 h-16 border-b border-white/10">
        <Link to="/" className="flex items-center gap-2.5" onClick={onClose}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
            <Waves className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <span className="block text-sm font-semibold tracking-tight">LocalFlow</span>
            <span className="block text-[11px] text-white/60">CRM</span>
          </div>
        </Link>
        <button
          onClick={onClose}
          className="lg:hidden text-white/60 hover:text-white p-1"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
        {navGroups.map((group, i) => (
          <div key={i} className="mb-5">
            {group.label && (
              <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
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
                          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-primary-600 text-white'
                            : 'text-white/70 hover:bg-white/5 hover:text-white'
                        )
                      }
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      {item.label}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold">
            {getInitials(profile?.first_name ?? 'Local', profile?.last_name ?? 'Flow')}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {profile ? `${profile.first_name} ${profile.last_name}` : 'Local Flow'}
            </p>
            <p className="truncate text-xs text-white/60">
              {business?.name ?? 'Demo Business'}
            </p>
          </div>
          <button
            onClick={signOut}
            className="text-white/50 hover:text-white p-1.5 rounded-md transition-colors"
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
  return (
    <>
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 w-64 hidden lg:block">
        <SidebarContent onClose={onClose} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-navy-950/50" onClick={onClose} />
          <aside className="fixed inset-y-0 left-0 w-72 animate-in slide-in-from-left duration-200">
            <SidebarContent onClose={onClose} />
          </aside>
        </div>
      )}
    </>
  )
}
