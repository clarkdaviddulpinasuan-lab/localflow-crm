import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Send } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { listTemplates, createTemplate, updateTemplate, deleteTemplate, CHANNEL_LABELS, renderTemplate, customerTemplateValues } from '@/services/templateService'
import { sendTestEmail } from '@/services/communicationService'
import { getBusiness } from '@/services/settingsService'
import type { MessageTemplate, TemplateChannel } from '@/types'

const channelOptions: { value: TemplateChannel; label: string }[] = [
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
]

const EMPTY = { name: '', channel: 'sms' as TemplateChannel, subject: '', body: '' }

export function TemplatesPage() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<MessageTemplate | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<MessageTemplate | null>(null)
  const [testTpl, setTestTpl] = useState<MessageTemplate | null>(null)
  const [testTo, setTestTo] = useState('')
  const [testSubject, setTestSubject] = useState('')
  const [testBody, setTestBody] = useState('')
  const [testSending, setTestSending] = useState(false)
  const [testStatus, setTestStatus] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    listTemplates({ perPage: 100 }).then((res) => setTemplates(res.data))
  }, [])

  function openAdd() {
    setEditing(null)
    setForm({ ...EMPTY })
    setError('')
    setModalOpen(true)
  }

  function openEdit(t: MessageTemplate) {
    setEditing(t)
    setForm({ name: t.name, channel: t.channel, subject: t.subject ?? '', body: t.body })
    setError('')
    setModalOpen(true)
  }

  async function submit() {
    if (!form.name.trim() || !form.body.trim()) {
      setError('Name and message body are required.')
      return
    }
    if (editing) {
      const updated = await updateTemplate(editing.id, {
        name: form.name.trim(),
        channel: form.channel,
        subject: form.subject.trim() || undefined,
        body: form.body.trim(),
      })
      setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } else {
      const created = await createTemplate({
        name: form.name.trim(),
        channel: form.channel,
        subject: form.subject.trim() || undefined,
        body: form.body.trim(),
      })
      setTemplates((prev) => [created, ...prev])
    }
    setModalOpen(false)
  }

  async function confirmRemove() {
    if (!confirmDelete) return
    await deleteTemplate(confirmDelete.id)
    setTemplates((prev) => prev.filter((t) => t.id !== confirmDelete.id))
    setConfirmDelete(null)
  }

  async function openTestSend(t: MessageTemplate) {
    setTestTo('')
    setTestStatus(null)
    setTestTpl(t)
    const biz = await getBusiness().catch(() => null)
    const { subject, body } = renderTemplate(
      t,
      customerTemplateValues({ first_name: 'Sample', last_name: 'Customer' }, biz)
    )
    setTestSubject(subject ?? '')
    setTestBody(body)
  }

  async function handleTestSend() {
    if (!testTpl || !testTo.trim()) return
    setTestSending(true)
    setTestStatus(null)
    try {
      await sendTestEmail({ to: testTo.trim(), subject: testSubject, body: testBody })
      setTestStatus({ ok: true, message: 'Sent — check the inbox for the test email.' })
    } catch (err) {
      setTestStatus({ ok: false, message: err instanceof Error ? err.message : 'Could not send test email.' })
    } finally {
      setTestSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Message templates"
        description="Reusable messages for emails and SMS. Supported placeholders: {{customer}}, {{business}}, {{date}}."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={openAdd}>
            New template
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {templates.length === 0 && (
          <Card className="p-6 col-span-full text-center text-sm text-surface-500">
            No templates yet. Create one to send consistent messages to customers.
          </Card>
        )}
        {templates.map((t) => (
          <Card key={t.id} className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-surface-900 truncate">{t.name}</h3>
              <Badge variant={t.channel === 'email' ? 'primary' : 'info'}>{CHANNEL_LABELS[t.channel]}</Badge>
            </div>
            {t.subject && <p className="text-sm font-medium text-surface-700">Re: {t.subject}</p>}
            <p className="text-sm text-surface-500 line-clamp-3 whitespace-pre-line">{t.body}</p>
            <div className="mt-auto flex items-center gap-2">
              {t.channel === 'email' && (
                <Button variant="secondary" size="sm" icon={<Send className="h-4 w-4" />} onClick={() => openTestSend(t)}>
                  Test send
                </Button>
              )}
              <Button variant="secondary" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => openEdit(t)}>
                Edit
              </Button>
              <Button variant="secondary" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDelete(t)}>
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit template' : 'New template'}
        description="Template bodies and subjects support {{customer}}, {{business}} and {{date}}."
      >
        <div className="space-y-4">
          <Input
            id="tpl-name"
            label="Template name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Booking confirmation"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              id="tpl-channel"
              label="Channel"
              value={form.channel}
              options={channelOptions}
              onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value as TemplateChannel }))}
            />
            {form.channel === 'email' && (
              <Input
                id="tpl-subject"
                label="Subject"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="Subject line"
              />
            )}
          </div>
          <Textarea
            id="tpl-body"
            label="Message"
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            placeholder="Hi this is {{business}}, ..."
            rows={5}
          />
          {error && <p className="text-sm text-danger-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={submit}>Save template</Button>
          </div>
        </div>
      </Modal>

      <Modal open={testTpl !== null} onClose={() => setTestTpl(null)} title={`Test send — ${testTpl?.name ?? ''}`}>
        <div className="space-y-4">
          <p className="text-sm text-surface-600">
            Sends a rendered copy of this template straight to an address you choose.
            Nothing is saved to message history.
          </p>
          <Input
            id="test-to"
            label="To (email address)"
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="you@example.com"
          />
          <div className="rounded-lg border border-surface-100 p-3 space-y-2">
            <p className="text-xs text-surface-400">Rendered preview</p>
            {testSubject && <p className="text-sm font-medium text-surface-900">Re: {testSubject}</p>}
            <p className="text-sm text-surface-700 whitespace-pre-line">{testBody}</p>
          </div>
          {testStatus && (
            <p className={testStatus.ok ? 'text-sm text-success-700' : 'text-sm text-danger-600'}>{testStatus.message}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTestTpl(null)}>Cancel</Button>
            <Button disabled={!testTo.trim() || testSending} icon={<Send className="h-4 w-4" />} onClick={handleTestSend}>
              {testSending ? 'Sending…' : 'Send test'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete template"
      >
        <div className="space-y-4">
          <p className="text-sm text-surface-600">
            Delete "{confirmDelete?.name}"? Messages already sent using it are kept in history.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmRemove}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}