import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resetSupabaseMock, getTable } from '@/test/supabaseMock'
import {
  getBusiness,
  updateBusiness,
  updateProfile,
  getProfile,
  listTeam,
  addTeamMember,
  updateTeamMember,
  removeTeamMember,
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

  it('adds a team member', async () => {
    await addTeamMember({ first_name: 'New', last_name: 'Member', email: 'new@test.com', role: 'staff' })
    expect((await listTeam()).some((t) => t.email === 'new@test.com')).toBe(true)
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
})