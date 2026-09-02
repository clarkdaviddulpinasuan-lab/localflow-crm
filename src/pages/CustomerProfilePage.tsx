import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Pencil,
  StickyNote,
  CalendarCheck,
  ShoppingCart,
  ClipboardList,
  Mail,
  Phone,
  Repeat,
  CreditCard,
  CalendarClock,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Badge, getStatusBadge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Textarea, Input, Select } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Skeleton'
import { CustomerForm, type CustomerFormData } from '@/features/customers/CustomerForm'
import { formatCurrency, formatNumber } from '@/utils/format'
import { getCustomer, getCustomerNotes, addCustomerNote, updateCustomer } from '@/services/customerService'
import { listBookings } from '@/services/bookingService'
import { listOrders } from '@/services/orderService'
import { listFollowUps, createFollowUp, completeFollowUp, skipFollowUp } from '@/services/followUpService'
import { analyzeCustomers, SEGMENT_DEFS, type CustomerSegment } from '@/services/segments'
import { listCommunications, sendCommunication } from '@/services/communicationService'
import { listTemplates } from '@/services/templateService'
import { getBusiness } from '@/services/settingsService'
import { getCustomerActivities } from '@/services/activityService'
import type { Customer, Booking, Order, Activity, FollowUp, Communication, MessageTemplate, TemplateChannel } from '@/types'
import { useBusiness } from '@/contexts/BusinessContext'

