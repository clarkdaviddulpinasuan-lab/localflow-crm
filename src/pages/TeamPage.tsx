import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Field'
import { listTeam, addTeamMember, updateTeamMember, removeTeamMember, ROLE_LABELS } from '@/services/settingsService'
import { can } from '@/utils/permissions'
import { useAuth } from '@/contexts/AuthContext'
import type { Profile, UserRole } from '@/types'

const roleVariants: Record<UserRole, 'primary' | 'info' | 'warning'> = {
  owner: 'primary',
  manager: 'info',
  staff: 'warning',
}

const roleOptions: { value: UserRole; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'staff', label: 'Staff' },
]

export function TeamPage() {
  const { profile, role } = useAuth()
  const canManage = can(role, 'manage:team')
  const [members, setMembers] = useState<Profile[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', role: 'staff' as UserRole })
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null)

  useEffect(() => {
    listTeam().then(setMembers)
  }, [])

  function openAdd() {
    setEditing(null)
    setForm({ first_name: '', last_name: '', email: '', phone: '', role: 'staff' })
    setError('')
    setModalOpen(true)
  }

  function openEdit(m: Profile) {
    setEditing(m)
    setForm({ first_name: m.first_name, last_name: m.last_name, email: m.email, phone: m.phone ?? '', role: m.role })
    setError('')
    setModalOpen(true)
  }

  async function submit() {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      setError('Please fill in the required fields.')
      return
    }
    if (editing) {
      const updated = await updateTeamMember(editing.id, form)
      if (updated) {
        setMembers((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      }
    } else {
      const created = await addTeamMember(form)
      setMembers((prev) => [...prev, created])
    }
    setModalOpen(false)
  }

  async function confirmRemove() {
    if (!confirmDelete) return
    await removeTeamMember(confirmDelete.id)
    setMembers((prev) => prev.filter((t) => t.id !== confirmDelete.id))
    setConfirmDelete(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Manage your staff, roles, and access."
        actions={
          canManage && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={openAdd}>
              Add Member
            </Button>
          )
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-surface-500">Member</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-surface-500">Contact</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-surface-500">Role</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-surface-500">Joined</th>
                {canManage && <th className="px-4 py-2.5 text-right text-xs font-semibold text-surface-500">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isSelf = m.id === profile?.id
                return (
                  <tr key={m.id} className="border-b border-surface-100">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold uppercase">
                          {m.first_name[0]}{m.last_name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-surface-900">
                            {m.first_name} {m.last_name}
                            {isSelf && <span className="text-surface-400 font-normal"> (you)</span>}
                          </p>
                          <p className="text-xs text-surface-500">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-surface-600">{m.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={roleVariants[m.role]}>{ROLE_LABELS[m.role]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-surface-600">{new Date(m.created_at).toLocaleDateString()}</td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(m)} aria-label="Edit member">
                            Edit
                          </Button>
                          {!isSelf && (
                            <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} className="text-danger-600" onClick={() => setConfirmDelete(m)} aria-label="Remove member">
                              Remove
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Member' : 'Add Team Member'} size="sm">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="First name" required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            <Input label="Last name" required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </div>
          <Input label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Select label="Role" options={roleOptions} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })} />
          {error && <p className="text-sm text-danger-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={submit}>{editing ? 'Save' : 'Add Member'}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Remove member" size="sm">
        <p className="text-sm text-surface-600">
          Are you sure you want to remove <span className="font-medium text-surface-900">{confirmDelete?.first_name} {confirmDelete?.last_name}</span> from your team?
        </p>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" onClick={confirmRemove}>Remove</Button>
        </div>
      </Modal>
    </div>
  )
}
