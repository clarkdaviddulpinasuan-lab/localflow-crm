import { describe, it, expect, beforeEach } from 'vitest'
import { resetStore, getStore } from '@/services/demoStore'
import { listCommunications, sendCommunication } from '@/services/communicationService'

describe('communication service', () => {
  beforeEach(() => {
    resetStore()
  })

  it('sends a message and records it in the ledger, activity and notifications', async () => {
    const customer = getStore().customers[0]
    const activitiesBefore = getStore().activities.length
    const notifsBefore = getStore().notifications.length

    await sendCommunication({ customer_id: customer.id, channel: 'sms', body: 'Hi! Enjoy 10% off.' })

    const comms = await listCommunications({ filters: { customer_id: customer.id }, perPage: 100 })
    expect(comms.data.length).toBe(1)
    expect(comms.data[0].status).toBe('sent')
    expect(comms.data[0].channel).toBe('sms')
    expect(getStore().activities.length).toBe(activitiesBefore + 1)
    expect(getStore().activities[0].entity_type).toBe('communication')
    expect(getStore().notifications.length).toBe(notifsBefore + 1)
  })

  it('keeps email subject and drops it for SMS', async () => {
    const customer = getStore().customers[0]
    const email = await sendCommunication({ customer_id: customer.id, channel: 'email', subject: 'Welcome', body: 'Body' })
    expect(email.subject).toBe('Welcome')
    const sms = await sendCommunication({ customer_id: customer.id, channel: 'sms', body: 'Body' })
    expect(sms.subject).toBeNull()
  })

  it('normalizes whitespace in bodies', async () => {
    const customer = getStore().customers[0]
    const comm = await sendCommunication({ customer_id: customer.id, channel: 'sms', body: '  Hi   there   ' })
    expect(comm.body).toBe('Hi there')
  })
})