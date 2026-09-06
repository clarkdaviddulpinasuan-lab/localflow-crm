import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Business, Profile, UserRole } from '@/types'

interface AuthContextValue {
  user: { id: string; email: string } | null
  profile: Profile | null
  business: Business | null
  memberships: Profile[]
  role: UserRole | null
  loading: boolean
  accessRevoked: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
  switchBusiness: (businessId: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [business, setBusiness] = useState<Business | null>(null)
  const [memberships, setMemberships] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [profileChecked, setProfileChecked] = useState(false)

  const refresh = useCallback(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      setProfile(null)
      setBusiness(null)
      setMemberships([])
      setProfileChecked(false)
      return
    }
    const { data: rows, error: rowsError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: true })
    setProfileChecked(true)
    if (rowsError || !rows) {
      setProfile(null)
      setBusiness(null)
      setMemberships([])
      return
    }
    const memberships = (rows as Profile[]).filter((r) => r.business_id)
    setMemberships(memberships)
    if (memberships.length === 0) {
      setProfile(null)
      setBusiness(null)
      return
    }

    const { data: activeId } = await supabase.rpc('get_current_business')
    let profile = memberships.find((r) => r.business_id === activeId)
    if (!profile) profile = memberships[0]
    setProfile(profile)

    const { data: businessData, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', profile.business_id)
      .maybeSingle()
    if (!businessError && businessData) {
      setBusiness(businessData as Business)
    }
  }, [])

  useEffect(() => {
    async function loadSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setUser({ id: session.user.id, email: session.user.email ?? '' })
          await refresh()
        }
      } catch {
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    loadSession()

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session ? { id: session.user.id, email: session.user.email ?? '' } : null)
      if (session) {
        refresh()
      } else {
        setProfile(null)
        setBusiness(null)
        setMemberships([])
      }
    })

    return () => {
      subscription?.subscription.unsubscribe()
    }
  }, [refresh])

  const signIn = useCallback(async (emailValue: string, passwordValue: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: emailValue,
      password: passwordValue,
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const switchBusiness = useCallback(async (businessId: string) => {
    const { error } = await supabase.rpc('switch_business', { p_business_id: businessId })
    if (error) throw new Error(error.message)
    await refresh()
  }, [refresh])

  const value = useMemo(
    () => ({
      user,
      profile,
      business,
      memberships,
      role: profile?.role ?? null,
      loading,
      accessRevoked: !loading && !!user && profileChecked && memberships.length === 0,
      signIn,
      signOut,
      refresh,
      switchBusiness,
    }),
    [user, profile, business, memberships, loading, profileChecked, signIn, signOut, refresh, switchBusiness]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
