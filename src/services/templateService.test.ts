import { describe, it, expect, beforeEach } from 'vitest'
import { resetStore, getStore } from '@/services/demoStore'
import { listTemplates, createTemplate, updateTemplate, deleteTemplate, renderTemplate } from '@/services/templateService'

describe('template service', () => {
  beforeEach(() => {
    resetStore()
  })

  it('lists seeded templates', async () => {
    const res = await listTemplates({ perPage: 100 })
    expect(res.data.length).toBeGreaterThan(0)
  })

  it('creates, updates and deletes a template with activity', async () => {
    const created = await createTemplate({ name: 'Waitlist', channel: 'sms', body: 'Thanks {{customer}}' })
    expect(getStore().messageTemplates.some((t) => t.id === created.id)).toBe(true)
    expect(getStore().activities[0].entity_type).toBe('template')

    const updated = await updateTemplate(created.id, { body: 'New body' })
    expect(updated.body).toBe('New body')

    await deleteTemplate(created.id)
    expect(getStore().messageTemplates.some((t) => t.id === created.id)).toBe(false)
  })

  it('stores no subject for SMS templates', async () => {
    const created = await createTemplate({ name: 'SMS only', channel: 'sms', body: 'Hello' })
    expect(created.subject).toBeNull()
    const email = await createTemplate({ name: 'Email', channel: 'email', subject: 'Hi', body: 'Hello' })
    expect(email.subject).toBe('Hi')
  })

  it('renders placeholders', () => {
    const rendered = renderTemplate({ subject: 'Hi {{customer}}', body: 'Visit {{business}} on {{date}}' }, { customer: 'Ana Reyes', business: 'Siargao Breeze Resort', date: '2026-09-15' })
    expect(rendered.subject).toBe('Hi Ana Reyes')
    expect(rendered.body).toContain('Siargao Breeze Resort')
    expect(rendered.body).toContain('2026-09-15')
  })
})