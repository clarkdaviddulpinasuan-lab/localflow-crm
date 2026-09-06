import { notFound, messageFromError, getCurrentBusinessId } from '@/lib/dataClient'
import { supabase } from '@/lib/supabase'
import { withRetry } from '@/lib/withRetry'
import type { Business, MessageConfig, MessageProvidersConfig, Profile, TeamInvite, UserRole } from '@/types'
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

/** sessionStorage key carrying a pending invite token across /signup -> /login */
export const INVITE_STORAGE_KEY = 'lf:invite:token'

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
  const { data, error } = await withRetry(() => supabase.from('businesses').select('*').maybeSingle())
  if (error) throw new Error(messageFromError(error, 'Failed to load business'))
  if (!data) notFound('Business')
  return data as Business
}

export async function updateBusiness(patch: Partial<Business>): Promise<Business> {
  const id = await getCurrentBusinessId()
  const { data, error } = await supabase
    .from('businesses')
    .update(patch)
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to update business'))
  if (!data) notFound('Business')
  return data as Business
}

export async function getProfile(): Promise<Profile> {
  const businessId = await getCurrentBusinessId()
  const { data, error } = await withRetry(() =>
    supabase.from('profiles').select('*').eq('business_id', businessId).maybeSingle()
  )
  if (error) throw new Error(messageFromError(error, 'Failed to load profile'))
  if (!data) notFound('Profile')
  return data as Profile
}

export async function updateProfile(patch: Partial<Profile>): Promise<Profile> {
  const businessId = await getCurrentBusinessId()
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('business_id', businessId)
    .select()
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to update profile'))
  if (!data) notFound('Profile')
  return data as Profile
}

export async function listTeam(): Promise<Profile[]> {
  const businessId = await getCurrentBusinessId()
  const { data, error } = await withRetry(() =>
    supabase.from('profiles').select('*').eq('business_id', businessId).order('created_at', { ascending: true })
  )
  if (error) throw new Error(messageFromError(error, 'Failed to load team'))
  return (data as Profile[]) ?? []
}

export async function createInvite(input: { email: string; role: UserRole }): Promise<TeamInvite> {
  const businessId = await getCurrentBusinessId()
  const { data, error } = await supabase
    .from('invitations')
    .insert({
      business_id: businessId,
      email: input.email.trim().toLowerCase(),
      role: input.role,
    })
    .select()
    .single()
  if (error) throw new Error(messageFromError(error, 'Failed to create invitation'))
  return data as TeamInvite
}

export async function listPendingInvites(): Promise<TeamInvite[]> {
  const { data, error } = await withRetry(() =>
    supabase.from('invitations').select('*').eq('status', 'pending').order('created_at', { ascending: false })
  )
  if (error) throw new Error(messageFromError(error, 'Failed to load invitations'))
  return (data as TeamInvite[]) ?? []
}

export async function revokeInvite(id: string): Promise<void> {
  const { data: invite } = await supabase.from('invitations').select('role').eq('id', id).maybeSingle()
  if (invite?.role && !(await canInviteRole(invite.role as UserRole))) {
    throw new Error('You do not have permission to revoke this invitation.')
  }
  const { error } = await supabase.from('invitations').delete().eq('id', id)
  if (error) throw new Error(messageFromError(error, 'Failed to revoke invitation'))
}

/**
 * Email a pending invitation link to the invitee via the `send-invite` Edge
 * Function. Returns false when the send could not be carried out (no verified
 * sender, provider rejection, or unreachable function), so the UI can fall back
 * to the Copy-link affordance instead of blocking invite creation.
 */
export async function sendInviteEmail(invite: TeamInvite): Promise<boolean> {
  const link = `${window.location.origin}/signup?invite=${invite.token}`
  const result = await supabase.functions.invoke('send-invite', { body: { invite_id: invite.id, link } })
  if (result.error) return false
  return (result.data as { ok?: boolean } | null)?.ok !== false
}

async function canInviteRole(role: UserRole): Promise<boolean> {
  const businessId = await getCurrentBusinessId()
  const me = (await supabase.auth.getUser()).data.user?.id ?? ''
  const { data: profile } = await withRetry(() =>
    supabase.from('profiles').select('role').eq('user_id', me).eq('business_id', businessId).maybeSingle()
  )
  const mine = profile?.role as UserRole | undefined
  return mine === 'owner' || (mine === 'manager' && role !== 'owner')
}

/**
 * Switch the caller's active business (validated server-side against their
 * memberships). Callers should refresh auth/profile state afterwards.
 */
export async function switchBusiness(businessId: string): Promise<void> {
  const { error } = await supabase.rpc('switch_business', { p_business_id: businessId })
  if (error) throw new Error(messageFromError(error, 'Unable to switch business.'))
}

/**
 * Claim a pending invitation with the CALLER's existing account: joins the
 * invited business, consumes the invite, and makes it the active business.
 */
export async function acceptInvite(token: string): Promise<void> {
  const { error } = await supabase.rpc('accept_invite', { p_token: token })
  if (error) throw new Error(messageFromError(error, 'Could not accept this invitation.'))
}

/**
 * Create (or attach) a full account for an email and add it to the caller's
 * active business as the given role. The database enforces privilege: owners
 * may create any role, managers any role except owner.
 */
export async function createMemberAccount(input: {
  first_name: string
  last_name: string
  email: string
  password: string
  role: UserRole
}): Promise<string> {
  const { data: userId, error } = await supabase.rpc('admin_create_member', {
    p_first_name: input.first_name.trim(),
    p_last_name: input.last_name.trim(),
    p_email: input.email.trim().toLowerCase(),
    p_password: input.password,
    p_role: input.role,
  })
  if (error) throw new Error(messageFromError(error, 'Unable to create account.'))
  return String(userId)
}

/**
 * Leave the caller's ACTIVE business. Owners are rejected server-side while
 * they are the last owner; the active preference moves to a remaining
 * business when one exists.
 */
export async function leaveBusiness(): Promise<void> {
  const { error } = await supabase.rpc('leave_business')
  if (error) throw new Error(messageFromError(error, 'Unable to leave this business.'))
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
  const { data, error } = await withRetry(() =>
    supabase
      .from('settings')
      .select('value')
      .eq('business_id', businessId)
      .eq('key', DASHBOARD_CONFIG_KEY)
      .maybeSingle()
  )
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
  const { data, error } = await withRetry(() =>
    supabase
      .from('settings')
      .select('value')
      .eq('business_id', businessId)
      .eq('key', MESSAGE_FROM_KEY)
      .maybeSingle()
  )
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
