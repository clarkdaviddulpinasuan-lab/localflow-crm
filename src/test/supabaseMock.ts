import {
  demoBusiness,
  demoProfile,
  demoTeam,
  demoCustomers,
  demoBookings,
  demoOrders,
  demoTasks,
  demoLeads,
  demoActivities,
  demoNotifications,
  demoSettings,
  demoFollowUps,
  demoMessageTemplates,
  demoCommunications,
} from '@/data/demo'
import type { Business, Profile as ProfileRow, Customer, Booking, Order } from '@/types'

type Row = Record<string, unknown>

export interface MockUser {
  id: string
  email: string
}

let tables = new Map<string, Row[]>()

// Test seam: make the next N query executions against a table reject like a
// transient network failure, so retry paths can be exercised end-to-end.
let transientFailures = new Map<string, { times: number; message: string }>()

// Column defaults mirrored from the real schema for the few tables whose
// defaults are exercised by the services: invitations gets status/token TTLs
// server-side in migration 017.
const TABLE_DEFAULTS: Record<string, () => Row> = {
  invitations: () => ({
    status: 'pending',
    token: randomId(),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }),
}

function randomId(): string {
  return typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}`
}

function getPath(obj: Row, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Row)[key]
    return undefined
  }, obj)
}

function seedTable(key: string, rows: Row[]) {
  tables.set(key, rows.map((r) => ({ ...r })))
}

// Seed datasets are typed domain arrays; coerce once at the boundary.
function demoRows<T>(rows: T[]): Row[] {
  return rows as unknown as Row[]
}

/**
 * Reset the in-memory database to the seeded sample dataset. Call in
 * beforeEach() of each service test.
 */
export function resetSupabaseMock() {
  tables = new Map<string, Row[]>()
  transientFailures = new Map<string, { times: number; message: string }>()
  seedTable('businesses', demoRows([demoBusiness]))
  seedTable('profiles', demoRows([demoProfile, ...demoTeam]))
  seedTable('customers', demoRows(demoCustomers))
  seedTable('bookings', demoRows(demoBookings))
  seedTable('orders', demoRows(demoOrders))
  seedTable('tasks', demoRows(demoTasks))
  seedTable('leads', demoRows(demoLeads))
  seedTable('activities', demoRows(demoActivities))
  seedTable('notifications', demoRows(demoNotifications))
  seedTable('settings', demoRows(demoSettings))
  seedTable('follow_ups', demoRows(demoFollowUps))
  seedTable('message_templates', demoRows(demoMessageTemplates))
  seedTable('communications', demoRows(demoCommunications))
  seedTable('customer_notes', demoRows([]))
  seedTable('resources', demoRows([]))
  seedTable('booking_items', demoRows([]))
  seedTable('invitations', demoRows([]))
  seedTable('auth_users', demoRows([]))
  seedTable('user_current_business', [
    {
      user_id: demoProfile.user_id ?? 'user-001',
      business_id: demoBusiness.id,
      updated_at: new Date().toISOString(),
    },
  ])
  rpcOverrides = new Map<string, RpcSignature | null>()
  currentUser = { id: demoProfile.user_id ?? 'user-001', email: demoProfile.email }
}

// Make the next `times` executions of queries against `table` reject with the
// given message (use a transient-style message to exercise retry paths). Reset
// automatically by resetSupabaseMock().
export function setTransientFailures(table: string, times: number, message: string) {
  transientFailures.set(table, { times, message })
}

export function getTable(name: string): Row[] {
  return tables.get(name) ?? []
}

export function setTable(name: string, rows: Row[]) {
  tables.set(name, rows)
}

/**
 * Mirror of migration-018 helper: active business is the user_current_business
 * row for the user, else their (lone) profile row.
 */
export function activeBusinessOf(userId: string): string | null {
  const prefs = (tables.get('user_current_business') ?? []).find((r) => r.user_id === userId)
  if (prefs) return prefs.business_id as string
  const p = (tables.get('profiles') ?? []).find((r) => r.user_id === userId)
  return p ? (p.business_id as string) : null
}

let currentUser: MockUser | null = null

export function setCurrentUser(user: MockUser | null) {
  currentUser = user
}

type TerminalResult = { data: Row[]; count: number | null; error: null }

function ilikeMatch(pattern: string, value: unknown): boolean {
  const re = new RegExp(`^${String(pattern).replace(/%/g, '.*')}$`, 'i')
  return re.test(String(value ?? ''))
}

function orMatch(rows: Row[], orClause: string): Row[] {
  // PostgREST or syntax used by the services:
  // "field.ilike.%text%,field2.ilike.%text%"
  return rows.filter((r) =>
    orClause.split(',').some((cond) => {
      const match = cond.match(/^(.+?)\.ilike\.(.+)$/)
      if (!match) return false
      return ilikeMatch(match[2], getPath(r, match[1].trim()))
    })
  )
}

class MockBuilder {
  private rows: Row[]
  private table: string
  private count = 0
  private headOnly = false
  private mode: 'query' | 'insert' | 'update' | 'delete' = 'query'

  constructor(table: string, existing: Row[] | null) {
    this.table = table
    if (existing) {
      this.rows = existing
    } else {
      this.rows = []
      tables.set(table, this.rows)
    }
  }

  select(_fields: string, opts?: { count?: 'exact' | 'planned'; head?: boolean }) {
    if (opts?.head) this.headOnly = true
    this.count = this.rows.length
    return this
  }

  eq(col: string, value: unknown): this {
    this.rows = this.rows.filter((r) => {
      const v = getPath(r, col)
      return v === value || String(v ?? '') === String(value ?? '')
    })
    this.count = this.rows.length
    return this
  }

  neq(col: string, value: unknown): this {
    this.rows = this.rows.filter((r) => getPath(r, col) !== value)
    this.count = this.rows.length
    return this
  }

  ilike(col: string, pattern: string): this {
    this.rows = this.rows.filter((r) => ilikeMatch(pattern, getPath(r, col)))
    this.count = this.rows.length
    return this
  }

  or(clause: string): this {
    this.rows = orMatch(this.rows, clause)
    this.count = this.rows.length
    return this
  }

  order(col: string, opts?: { ascending?: boolean }): this {
    const dir = opts?.ascending === false ? -1 : 1
    this.rows = [...this.rows].sort((a, b) => {
      const av = String(getPath(a, col) ?? '')
      const bv = String(getPath(b, col) ?? '')
      return av.localeCompare(bv) * dir
    })
    return this
  }

  // count reflects all matching rows, not the page, mirroring PostgREST's
  // count: 'exact' semantics.
  range(from: number, to: number): this {
    this.rows = this.rows.slice(from, to + 1)
    return this
  }

  limit(n: number): this {
    this.rows = this.rows.slice(0, n)
    return this
  }

  private pendingPatch: Row | null = null

  private applyPending(): void {
    if (this.mode === 'update' && this.pendingPatch) {
      const stored = tables.get(this.table) ?? []
      const updated: Row[] = []
      for (const row of this.rows) {
        const next: Row = { ...row, ...this.pendingPatch, updated_at: new Date().toISOString() }
        const idx = stored.indexOf(row)
        if (idx >= 0) stored[idx] = next
        updated.push(next)
      }
      tables.set(this.table, stored)
      this.rows = updated
      this.count = updated.length
    } else if (this.mode === 'delete') {
      const stored = tables.get(this.table) ?? []
      const toRemove = new Set(this.rows)
      tables.set(this.table, stored.filter((r) => !toRemove.has(r)))
      this.rows = []
      this.count = 0
    }
    this.pendingPatch = null
  }

  maybeSingle(): Promise<{ data: Row | null; error: null }> {
    const failure = transientFailures.get(this.table)
    if (failure && failure.times > 0) {
      failure.times -= 1
      return Promise.reject(new Error(failure.message))
    }
    this.applyPending()
    return Promise.resolve({ data: this.rows[0] ?? null, error: null })
  }

  single(): Promise<{ data: Row | null; error: null; count: number }> {
    const failure = transientFailures.get(this.table)
    if (failure && failure.times > 0) {
      failure.times -= 1
      return Promise.reject(new Error(failure.message))
    }
    this.applyPending()
    return Promise.resolve({ data: this.rows[0] ?? null, error: null, count: this.rows.length })
  }

  // Make the builder awaitable, mirroring `const { data, error } = await query`.
  async then(resolve: (v: TerminalResult) => void, reject: (reason: unknown) => void) {
    const failure = transientFailures.get(this.table)
    if (failure && failure.times > 0) {
      failure.times -= 1
      reject(new Error(failure.message))
      return
    }
    this.applyPending()
    resolve({ data: this.headOnly ? [] : this.rows, count: this.count, error: null })
  }

  insert(payload: Row | Row[]): this {
    const list = Array.isArray(payload) ? payload : [payload]
    const stored = tables.get(this.table) ?? []
    const inserted: Row[] = []
    for (const item of list) {
      const defaults = TABLE_DEFAULTS[this.table]?.() ?? {}
      const row: Row = {
        ...defaults,
        ...item,
        id: (item.id as string) ?? randomId(),
        created_at: (item.created_at as string) ?? new Date().toISOString(),
        updated_at: (item.updated_at as string) ?? new Date().toISOString(),
      }
      stored.push(row)
      inserted.push(row)
    }
    tables.set(this.table, stored)
    this.rows = inserted
    this.count = inserted.length
    this.mode = 'insert'
    return this
  }

  update(patch: Row): this {
    this.pendingPatch = { ...patch }
    this.mode = 'update'
    return this
  }

  delete(): this {
    this.mode = 'delete'
    return this
  }
}

function authMock() {
  const user = () => (currentUser ? { id: currentUser.id, email: currentUser.email } : null)
  return {
    getUser: async () => ({ data: { user: user() } }),
    getSession: async () => ({ data: { session: currentUser ? { user: user() } : null } }),
    signInWithPassword: async ({ email }: { email: string }) => ({ error: email ? null : 'invalid' }),
    signOut: async () => ({ error: null }),
    signUp: async () => ({ data: { session: null }, error: null }),
    resetPasswordForEmail: async () => ({ error: null }),
    updateUser: async () => ({ error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  }
}

export const supabaseMock = {
  from: (table: string) => new MockBuilder(table, tables.get(table) ?? null),
  auth: authMock(),
  functions: {
    invoke: async (fn: string, opts?: { body?: unknown }) => invokeImpl(fn, opts),
  },
  rpc: async (fn: string, args?: Record<string, unknown>) => {
    const override = rpcOverrides.get(fn)
    if (override) return override(args ?? {})
    const core = rpcCores[fn]
    if (!core) return { data: null, error: new Error(`No rpc handler registered for "${fn}" in the mock.`) }
    try {
      return { data: await core(args ?? {}), error: null }
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
    }
  },
}

/**
 * Mock mirrors of the migration-018 RPCs. They read/write the in-memory tables
 * (profiles, user_current_business, invitations, auth_users) so service tests
 * exercise realistic switching / leave / admin-create behavior. Tests may
 * override any of them per call via setRpc().
 */
type RpcCore = (args: Record<string, unknown>) => unknown

function upsertActiveBusiness(userId: string, businessId: string) {
  const stored = tables.get('user_current_business') ?? []
  const idx = stored.findIndex((r) => r.user_id === userId)
  const row = rowWith(rowWith({ user_id: userId, business_id: businessId }, 'created_at'), 'updated_at')
  if (idx >= 0) stored[idx] = row
  else stored.push(row)
  tables.set('user_current_business', stored)
}

function rowWith(base: Row, col: string): Row {
  return { ...base, [col]: base[col] ?? new Date().toISOString() }
}

const rpcCores: Record<string, RpcCore> = {
  get_current_business: () => activeBusinessOf(currentUser?.id ?? ''),

  switch_business: (args) => {
    const uid = currentUser?.id
    if (!uid) throw new Error('Not authenticated.')
    const businessId = args.p_business_id as string
    if (!(tables.get('profiles') ?? []).some((r) => r.user_id === uid && r.business_id === businessId)) {
      throw new Error('You are not a member of that business.')
    }
    upsertActiveBusiness(uid, businessId)
    return null
  },

  accept_invite: (args) => {
    const uid = currentUser?.id
    if (!uid) throw new Error('Not authenticated.')
    const token = args.p_token as string
    const invite = (tables.get('invitations') ?? []).find((r) => r.token === token && r.status === 'pending')
    if (!invite) throw new Error('This invitation is invalid, expired, or already used.')
    const businessId = invite.business_id as string
    const already = (tables.get('profiles') ?? []).some((r) => r.user_id === uid && r.business_id === businessId)
    if (already) throw new Error('You are already a member of that business.')
    invite.status = 'accepted'
    invite.accepted_at = new Date().toISOString()
    invite.accepted_user_id = uid
    ;(tables.get('profiles') ?? []).push({
      user_id: uid,
      business_id: businessId,
      role: invite.role,
      email: currentUser?.email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    upsertActiveBusiness(uid, businessId)
    return null
  },

  leave_business: () => {
    const uid = currentUser?.id
    if (!uid) throw new Error('Not authenticated.')
    const current = activeBusinessOf(uid)
    if (!current) return null
    const storedProfiles = tables.get('profiles') ?? []
    tables.set(
      'profiles',
      storedProfiles.filter((r) => !(r.user_id === uid && r.business_id === current))
    )
    const storedPrefs = tables.get('user_current_business') ?? []
    tables.set(
      'user_current_business',
      storedPrefs.filter((r) => !(r.user_id === uid && r.business_id === current))
    )
    const next = (tables.get('profiles') ?? []).find((r) => r.user_id === uid)
    if (next) upsertActiveBusiness(uid, next.business_id as string)
    return null
  },

  admin_create_member: (args) => {
    const uid = currentUser?.id
    if (!uid) throw new Error('Not authenticated.')
    const businessId = activeBusinessOf(uid)
    if (!businessId) throw new Error('No active business found.')

    const caller = (tables.get('profiles') ?? []).find((r) => r.user_id === uid && r.business_id === businessId)
    const callerRole = caller?.role as string
    const role = args.p_role as string
    const allowed =
      callerRole === 'owner' || (callerRole === 'manager' && role !== 'owner')
    if (!allowed) throw new Error('You do not have permission to create an account with that role.')

    const email = String(args.p_email ?? '').toLowerCase()
    if (!email || !email.includes('@')) throw new Error('A valid email is required.')
    if (String(args.p_password ?? '').length < 8) throw new Error('Password must be at least 8 characters.')

    const existing = (tables.get('auth_users') ?? []).find((r) => (r.email as string)?.toLowerCase() === email)
    const firstName = String(args.p_first_name ?? '')
    const lastName = String(args.p_last_name ?? '')
    const join = (userId: string) => {
      const storedProfiles = tables.get('profiles') ?? []
      if (storedProfiles.some((r) => r.user_id === userId && r.business_id === businessId)) {
        throw new Error('That account is already a member of this business.')
      }
      storedProfiles.push({
        user_id: userId,
        business_id: businessId,
        role,
        email,
        first_name: firstName,
        last_name: lastName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      upsertActiveBusiness(userId, businessId)
    }

    if (existing) {
      join(existing.id as string)
      return existing.id
    }

    const newId = randomId()
    ;(tables.get('auth_users') ?? []).push({
      id: newId,
      email,
      raw_user_meta_data: { admin_created: true, first_name: firstName, last_name: lastName },
    })
    join(newId)
    return newId
  },
}

export type RpcSignature = (args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>

let rpcOverrides = new Map<string, RpcSignature | null>()

/**
 * Override an rpc call for a unit test (or restore the default behavior with
 * `setRpc(name, null)`). Overrides and defaults are reset by resetSupabaseMock().
 */
export function setRpc(name: string, impl: RpcSignature | null) {
  if (impl) rpcOverrides.set(name, impl)
  else rpcOverrides.delete(name)
}

type InvokeSignature = (
  fn: string,
  opts?: { body?: unknown }
) => Promise<{ data: unknown; error: unknown }>

let invokeImpl: InvokeSignature = async () => ({ data: { ok: true }, error: null })

/**
 * Override what `functions.invoke` returns for Edge Function units. Call with
 * a fresh implementation in beforeEach(); reset with
 * `setFunctionsInvoke(null)` to restore the default success response.
 */
export function setFunctionsInvoke(impl: InvokeSignature | null) {
  invokeImpl = impl ?? (async () => ({ data: { ok: true }, error: null }))
}

export const seededBusiness: Business = demoBusiness
export const seededProfile: ProfileRow = demoProfile
export const seededCustomers: Customer[] = demoCustomers
export const seededBookings: Booking[] = demoBookings
export const seededOrders: Order[] = demoOrders