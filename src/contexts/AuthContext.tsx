import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Business, Profile, UserRole } from '@/types'

interface AuthContextValue {
  user: { id: string; email: string } | null
  profile: Profile | null
  business: Business | null
  role: UserRole | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [business, setBusiness] = useState<Business | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
          await loadProfileAndBusiness(session.user.id, session.user.email ?? '')
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
        loadProfileAndBusiness(session.user.id, session.user.email ?? '')
      } else {
        setProfile(null)
        setBusiness(null)
      }
    })

    return () => {
      subscription?.subscription.unsubscribe()
    }
  }, [])

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

  const value = useMemo(
    () => ({
      user,
      profile,
      business,
      role: profile?.role ?? null,
      loading,
      signIn,
      signOut,
    }),
    [user, profile, business, loading, signIn, signOut]
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
