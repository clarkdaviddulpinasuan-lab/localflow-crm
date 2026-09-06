import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resetSupabaseMock, getTable, setFunctionsInvoke, setCurrentUser, seededBusiness } from '@/test/supabaseMock'
import {
  getBusiness,
  updateBusiness,
  updateProfile,
  getProfile,
  listTeam,
  createInvite,
  listPendingInvites,
  revokeInvite,
  sendInviteEmail,
  updateTeamMember,
  removeTeamMember,
  switchBusiness,
  acceptInvite,
  createMemberAccount,
  leaveBusiness,
  getPreferences,
  defaultPreferences,
  savePreferences,
  getDashboardConfig,
  saveDashboardConfig,
  ROLE_LABELS,
} from '@/services/settingsService'
import { seededProfile } from '@/test/supabaseMock'

vi.mock('@/lib/supabase', () => import('@/test/supabaseMock').then((m) => ({ supabase: m.supabaseMock })))

describe('settings service', () => {
  beforeEach(() => resetSupabaseMock())

  it('reads the seeded business', async () => {
    const business = await getBusiness()
    expect(business.name).toBeTruthy()
    expect(business.team_size).toBeGreaterThan(0)
  })

  it('updates business fields and persists updated_at', async () => {
    const updated = await updateBusiness({ name: 'New Name', location: 'Manila' })
    expect(updated.name).toBe('New Name')
    expect((await getBusiness()).location).toBe('Manila')
    expect(new Date(updated.updated_at).getTime()).not.toBeNaN()
  })

  it('resolves the current profile and updates it', async () => {
    expect((await getProfile()).id).toBe(seededProfile.id)
    await updateProfile({ first_name: 'Ana Maria' })
    expect((await getProfile()).first_name).toBe('Ana Maria')
  })

  it('lists seeded team members', async () => {
    expect((await listTeam()).length).toBeGreaterThan(1)
  })

  it('creates, lists, and revokes an invitation', async () => {
    const invite = await createInvite({ email: 'peer@test.com', role: 'manager' })
    expect(invite.email).toBe('peer@test.com')
    expect(invite.role).toBe('manager')
    expect(invite.status).toBe('pending')
    expect(invite.token).toBeTruthy()

    const pending = await listPendingInvites()
    expect(pending.some((i) => i.email === 'peer@test.com')).toBe(true)

    await revokeInvite(invite.id)
    expect((await listPendingInvites()).some((i) => i.email === 'peer@test.com')).toBe(false)
  })

  it('emails an invite link through the send-invite edge function', async () => {
    const invite = await createInvite({ email: 'peer@test.com', role: 'manager' })
    const seen = vi.fn()
    setFunctionsInvoke(async (fn, opts) => {
      seen(fn, opts)
      return { data: { ok: true, provider: 'dryrun' }, error: null }
    })
    expect(await sendInviteEmail(invite)).toBe(true)
    const [fn, opts] = seen.mock.calls[0]
    expect(fn).toBe('send-invite')
    expect((opts?.body as { invite_id: string }).invite_id).toBe(invite.id)
    expect((opts?.body as { link: string }).link).toContain(`/signup?invite=${invite.token}`)
  })

  it('reports a failed invite email (function error or provider rejection)', async () => {
    const invite = await createInvite({ email: 'peer@test.com', role: 'manager' })
    setFunctionsInvoke(async () => ({ data: { ok: false, error: 'Provider rejected the send.' }, error: null }))
    expect(await sendInviteEmail(invite)).toBe(false)
  })

  it('updates a team member role', async () => {
    const member = (await listTeam())[1]
    const updated = await updateTeamMember(member.id, { role: 'manager' })
    expect(updated?.role).toBe('manager')
  })

  it('removes a team member', async () => {
    const before = await listTeam()
    await removeTeamMember(before[before.length - 1].id)
    expect((await listTeam()).length).toBe(before.length - 1)
  })

  it('provides role labels for each role', () => {
    expect(ROLE_LABELS.owner).toBe('Owner')
    expect(ROLE_LABELS.manager).toBe('Manager')
    expect(ROLE_LABELS.staff).toBe('Staff')
  })

  it('round-trips preferences through localStorage', () => {
    const custom = { ...defaultPreferences(), compactLayout: true, dateFormat: 'DD/MM/YYYY' as const }
    savePreferences(custom)
    expect(getPreferences().compactLayout).toBe(true)
    expect(getPreferences().dateFormat).toBe('DD/MM/YYYY')
  })

  it('returns defaults before any save', () => {
    const prefs = getPreferences()
    expect(prefs.notificationEmail).toBe(true)
    expect(prefs.weeklyDigest).toBe(true)
  })

  it('dashboard config is null until saved, then round-trips through the settings table', async () => {
    expect(await getDashboardConfig()).toBeNull()
    const config = {
      kpiCards: [{ id: 'revenue', label: 'Revenue', icon: 'revenue' as const, positiveIsGood: true, metric: 'revenue' as const, format: 'currency' as const }],
      quickActions: [],
      navLabels: { overview: 'Overview', customers: 'Customers', bookings: 'Bookings', orders: 'Orders' },
      widgets: { insights: false, charts: false },
    }
    await saveDashboardConfig(config)
    const restored = await getDashboardConfig()
    expect(restored).not.toBeNull()
    expect(restored?.widgets).toEqual({ insights: false, charts: false })
    expect(restored?.kpiCards[0].label).toBe('Revenue')
    expect(getTable('settings').length).toBe(1)
  })

  it('rejects switching to a business the user does not belong to', async () => {
    await expect(switchBusiness('biz-nope')).rejects.toThrow('not a member of that business')
    expect((await getProfile()).business_id).toBe(seededBusiness.id)
  })

  it('joins a second business via accept_invite and switches back and forth', async () => {
    getTable('businesses').push({
      id: 'biz-999', name: 'Island Foods Coop', type: 'other',
      created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
    })
    getTable('invitations').push({
      id: 'invite-999', business_id: 'biz-999', email: 'ana@siargaobreeze.com', role: 'staff',
      invited_by: 'user-002', status: 'pending', token: 'tok-999',
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })

    await acceptInvite('tok-999')

    // The joined business becomes the active one.
    expect(getTable('user_current_business').find((r) => r.user_id === 'user-001')?.business_id).toBe('biz-999')
    const joined = await getProfile()
    expect(joined.business_id).toBe('biz-999')
    expect(joined.role).toBe('staff')

    await switchBusiness('biz-001')
    const primary = await getProfile()
    expect(primary.business_id).toBe('biz-001')
    expect(primary.role).toBe('owner')

    // Team listings stay scoped to the active business.
    const team = await listTeam()
    expect(team.every((m) => m.business_id === 'biz-001')).toBe(true)
  })

  it('creates an admin account that joins the active business only', async () => {
    const beforeBusinesses = getTable('businesses').length
    await createMemberAccount({ first_name: 'Nita', last_name: 'New', email: 'nita@test.com', password: 'password123', role: 'staff' })

    const created = getTable('auth_users').find((r) => (r.email as string) === 'nita@test.com')
    expect(created).toBeTruthy()
    expect((created as { raw_user_meta_data?: Record<string, unknown> }).raw_user_meta_data).toMatchObject({ admin_created: true })

    const userId = (created as { id: string }).id
    const createdProfile = getTable('profiles').find((p) => p.user_id === userId)
    expect(createdProfile?.business_id).toBe(seededBusiness.id)
    expect(createdProfile?.role).toBe('staff')
    expect(getTable('user_current_business').find((r) => r.user_id === userId)?.business_id).toBe(seededBusiness.id)
    expect(getTable('businesses').length).toBe(beforeBusinesses)
  })

  it('blocks a manager from creating an owner account', async () => {
    setCurrentUser({ id: 'user-002', email: 'marco@siargaobreeze.com' })
    await expect(
      createMemberAccount({ first_name: 'Boss', last_name: 'Maker', email: 'boss@test.com', password: 'password123', role: 'owner' })
    ).rejects.toThrow('do not have permission')
  })

  it('leaves the active business and moves the preference to a remaining membership', async () => {
    getTable('businesses').push({
      id: 'biz-999', name: 'Island Foods Coop', type: 'other',
      created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
    })
    getTable('profiles').push({
      id: 'profile-999', user_id: 'user-001', business_id: 'biz-999',
      first_name: 'Ana', last_name: 'Reyes', email: 'ana@siargaobreeze.com', role: 'staff',
      created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
    })
    getTable('user_current_business').find((r) => r.user_id === 'user-001')!.business_id = 'biz-999'

    await leaveBusiness()
    const prefs = getTable('user_current_business').find((r) => r.user_id === 'user-001')
    expect(prefs?.business_id).toBe('biz-001')
    expect(getTable('profiles').filter((p) => p.user_id === 'user-001' && p.business_id === 'biz-999')).toHaveLength(0)
    expect(getTable('profiles').filter((p) => p.user_id === 'user-001' && p.business_id === 'biz-001').length).toBeGreaterThan(0)

    await leaveBusiness()
    expect(getTable('profiles').filter((p) => p.user_id === 'user-001')).toHaveLength(0)
    expect(getTable('user_current_business').filter((r) => r.user_id === 'user-001')).toHaveLength(0)
  })

  it('rejects an invite already consumed or for a member of the target business', async () => {
    getTable('invitations').push({
      id: 'invite-existing', business_id: 'biz-001', email: 'ana@siargaobreeze.com', role: 'manager',
      invited_by: 'user-002', status: 'pending', token: 'tok-existing',
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })
    await expect(acceptInvite('tok-existing')).rejects.toThrow('already a member')
    await expect(acceptInvite('tok-gone')).rejects.toThrow('invalid, expired, or already used')
  })
})