import { describe, it, expect, beforeEach, vi } from 'vitest'
vi.mock('@/lib/supabase', () => import('@/test/supabaseMock').then((m) => ({ supabase: m.supabaseMock })))
import { resetSupabaseMock, getTable, setFunctionsInvoke } from '@/test/supabaseMock'
import { sendCommunication, sendTestEmail, dispatchCommunication, listCommunications, normalizeBody } from '@/services/communicationService'
import type { Communication } from '@/types'

describe('communication service', () => {
  beforeEach(() => {
    resetSupabaseMock()
    setFunctionsInvoke(null)
  })

  it('queues the message as pending, then returns it after the edge function delivers it', async () => {
    setFunctionsInvoke(async (_fn, opts) => {
      const body = opts?.body as { communication_id: string }
      const rows = getTable('communications')
      const row = rows.find((r) => (r as { id: string }).id === body.communication_id)
      expect(row).toBeTruthy()
      await new Promise((resolve) => {
        const idx = rows.indexOf(row!)
        rows[idx] = {
          ...(row as Record<string, unknown>),
          status: 'delivered',
          provider: 'dryrun',
          provider_message_id: 'dryrun-abc',
          delivered_at: new Date().toISOString(),
        }
        resolve(null)
      })
      return { data: { ok: true }, error: null }
    })

    const comm = await sendCommunication({
      customer_id: 'cust-001',
      channel: 'email',
      subject: 'Welcome',
      body: 'Hi {{customer}}, welcome aboard',
    })

    expect(comm.status).toBe('delivered')
    expect(comm.provider_message_id).toBe('dryrun-abc')
    expect(comm.subject).toBe('Welcome')
    const stored = getTable('communications').find((r) => (r as { id: string }).id === comm.id)
    expect(stored?.status).toBe('delivered')
  })

  it('records failed status when the provider rejects the send', async () => {
    setFunctionsInvoke(async (_fn, opts) => {
      const body = opts?.body as { communication_id: string }
      const rows = getTable('communications')
      const row = rows.find((r) => (r as { id: string }).id === body.communication_id)!
      const idx = rows.indexOf(row)
      rows[idx] = {
        ...(row as Record<string, unknown>),
        status: 'failed',
        error: 'Resend: sender address not verified',
      }
      return { data: { ok: false, error: 'Resend: sender address not verified' }, error: null }
    })

    const comm = await sendCommunication({ customer_id: 'cust-001', channel: 'email', subject: 'Oops', body: 'body' })
    expect(comm.status).toBe('failed')
    expect(comm.error).toContain('not verified')
    expect(getTable('communications').some((r) => (r as { id: string }).id === comm.id && r.status === 'failed')).toBe(true)
  })

  it('marks the row failed and rethrows when the edge function call itself fails', async () => {
    setFunctionsInvoke(async () => {
      throw new Error('dispatch exploded')
    })

    await expect(
      sendCommunication({ customer_id: 'cust-001', channel: 'email', body: 'will fail' })
    ).rejects.toThrow('dispatch exploded')

    const stored = getTable('communications').find((r) => (r as { id: string }).id !== undefined && r.status === 'failed')
    expect(stored).toBeTruthy()
    expect(stored?.error).toContain('dispatch exploded')
  })

  it('keeps the subject null for SMS and normalizes the body whitespace', async () => {
    const comm = await sendCommunication({
      customer_id: 'cust-001',
      channel: 'sms',
      body: '  Hi   there \r\n   \nbye  ',
    })
    expect(normalizeBody('  Hi   there \r\n   \nbye  ')).toBe('Hi there bye')
    expect(comm.body).toBe(normalizeBody('  Hi   there \r\n   \nbye  '))
    const stored = getTable('communications').find((r) => (r as { id: string }).id === comm.id)
    expect(stored?.subject).toBeNull()
  })

  it('sendTestEmail forwards subject, body and recipient to the edge function', async () => {
    const forwarded = vi.fn()
    setFunctionsInvoke(async (_fn, opts) => {
      forwarded(opts?.body)
      return { data: { ok: true }, error: null }
    })
    await sendTestEmail({ to: 'a@b.com', subject: 'Test', body: 'Hello' })
    expect(forwarded).toHaveBeenCalledWith({ to: 'a@b.com', subject: 'Test', body: 'Hello' })
    expect(getTable('communications').length).toBe(0)
  })

  it('dispatchCommunication invokes send-message with the row id', async () => {
    const seen = vi.fn()
    setFunctionsInvoke(async (fn, opts) => {
      seen(fn, opts)
      return { data: { ok: true }, error: null }
    })
    await dispatchCommunication('comm-1')
    expect(seen).toHaveBeenCalledWith('send-message', { body: { communication_id: 'comm-1' } })
  })

  it('listCommunications returns rows from the ledger', async () => {
    const res = await listCommunications({ filters: { customer_id: 'cust-001' }, perPage: 10 })
    const rows = res.data as Communication[]
    expect(rows.every((r) => r.customer_id === 'cust-001')).toBe(true)
  })
})