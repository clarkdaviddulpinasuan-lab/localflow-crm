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
  currentUser = { id: demoProfile.user_id ?? 'user-001', email: demoProfile.email }
}

export function getTable(name: string): Row[] {
  return tables.get(name) ?? []
}

export function setTable(name: string, rows: Row[]) {
  tables.set(name, rows)
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

  range(from: number, to: number): this {
    this.rows = this.rows.slice(from, to + 1)
    this.count = this.rows.length
    return this
  }

  limit(n: number): this {
    this.rows = this.rows.slice(0, n)
    this.count = this.rows.length
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

  maybeSingle(): { data: Row | null; error: null } {
    this.applyPending()
    return { data: this.rows[0] ?? null, error: null }
  }

  single(): { data: Row | null; error: null; count: number } {
    this.applyPending()
    return { data: this.rows[0] ?? null, error: null, count: this.rows.length }
  }

  // Make the builder awaitable, mirroring `const { data, error } = await query`.
  async then(resolve: (v: TerminalResult) => void) {
    this.applyPending()
    resolve({ data: this.headOnly ? [] : this.rows, count: this.count, error: null })
  }

  insert(payload: Row | Row[]): this {
    const list = Array.isArray(payload) ? payload : [payload]
    const stored = tables.get(this.table) ?? []
    const inserted: Row[] = []
    for (const item of list) {
      const row: Row = {
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
}

type InvokeSignature = (fn: string, opts?: { body?: unknown }) => Promise<{ data: unknown; error: null }>

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