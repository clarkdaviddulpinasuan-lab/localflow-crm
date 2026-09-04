import { notFound, messageFromError, getCurrentBusinessId } from '@/lib/dataClient'
import { supabase } from '@/lib/supabase'
import type { Business, MessageConfig, MessageProvidersConfig, Profile, UserRole } from '@/types'
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
  const { data, error } = await supabase.from('businesses').select('*').maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to load business'))
  if (!data) notFound('Business')
  return data as Business
}

export async function updateBusiness(patch: Partial<Business>): Promise<Business> {
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
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: true })
  if (error) throw new Error(messageFromError(error, 'Failed to load team'))
  return (data as Profile[]) ?? []
}

export async function addTeamMember(
  input: Pick<Profile, 'first_name' | 'last_name' | 'email' | 'role'> & Partial<Profile>
): Promise<Profile> {
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
  const { error } = await supabase.from('profiles').delete().eq('id', id)
  if (error) throw new Error(messageFromError(error, 'Failed to remove team member'))
}

const DASHBOARD_CONFIG_KEY = 'dashboard_config'

export async function getDashboardConfig(): Promise<DashboardConfigJSON | null> {
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

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  staff: 'Staff',
}

const MESSAGE_FROM_KEY = 'message_from'

async function upsertSetting(businessId: string, key: string, value: string): Promise<void> {
  const { data: existing } = await supabase
    .from('settings')
    .select('id')
    .eq('business_id', businessId)
    .eq('key', key)
    .maybeSingle()
  if (existing?.id) {
    const { error } = await supabase
      .from('settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) throw new Error(messageFromError(error, 'Failed to save settings.'))
  } else {
    const { error } = await supabase
      .from('settings')
      .insert({ business_id: businessId, key, value })
    if (error) throw new Error(messageFromError(error, 'Failed to save settings.'))
  }
}

export function defaultMessageConfig(): MessageConfig {
  return {
    sender_name: '',
    from_email: null,
    reply_to_email: null,
    sms_sender_name: null,
  }
}

export async function getMessageConfig(): Promise<MessageConfig> {
  const businessId = await getCurrentBusinessId()
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('business_id', businessId)
    .eq('key', MESSAGE_FROM_KEY)
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to load messaging settings.'))
  if (!data?.value) return defaultMessageConfig()
  try {
    return { ...defaultMessageConfig(), ...(JSON.parse(data.value) as Partial<MessageConfig>) }
  } catch {
    return defaultMessageConfig()
  }
}

export async function saveMessageConfig(config: MessageConfig): Promise<void> {
  const businessId = await getCurrentBusinessId()
  await upsertSetting(businessId, MESSAGE_FROM_KEY, JSON.stringify(config))
}

/**
 * Which provider the Edge Function will actually use. Driven by
 * `VITE_MESSAGE_PROVIDER` (client hint only); the function falls back to
 * dry-run when no provider key is present server-side.
 */
export function getMessageProvidersConfig(): MessageProvidersConfig {
  const provider: MessageProvidersConfig['email']['provider'] =
    import.meta.env.VITE_MESSAGE_PROVIDER === 'resend' ? 'resend' : 'dryrun'
  return { email: { provider, configured: provider === 'resend' } }
}
