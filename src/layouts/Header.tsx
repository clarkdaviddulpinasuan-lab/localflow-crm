import { useAuth } from '@/contexts/AuthContext'
import { getInitials } from '@/utils/format'
import { Search, Bell, Menu, ChevronDown, HelpCircle, UserCircle, LogOut, CheckCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listNotifications, markAllRead, unreadCount } from '@/services/notificationService'
import { openCommandPalette } from '@/lib/commandPalette'
import type { Notification } from '@/types'
import { cn } from '@/lib/cn'

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { profile, business, signOut } = useAuth()
  const navigate = useNavigate()
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [notifLoading, setNotifLoading] = useState(false)

  useEffect(() => {
    let active = true
    unreadCount().then((count) => {
      if (active) setUnread(count)
    })
    return () => {
      active = false
    }
  }, [])

  async function loadNotifications() {
    setNotifLoading(true)
    try {
      const [items, count] = await Promise.all([listNotifications(8), unreadCount()])
      setNotifications(items)
      setUnread(count)
    } finally {
      setNotifLoading(false)
    }
  }

  async function handleReadAll() {
    await markAllRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnread(0)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-surface-200 bg-white/95 backdrop-blur px-4 sm:px-6">
      <button
        onClick={onMenuClick}
        className="lg:hidden text-surface-600 hover:text-surface-900 p-1.5 -ml-1"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1 flex items-center gap-3 min-w-0">
        <div className="relative max-w-md w-full hidden sm:block">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
            <Search className="h-4 w-4" />
          </span>
          <button
            type="button"
            onClick={openCommandPalette}
            className="w-full h-9 pl-9 pr-3 text-left text-sm rounded-lg border border-surface-200 bg-surface-50 text-surface-400 hover:bg-surface-100 hover:text-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors"
            aria-label="Open search and commands"
          >
            Search customers, bookings, orders…
          </button>
          <kbd className="absolute inset-y-0 right-3 flex items-center text-[11px] text-surface-400">
            ⌘K
          </kbd>
        </div>
        <button
          type="button"
          onClick={openCommandPalette}
          className="sm:hidden text-surface-500 hover:text-surface-900 p-2 rounded-lg hover:bg-surface-100 transition-colors"
          aria-label="Open search and commands"
        >
          <Search className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          className="text-surface-500 hover:text-surface-900 p-2 rounded-lg hover:bg-surface-100 transition-colors hidden sm:flex"
          aria-label="Help"
        >
          <HelpCircle className="h-5 w-5" />
        </button>

        <div className="relative">
          <button
            onClick={() => {
              setNotifOpen((v) => {
                if (!v) loadNotifications()
                return !v
              })
              setProfileOpen(false)
            }}
            className="relative text-surface-500 hover:text-surface-900 p-2 rounded-lg hover:bg-surface-100 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-danger-500 ring-2 ring-white" />
            )}
          </button>
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-surface-200 bg-white shadow-lg z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-surface-900">Notifications</p>
                {unread > 0 && (
                  <button
                    onClick={handleReadAll}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Mark all read
                  </button>
                )}
              </div>
              <div className="p-2 max-h-80 overflow-y-auto">
                {notifLoading ? (
                  <div className="px-3 py-3 text-center text-sm text-surface-500">Loading…</div>
                ) : notifications.length === 0 ? (
                  <div className="px-3 py-3 text-center text-sm text-surface-500">
                    No new notifications
                  </div>
                ) : (
                  <ul className="divide-y divide-surface-100">
                    {notifications.map((n) => (
                      <li key={n.id} className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg hover:bg-surface-50">
                        <span
                          className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', n.read ? 'bg-surface-200' : 'bg-primary-500')}
                        />
                        <div className="min-w-0">
                          <p className="text-sm text-surface-900 truncate">{n.title}</p>
                          <p className="text-xs text-surface-500 truncate">{n.message}</p>
                          <p className="text-[11px] text-surface-400 mt-0.5">
                            {new Date(n.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Link
                to="/notifications"
                onClick={() => setNotifOpen(false)}
                className="block border-t border-surface-100 px-4 py-2.5 text-center text-xs font-semibold text-primary-600 hover:bg-primary-50/40 transition-colors"
              >
                View all notifications
              </Link>
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => {
              setProfileOpen((v) => !v)
              setNotifOpen(false)
            }}
            className="flex items-center gap-2.5 pl-1.5 sm:pl-3 border-l border-surface-200 hover:bg-surface-50 rounded-lg py-1.5 pr-2 transition-colors"
            aria-label="Open account menu"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-sm font-semibold">
              {getInitials(profile?.first_name ?? 'L', profile?.last_name ?? 'F')}
            </span>
            <div className="hidden md:block leading-tight text-left">
              <p className="text-sm font-medium text-surface-900">
                {profile ? `${profile.first_name} ${profile.last_name}` : 'Local Flow'}
              </p>
              <p className="text-xs text-surface-500">{business?.name}</p>
            </div>
            <ChevronDown className="hidden md:block h-4 w-4 text-surface-400" />
          </button>

          {profileOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-surface-200 bg-white shadow-lg z-50 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
                <div className="px-4 py-3 border-b border-surface-100">
                  <p className="text-sm font-semibold text-surface-900 truncate">
                    {profile ? `${profile.first_name} ${profile.last_name}` : 'Local Flow'}
                  </p>
                  <p className="text-xs text-surface-500 truncate">{profile?.email || business?.name}</p>
                </div>
                <div className="p-1.5">
                  <Link
                    to="/profile"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-surface-700 hover:bg-surface-50 transition-colors"
                  >
                    <UserCircle className="h-4 w-4 text-surface-400" />
                    My Profile
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-danger-600 hover:bg-danger-50 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