export function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { terminology } = useBusiness()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [notes, setNotes] = useState<string[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [communications, setCommunications] = useState<Communication[]>([])
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [segment, setSegment] = useState<CustomerSegment | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [editOpen, setEditOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const [followOpen, setFollowOpen] = useState(false)
  const [followDate, setFollowDate] = useState(new Date().toISOString().slice(0, 10))
  const [followNote, setFollowNote] = useState('')
  const [messageOpen, setMessageOpen] = useState(false)
  const [messageChannel, setMessageChannel] = useState<TemplateChannel>('sms')
  const [messageTemplateId, setMessageTemplateId] = useState('')
  const [messageSubject, setMessageSubject] = useState('')
  const [messageBody, setMessageBody] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setLoadError(null)
    let cancelled = false
    const customerId = id
    async function load() {
      let customer: Customer | undefined
      try {
        customer = await getCustomer(customerId)
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load customer')
        return
      }
      if (cancelled) return
      setCustomer(customer ?? null)
      setLoadError(customer ? null : 'not_found')
      if (!customer) return
      const [notesRes, bookingsRes, ordersRes, followRes, segs, activities, comms, tpls, biz] = await Promise.allSettled([
        getCustomerNotes(customerId),
        listBookings({ filters: { customer_id: customerId }, perPage: 10 }),
        listOrders({ filters: { customer_id: customerId }, perPage: 10 }),
        listFollowUps({ filters: { customer_id: customerId }, perPage: 20 }),
        analyzeCustomers(),
        getCustomerActivities(customerId, 20),
        listCommunications({ filters: { customer_id: customerId }, perPage: 20 }),
        listTemplates({ perPage: 100 }),
        getBusiness(),
      ])
      if (cancelled) return
      if (notesRes.status === 'fulfilled') setNotes(notesRes.value.map((n) => n.content))
      if (bookingsRes.status === 'fulfilled') setBookings(bookingsRes.value.data)
      if (ordersRes.status === 'fulfilled') setOrders(ordersRes.value.data)
      if (followRes.status === 'fulfilled') setFollowUps(followRes.value.data)
      if (segs.status === 'fulfilled') setSegment(segs.value.customers.find((x) => x.id === customerId)?.segment ?? null)
      if (activities.status === 'fulfilled') setActivities(activities.value)
      if (comms.status === 'fulfilled') setCommunications(comms.value.data)
      if (tpls.status === 'fulfilled') setTemplates(tpls.value.data)
      if (biz.status === 'fulfilled') setBusinessName(biz.value.name)
    }
    load().finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [id, retryKey])

  async function refreshCommunications() {
    if (!id) return
    const res = await listCommunications({ filters: { customer_id: id }, perPage: 20 })
    setCommunications(res.data)
  }

  async function refreshFollowUps() {
    if (!id) return
    const res = await listFollowUps({ filters: { customer_id: id }, perPage: 20 })
    setFollowUps(res.data)
  }

  async function handleSave(values: CustomerFormData) {
    if (!customer) return
    setSaving(true)
    try {
      await updateCustomer(customer.id, values)
      setCustomer({ ...customer, ...values })
      setEditOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleAddNote() {
    if (!customer || !note.trim()) return
    setSaving(true)
    try {
      await addCustomerNote(customer.id, note.trim())
      setNotes((n) => [note.trim(), ...n])
      setNote('')
      setNoteOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleAddFollowUp() {
    if (!customer || !followDate) return
    setSaving(true)
    try {
      await createFollowUp({ customer_id: customer.id, due_date: followDate, note: followNote.trim() || undefined })
      setFollowOpen(false)
      setFollowNote('')
      await refreshFollowUps()
    } finally {
      setSaving(false)
    }
  }

  async function handleCompleteFollowUp(f: FollowUp) {
    await completeFollowUp(f.id)
    await refreshFollowUps()
  }

  async function handleSkipFollowUp(f: FollowUp) {
    await skipFollowUp(f.id)
    await refreshFollowUps()
  }

  function openNewMessage() {
    setMessageChannel('sms')
    setMessageTemplateId('')
    setMessageSubject('')
    setMessageBody('')
    setMessageOpen(true)
  }

  function applyTemplate(templateId: string) {
    setMessageTemplateId(templateId)
    const tpl = templates.find((t) => t.id === templateId)
    if (!tpl) return
    setMessageChannel(tpl.channel)
    setMessageSubject('')
    setMessageBody(
      tpl.body
        .replace(/{{customer}}/g, customer ? `${customer.first_name} ${customer.last_name}`.trim() : '')
        .replace(/{{business}}/g, businessName)
    )
  }

  async function handleSendMessage() {
    if (!customer || !messageBody.trim()) return
    setSaving(true)
    try {
      await sendCommunication({
        customer_id: customer.id,
        channel: messageChannel,
        subject: messageChannel === 'email' ? messageSubject.trim() || undefined : undefined,
        body: messageBody.trim(),
        template_id: messageTemplateId || undefined,
      })
      setMessageOpen(false)
      await refreshCommunications()
    } finally {
      setSaving(false)
    }
  }

  const insights = useMemo(() => {
    const totalTransactions = bookings.length + orders.length
    const avgTransaction = customer && totalTransactions ? customer.total_spent / totalTransactions : 0
    const daysSinceLastVisit = customer?.last_activity
      ? Math.max(0, Math.floor((Date.now() - new Date(customer.last_activity).getTime()) / 86400000))
      : 0
    const outstanding = orders
      .filter((o) => o.payment_status !== 'paid' && o.payment_status !== 'refunded' && o.status !== 'cancelled')
      .reduce((s, o) => s + o.total, 0)
    return {
      avgTransaction,
      daysSinceLastVisit,
      repeat: !!customer && (customer.visit_count > 1 || bookings.length + orders.length > 1),
      outstanding,
    }
  }, [bookings, orders, customer])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (loadError && !customer) {
    return (
      <div className="space-y-6">
        <Link to="/customers">
          <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>Back to customers</Button>
        </Link>
        <Card>
          <div className="py-16 text-center">
            <h3 className="text-lg font-semibold text-surface-900 mb-1">Couldn't open this customer</h3>
            <p className="text-sm text-surface-500 max-w-md mx-auto mb-6">{loadError}</p>
            <Button onClick={() => setRetryKey((n) => n + 1)}>
              Retry
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="space-y-6">
        <Link to="/customers">
          <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>Back to customers</Button>
        </Link>
        <Card>
          <div className="py-16 text-center">
            <h3 className="text-lg font-semibold text-surface-900 mb-1">Customer not found</h3>
            <p className="text-sm text-surface-500">This customer may have been deleted.</p>
          </div>
        </Card>
      </div>
    )
  }

  const statusBadge = getStatusBadge(customer.status)

  return (
    <div className="space-y-6">
      <Link to="/customers">
        <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>Back to customers</Button>
      </Link>

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Avatar firstName={customer.first_name} lastName={customer.last_name} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-surface-900">
                {customer.first_name} {customer.last_name}
              </h1>
              <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
              <Badge variant="default">{customer.type.replace('_', ' ')}</Badge>
              {segment && (
                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${SEGMENT_DEFS[segment].chip}`}>
                  {SEGMENT_DEFS[segment].label}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm text-surface-500">
              {customer.email && (
                <span className="inline-flex items-center gap-1.5"><Mail className="h-4 w-4" />{customer.email}</span>
              )}
              {customer.phone && (
                <span className="inline-flex items-center gap-1.5"><Phone className="h-4 w-4" />{customer.phone}</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<Mail className="h-4 w-4" />} onClick={openNewMessage}>
              Message
            </Button>
            <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button variant="secondary" icon={<StickyNote className="h-4 w-4" />} onClick={() => setNoteOpen(true)}>
              Add Note
            </Button>
            <Link to={`/bookings?customer=${customer.id}&new=1`}>
              <Button variant="secondary" icon={<CalendarCheck className="h-4 w-4" />}>Create {terminology.bookingLabel}</Button>
            </Link>
            <Link to={`/orders?customer=${customer.id}&new=1`}>
              <Button variant="secondary" icon={<ShoppingCart className="h-4 w-4" />}>Create Order</Button>
            </Link>
            <Link to={`/tasks?customer=${customer.id}&new=1`}>
              <Button variant="secondary" icon={<ClipboardList className="h-4 w-4" />}>Create Task</Button>
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-surface-900 mb-4">Overview</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-surface-500">Total spent</dt>
                <dd className="font-semibold text-surface-900">{formatCurrency(customer.total_spent)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-surface-500">Visits</dt>
                <dd className="font-medium text-surface-900">{formatNumber(customer.visit_count)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-surface-500">Avg. transaction</dt>
                <dd className="font-medium text-surface-900">
                  {insights.avgTransaction ? formatCurrency(insights.avgTransaction) : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-surface-500">Days since last visit</dt>
                <dd className="font-medium text-surface-900">{insights.daysSinceLastVisit} d</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-surface-500">Last activity</dt>
                <dd className="font-medium text-surface-900">
                  {customer.last_activity ? new Date(customer.last_activity).toLocaleDateString() : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-surface-500">Customer since</dt>
                <dd className="font-medium text-surface-900">{new Date(customer.created_at).toLocaleDateString()}</dd>
              </div>
            </dl>

            {insights.repeat && (
              <div className="mt-4 flex items-center gap-2 text-xs font-medium text-success-600">
                <Repeat className="h-4 w-4" />
                Repeat {terminology.customerLabel.toLowerCase()}
              </div>
            )}
            {insights.outstanding > 0 && (
              <div className="mt-2 flex items-center gap-2 text-xs font-medium text-warning-600">
                <CreditCard className="h-4 w-4" />
                {formatCurrency(insights.outstanding)} outstanding
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-surface-900">Follow-ups</h2>
              <Button variant="ghost" size="sm" icon={<CalendarClock className="h-4 w-4" />} onClick={() => setFollowOpen(true)}>
                Schedule
              </Button>
            </div>
            {followUps.length === 0 ? (
              <p className="text-sm text-surface-500">No follow-ups scheduled.</p>
            ) : (
              <ul className="space-y-2">
                {followUps.map((f) => {
                  const overdue = f.status === 'pending' && f.due_date < new Date().toISOString().slice(0, 10)
                  return (
                    <li key={f.id} className="rounded-lg border border-surface-100 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-surface-900">{f.note || 'Follow-up'}</p>
                        <span className={`text-xs font-medium ${overdue ? 'text-danger-600' : 'text-surface-500'}`}>
                          Due {new Date(f.due_date + 'T00:00:00').toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {f.status === 'pending' ? (
                          <>
                            <Badge variant="warning">Pending</Badge>
                            <button onClick={() => handleCompleteFollowUp(f)} className="text-xs font-medium text-success-600 hover:underline">
                              Complete
                            </button>
                            <button onClick={() => handleSkipFollowUp(f)} className="text-xs font-medium text-surface-400 hover:underline">
                              Skip
                            </button>
                          </>
                        ) : (
                          <Badge variant={f.status === 'completed' ? 'success' : 'default'}>
                            {f.status === 'completed' ? 'Completed' : 'Skipped'}
                          </Badge>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-surface-900 mb-4">Notes</h2>
            {notes.length === 0 ? (
              <p className="text-sm text-surface-500">No notes yet.</p>
            ) : (
              <ul className="space-y-3">
                {notes.map((n, i) => (
                  <li key={i} className="text-sm text-surface-700 bg-surface-50 rounded-lg p-3">{n}</li>
                ))}
              </ul>
            )}
            <Button variant="ghost" size="sm" icon={<StickyNote className="h-4 w-4" />} onClick={() => setNoteOpen(true)} className="mt-3">
              Add note
            </Button>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-surface-900 mb-4">Communications</h2>
            {communications.length === 0 ? (
              <p className="text-sm text-surface-500">No messages sent yet.</p>
            ) : (
              <ul className="space-y-2">
                {communications.map((c) => (
                  <li key={c.id} className="rounded-lg border border-surface-100 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={c.channel === 'email' ? 'primary' : 'info'}>{c.channel === 'email' ? 'Email' : 'SMS'}</Badge>
                      <span className="text-xs text-surface-400">{new Date(c.sent_at).toLocaleDateString()}</span>
                    </div>
                    {c.subject && <p className="mt-2 text-sm font-medium text-surface-900">Re: {c.subject}</p>}
                    <p className="mt-1 text-sm text-surface-800 whitespace-pre-line">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-surface-900 mb-4">Bookings</h2>
            {bookings.length === 0 ? (
              <p className="text-sm text-surface-500">No bookings yet.</p>
            ) : (
              <div className="space-y-3">
                {bookings.map((b) => (
                  <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border border-surface-100">
                    <div>
                      <p className="font-medium text-surface-900">{b.resource}</p>
                      <p className="text-xs text-surface-500">{b.date} • {b.start_time}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-surface-900">{formatCurrency(b.amount)}</span>
                      <Badge variant={getStatusBadge(b.status).variant}>{getStatusBadge(b.status).label}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-surface-900 mb-4">Orders</h2>
            {orders.length === 0 ? (
              <p className="text-sm text-surface-500">No orders yet.</p>
            ) : (
              <div className="space-y-3">
                {orders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between p-3 rounded-lg border border-surface-100">
                    <div>
                      <p className="font-medium text-surface-900">{o.items}</p>
                      <p className="text-xs text-surface-500">{o.order_number}</p>
                      {o.booking_id && bookings.find((b) => b.id === o.booking_id) && (
                        <p className="text-xs mt-0.5 inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 font-medium text-primary-700">
                          {(() => {
                            const b = bookings.find((bk) => bk.id === o.booking_id)!
                            return `${b.resource} • ${new Date(b.date + 'T00:00:00').toLocaleDateString()}`
                          })()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-surface-900">{formatCurrency(o.total)}</span>
                      <Badge variant={getStatusBadge(o.status).variant}>{getStatusBadge(o.status).label}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-surface-900 mb-4">Timeline</h2>
            {activities.length === 0 ? (
              <p className="text-sm text-surface-500">No activity yet.</p>
            ) : (
              <ol className="relative border-l border-surface-200 ml-2 space-y-5">
                {activities.map((a) => (
                  <li key={a.id} className="ml-4">
                    <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-primary-500" />
                    <p className="text-xs text-surface-400">{new Date(a.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                    <p className="text-sm text-surface-700 mt-0.5">{a.description}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>

      <CustomerForm key={editOpen ? `open-${customer.id}` : 'closed'} open={editOpen} onClose={() => setEditOpen(false)} onSave={handleSave} initial={customer} loading={saving} />

      <Modal
        open={noteOpen}
        onClose={() => {
          setNoteOpen(false)
          setNote('')
        }}
        title="Add note"
        description="Record a follow-up or important detail about this customer."
      >
        <div className="space-y-4">
          <Textarea
            id="note"
            label="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Prefers ocean view rooms. Allergic to peanuts."
            rows={4}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setNoteOpen(false)}>Cancel</Button>
            <Button onClick={handleAddNote} loading={saving} disabled={!note.trim()}>Save note</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={followOpen}
        onClose={() => {
          setFollowOpen(false)
          setFollowNote('')
        }}
        title="Schedule follow-up"
        description="Set a reminder to reach out to this customer."
      >
        <div className="space-y-4">
          <Input
            id="follow-date"
            label="Due date"
            type="date"
            value={followDate}
            onChange={(e) => setFollowDate(e.target.value)}
          />
          <Textarea
            id="follow-note"
            label="Follow-up note"
            value={followNote}
            onChange={(e) => setFollowNote(e.target.value)}
            placeholder="e.g. Call about the upcoming booking."
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setFollowOpen(false)}>Cancel</Button>
            <Button onClick={handleAddFollowUp} loading={saving} disabled={!followDate}>Schedule</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={messageOpen}
        onClose={() => setMessageOpen(false)}
        title={`Message ${customer.first_name}`}
        description="Compose from a template or write a one-off message."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              id="msg-channel"
              label="Channel"
              value={messageChannel}
              options={[
                { value: 'sms', label: 'SMS' },
                { value: 'email', label: 'Email' },
              ]}
              onChange={(e) => setMessageChannel(e.target.value as TemplateChannel)}
            />
            <Select
              id="msg-template"
              label="Template (optional)"
              value={messageTemplateId}
              options={[{ value: '', label: 'No template' }, ...templates.map((t) => ({ value: t.id, label: t.name }))]}
              onChange={(e) => applyTemplate(e.target.value)}
            />
          </div>
          {messageChannel === 'email' && (
            <Input
              id="msg-subject"
              label="Subject"
              value={messageSubject}
              onChange={(e) => setMessageSubject(e.target.value)}
              placeholder="Subject line"
            />
          )}
          <Textarea
            id="msg-body"
            label="Message"
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            placeholder="Type your message…"
            rows={5}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setMessageOpen(false)}>Cancel</Button>
            <Button onClick={handleSendMessage} loading={saving} disabled={!messageBody.trim()}>Send</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
