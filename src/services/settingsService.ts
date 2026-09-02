import { getStore, updateStore, resetStore, nextId } from '@/services/demoStore'
import { isDemo, notFound, messageFromError, getCurrentBusinessId } from '@/lib/dataClient'
import { isDemoMode, supabase } from '@/lib/supabase'
import type { Business, Profile, UserRole } from '@/types'
import type { DashboardConfigJSON } from '@/config/businessTypes'

export interface Preferences {
  notificationEmail: boolean
  notificationSms: boolean
  notificationPush: boolean
  notifyNewBooking: boolean
  notifyTaskAssigned: boolean
  notifyNewCustomer: boolean
  weeklyDigest: boolean
  marketing: boolean
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'
  weekStartsOn: 'monday' | 'sunday'
  compactLayout: boolean
}

const PREF_KEY = 'localflow:crm:prefs'

export function defaultPreferences(): Preferences {
  return {
    notificationEmail: true,
    notificationSms: false,
    notificationPush: true,
    notifyNewBooking: true,
    notifyTaskAssigned: true,
    notifyNewCustomer: false,
    weeklyDigest: true,
    marketing: false,
    dateFormat: 'MM/DD/YYYY',
    weekStartsOn: 'monday',
    compactLayout: false,
  }
}

export function getPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(PREF_KEY)
    if (raw) {
      return { ...defaultPreferences(), ...(JSON.parse(raw) as Partial<Preferences>) }
    }
  } catch {
    // ignore
  }
  return defaultPreferences()
}

export function savePreferences(prefs: Preferences) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs))
  } catch {
    // ignore
  }
}

export async function getBusiness(): Promise<Business> {
  if (isDemo()) return getStore().business
  const { data, error } = await supabase.from('businesses').select('*').maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to load business'))
  if (!data) notFound('Business')
  return data as Business
}

export async function updateBusiness(patch: Partial<Business>): Promise<Business> {
  if (isDemo()) {
    const store = getStore()
    const updated: Business = { ...store.business, ...patch, updated_at: new Date().toISOString() }
    updateStore((s) => {
      s.business = updated
    })
    return updated
  }
  const { data, error } = await supabase
    .from('businesses')
    .update(patch)
    .select()
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to update business'))
  if (!data) notFound('Business')
  return data as Business
}

export async function getProfile(): Promise<Profile> {
  if (isDemo()) return getStore().profile
  const {
    data: { user },
  } = await supabase.auth.getUser()
  let query = supabase.from('profiles').select('*')
  if (user?.id) query = query.eq('user_id', user.id)
  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to load profile'))
  if (!data) notFound('Profile')
  return data as Profile
}

export async function updateProfile(patch: Partial<Profile>): Promise<Profile> {
  if (isDemo()) {
    const store = getStore()
    const updated: Profile = { ...store.profile, ...patch, updated_at: new Date().toISOString() }
    updateStore((s) => {
      s.profile = updated
      const idx = s.team.findIndex((t) => t.id === updated.id)
      if (idx >= 0) s.team[idx] = updated
    })
    return updated
  }
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .select()
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to update profile'))
  if (!data) notFound('Profile')
  return data as Profile
}

export async function listTeam(): Promise<Profile[]> {
  if (isDemo()) return getStore().team
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: true })
  if (error) throw new Error(messageFromError(error, 'Failed to load team'))
  return (data as Profile[]) ?? []
}

export async function addTeamMember(
  input: Pick<Profile, 'first_name' | 'last_name' | 'email' | 'role'> & Partial<Profile>
): Promise<Profile> {
  if (isDemo()) {
    const business = getStore().business
    const member: Profile = {
      id: nextId('profile'),
      user_id: nextId('user'),
      business_id: business.id,
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email,
      phone: input.phone,
      role: input.role,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    updateStore((s) => {
      s.team.push(member)
      s.business.team_size = s.team.length
    })
    return member
  }

  const businessId = await getCurrentBusinessId()
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      business_id: businessId,
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email,
      phone: input.phone ?? null,
      role: input.role,
    })
    .select()
    .single()
  if (error) throw new Error(messageFromError(error, 'Failed to add team member'))
  return data as Profile
}

export async function updateTeamMember(id: string, patch: Partial<Pick<Profile, 'first_name' | 'last_name' | 'email' | 'phone' | 'role'>>): Promise<Profile | null> {
  if (isDemo()) {
    let result: Profile | null = null
    updateStore((s) => {
      const idx = s.team.findIndex((t) => t.id === id)
      if (idx < 0) return
      const updated = { ...s.team[idx], ...patch, updated_at: new Date().toISOString() }
      s.team[idx] = updated
      if (s.profile.id === id) s.profile = updated
      result = updated
    })
    return result
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to update team member'))
  return (data as Profile) ?? null
}

export async function removeTeamMember(id: string): Promise<void> {
  if (isDemo()) {
    updateStore((s) => {
      s.team = s.team.filter((t) => t.id !== id)
      s.business.team_size = s.team.length
    })
    return
  }
  const { error } = await supabase.from('profiles').delete().eq('id', id)
  if (error) throw new Error(messageFromError(error, 'Failed to remove team member'))
}

const DASHBOARD_CONFIG_KEY = 'dashboard_config'

export async function getDashboardConfig(): Promise<DashboardConfigJSON | null> {
  if (isDemo()) {
    const row = getStore().settings.find((s) => s.key === DASHBOARD_CONFIG_KEY)
    if (!row?.value) return null
    try {
      return JSON.parse(row.value) as DashboardConfigJSON
    } catch {
      return null
    }
  }
  const businessId = await getCurrentBusinessId()
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('business_id', businessId)
    .eq('key', DASHBOARD_CONFIG_KEY)
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to load dashboard configuration'))
  if (!data?.value) return null
  try {
    return JSON.parse(data.value) as DashboardConfigJSON
  } catch {
    return null
  }
}

export async function saveDashboardConfig(config: DashboardConfigJSON): Promise<void> {
  const value = JSON.stringify(config)
  if (isDemo()) {
    updateStore((s) => {
      const idx = s.settings.findIndex((row) => row.key === DASHBOARD_CONFIG_KEY)
      if (idx >= 0) {
        s.settings[idx] = { ...s.settings[idx], value, updated_at: new Date().toISOString() }
      } else {
        s.settings.push({
          id: 'settings-' + DASHBOARD_CONFIG_KEY,
          business_id: s.business.id,
          key: DASHBOARD_CONFIG_KEY,
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
    .eq('key', DASHBOARD_CONFIG_KEY)
    .maybeSingle()
  if (existing?.id) {
    const { error } = await supabase
      .from('settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) throw new Error(messageFromError(error, 'Failed to save dashboard configuration'))
  } else {
    const { error } = await supabase
      .from('settings')
      .insert({ business_id: businessId, key: DASHBOARD_CONFIG_KEY, value })
    if (error) throw new Error(messageFromError(error, 'Failed to save dashboard configuration'))
  }
}

export function resetDemoData(): boolean {
  if (!isDemoMode()) return false
  resetStore()
  return true
}

export async function persistBusinessToSupabase(_business: Business): Promise<void> {
  if (isDemoMode()) return
  await supabase.from('businesses').upsert(_business)
}

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  staff: 'Staff',
}
