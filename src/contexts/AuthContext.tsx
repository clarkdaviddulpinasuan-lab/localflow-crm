import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, isDemoMode } from '@/lib/supabase'
import type { Business, Profile, UserRole } from '@/types'
import { demoBusiness, demoProfile } from '@/data/demo'

interface AuthContextValue {
  user: { id: string; email: string } | null
  profile: Profile | null
  business: Business | null
  role: UserRole | null
  loading: boolean
  isDemo: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [business, setBusiness] = useState<Business | null>(null)
  const [loading, setLoading] = useState(true)

  const demo = isDemoMode()

  useEffect(() => {
    if (demo) {
      setUser({ id: 'demo-user', email: demoProfile.email })
      setProfile(demoProfile)
      setBusiness(demoBusiness)
      setLoading(false)
      return
    }

    async function loadProfileAndBusiness(userId: string, _email: string) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      if (profileError) throw profileError

      if (profile) {
        setProfile(profile as Profile)
        const { data: business, error: businessError } = await supabase
          .from('businesses')
          .select('*')
          .eq('id', profile.business_id)
          .maybeSingle()
        if (!businessError && business) {
          setBusiness(business as Business)
        }
      }
    }

    async function loadSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setUser({ id: session.user.id, email: session.user.email ?? '' })
          if (!isDemoMode()) {
            await loadProfileAndBusiness(session.user.id, session.user.email ?? '')
          }
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
      if (session && !isDemoMode()) {
        loadProfileAndBusiness(session.user.id, session.user.email ?? '')
      } else if (!session) {
        setProfile(null)
        setBusiness(null)
      }
    })

    return () => {
      subscription?.subscription.unsubscribe()
    }
  }, [demo])

  const signIn = useCallback(
    async (emailValue: string, passwordValue: string) => {
      if (demo) {
        setUser({ id: 'demo-user', email: emailValue || demoProfile.email })
        setProfile(demoProfile)
        setBusiness(demoBusiness)
        return
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: emailValue,
        password: passwordValue,
      })
      if (error) throw error
    },
    [demo]
  )

  const signOut = useCallback(async () => {
    if (demo) {
      setUser(null)
      setProfile(null)
      setBusiness(null)
      return
    }
    await supabase.auth.signOut()
  }, [demo])

  const value = useMemo(
    () => ({
      user,
      profile,
      business,
      role: profile?.role ?? null,
      loading,
      isDemo: demo,
      signIn,
      signOut,
    }),
    [user, profile, business, loading, demo, signIn, signOut]
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
