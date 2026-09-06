import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Link2, Check, Send } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Field'
import { listTeam, createInvite, listPendingInvites, revokeInvite, sendInviteEmail, updateTeamMember, removeTeamMember, createMemberAccount, leaveBusiness, ROLE_LABELS } from '@/services/settingsService'
import { can } from '@/utils/permissions'
import { useAuth } from '@/contexts/AuthContext'
import type { Profile, TeamInvite, UserRole } from '@/types'

const roleVariants: Record<UserRole, 'primary' | 'info' | 'warning'> = {
  owner: 'primary',
  manager: 'info',
  staff: 'warning',
}

const memberRoleOptions: { value: UserRole; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'staff', label: 'Staff' },
]

export function TeamPage() {
  const { profile, role, business, refresh } = useAuth()
  const canManage = can(role, 'manage:team')
  const [members, setMembers] = useState<Profile[]>([])
  const [invites, setInvites] = useState<TeamInvite[]>([])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteMode, setInviteMode] = useState<'invite' | 'account'>('invite')
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'staff' as UserRole })
  const [inviteError, setInviteError] = useState('')
  const [accountForm, setAccountForm] = useState({ first_name: '', last_name: '', email: '', password: '', role: 'staff' as UserRole })
  const [accountError, setAccountError] = useState('')
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [resent, setResent] = useState<string | null>(null)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', role: 'staff' as UserRole })
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [leaveError, setLeaveError] = useState('')

  useEffect(() => {
    listTeam().then(setMembers)
    listPendingInvites().then(setInvites).catch(() => setInvites([]))
  }, [])

  function inviteRoleOptions(): { value: UserRole; label: string }[] {
    return role === 'owner' ? memberRoleOptions : memberRoleOptions.filter((o) => o.value !== 'owner')
  }

  async function sendInvite() {
    setInviteError('')
    setNotice('')
    if (!inviteForm.email.trim()) {
      setInviteError('Please enter an email address.')
      return
    }
    try {
      const created = await createInvite({ email: inviteForm.email, role: inviteForm.role })
      await addInviteWithEmail(created)
      setInviteOpen(false)
      setInviteForm({ email: '', role: 'staff' })
      listPendingInvites().then(setInvites).catch(() => setInvites([]))
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Unable to create invitation.')
    }
  }

  async function sendAccount() {
    setAccountError('')
    setNotice('')
    const { first_name, last_name, email, password, role: accountRole } = accountForm
    if (!first_name.trim() || !last_name.trim() || !email.trim()) {
      setAccountError('Please fill in all fields.')
      return
    }
    if (password.length < 8) {
      setAccountError('Password must be at least 8 characters.')
      return
    }
    try {
      await createMemberAccount({ first_name, last_name, email, password, role: accountRole })
      setInviteOpen(false)
      setAccountForm({ first_name: '', last_name: '', email: '', password: '', role: 'staff' })
      setInviteMode('invite')
      setNotice(`Account created for ${email.trim().toLowerCase()} — they can sign in right away.`)
      listTeam().then(setMembers).catch(() => setMembers([]))
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Unable to create account.')
    }
  }

  async function submitLeave() {
    setLeaveError('')
    try {
      await leaveBusiness()
      setConfirmLeave(false)
      await refresh()
      listTeam().then(setMembers).catch(() => setMembers([]))
      listPendingInvites().then(setInvites).catch(() => setInvites([]))
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : 'Unable to leave this business.')
    }
  }

  async function addInviteWithEmail(invite: TeamInvite) {
    const ok = await sendInviteEmail(invite)
    setNotice(
      ok
        ? `Invitation sent to ${invite.email}.`
        : `Invitation created for ${invite.email} but could not be emailed — copy the link below to share it manually.`
    )
  }

  async function resendInvite(invite: TeamInvite) {
    const ok = await sendInviteEmail(invite)
    setNotice(ok ? `Invitation re-sent to ${invite.email}.` : `Could not email ${invite.email} — copy the link below instead.`)
    setResent(ok ? invite.id : null)
    setTimeout(() => setResent(null), 2000)
  }

  async function copyInviteLink(invite: TeamInvite) {
    const link = `${window.location.origin}/signup?invite=${invite.token}`
    try {
      await navigator.clipboard.writeText(link)
      setCopied(invite.id)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Clipboard unavailable; ignore.
    }
  }

  async function removeInvite(invite: TeamInvite) {
    try {
      await revokeInvite(invite.id)
      setInvites((prev) => prev.filter((i) => i.id !== invite.id))
    } catch {
      // RLS or network rejection - silently ignore for now.
    }
  }

  function openEdit(m: Profile) {
    setEditing(m)
    setForm({ first_name: m.first_name, last_name: m.last_name, email: m.email, phone: m.phone ?? '', role: m.role })
    setError('')
    setModalOpen(true)
  }

  async function submit() {
    if (!editing) return
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      setError('Please fill in the required fields.')
      return
    }
    const updated = await updateTeamMember(editing.id, form)
    if (updated) {
      setMembers((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    }
    setModalOpen(false)
  }

  async function confirmRemove() {
    if (!confirmDelete) return
    await removeTeamMember(confirmDelete.id)
    setMembers((prev) => prev.filter((t) => t.id !== confirmDelete.id))
    setConfirmDelete(null)
  }

  const ownerCount = members.filter((m) => m.role === 'owner').length
  const soleOwner = role === 'owner' && ownerCount <= 1

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Manage your staff, roles, and access."
        actions={
          canManage && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setInviteOpen(true)}>
              Invite Member
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

      {canManage && invites.length > 0 && (
        <Card>
          <CardHeader title="Pending invitations" />
          {notice && <p className="mb-3 text-sm text-surface-600 bg-accent-50 rounded-lg px-3 py-2">{notice}</p>}
          <div className="divide-y divide-surface-100">
            {invites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="font-medium text-surface-900">{invite.email}</p>
                  <p className="text-xs text-surface-500">
                    <Badge variant={roleVariants[invite.role]}>{ROLE_LABELS[invite.role]}</Badge>
                    <span className="ml-2">
                      Expires {new Date(invite.expires_at).toLocaleDateString()}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" icon={resent === invite.id ? <Check className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />} onClick={() => resendInvite(invite)}>
                    {resent === invite.id ? 'Sent' : 'Resend'}
                  </Button>
                  <Button variant="secondary" size="sm" icon={copied === invite.id ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />} onClick={() => copyInviteLink(invite)}>
                    {copied === invite.id ? 'Copied' : 'Copy link'}
                  </Button>
                  <Button variant="ghost" size="sm" className="text-danger-600" onClick={() => removeInvite(invite)} aria-label="Revoke invitation">
                    Revoke
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {profile && (
        <Card>
          <div className="flex items-center justify-between gap-4 p-5">
            <div>
              <h3 className="font-semibold text-surface-900">Leave {business?.name ?? 'this business'}</h3>
              <p className="text-sm text-surface-500 mt-1">
                {soleOwner
                  ? 'You are the only owner here. Add another owner before you can leave.'
                  : 'Removes your access to this workspace. You can rejoin later through a new invitation.'}
              </p>
            </div>
            <Button
              variant="danger"
              disabled={soleOwner}
              title={soleOwner ? 'Add another owner first' : undefined}
              onClick={() => setConfirmLeave(true)}
            >
              Leave
            </Button>
          </div>
        </Card>
      )}

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Add a Team Member" size="sm">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-1 p-1 rounded-[10px] bg-surface-100">
            <div className="flex rounded-[8px] overflow-hidden">
              <button
                type="button"
                onClick={() => setInviteMode('invite')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-[8px] transition-colors ${
                  inviteMode === 'invite' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-900'
                }`}
              >
                Invite by link
              </button>
              <button
                type="button"
                onClick={() => setInviteMode('account')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-[8px] transition-colors ${
                  inviteMode === 'account' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-900'
                }`}
              >
                Create account
              </button>
            </div>
          </div>

          {inviteMode === 'invite' ? (
            <>
              <p className="text-sm text-surface-600">
                They&apos;ll receive a link and sign up with their own account, then land directly in your business dashboard.
              </p>
              <Input
                label="Email"
                type="email"
                required
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder="teammate@business.com"
              />
              <Select label="Role" options={inviteRoleOptions()} value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as UserRole })} />
              {inviteError && <p className="text-sm text-danger-600">{inviteError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setInviteOpen(false)}>Cancel</Button>
                <Button onClick={sendInvite}>Send Invite</Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-surface-600">
                Create a full account with a password you share with them. They can sign in immediately — no link needed.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="First name" required value={accountForm.first_name} onChange={(e) => setAccountForm({ ...accountForm, first_name: e.target.value })} />
                <Input label="Last name" required value={accountForm.last_name} onChange={(e) => setAccountForm({ ...accountForm, last_name: e.target.value })} />
              </div>
              <Input label="Email" type="email" required value={accountForm.email} onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })} placeholder="teammate@business.com" />
              <Input label="Password" type="password" required value={accountForm.password} onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })} hint="At least 8 characters." />
              <Select label="Role" options={inviteRoleOptions()} value={accountForm.role} onChange={(e) => setAccountForm({ ...accountForm, role: e.target.value as UserRole })} />
              {accountError && <p className="text-sm text-danger-600">{accountError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setInviteOpen(false)}>Cancel</Button>
                <Button onClick={sendAccount}>Create Account</Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Edit Member" size="sm">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="First name" required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            <Input label="Last name" required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </div>
          <Input label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Select label="Role" options={memberRoleOptions} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })} />
          {error && <p className="text-sm text-danger-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={submit}>Save</Button>
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

      <Modal open={confirmLeave} onClose={() => setConfirmLeave(false)} title={`Leave ${business?.name ?? 'this business'}?`} size="sm">
        <p className="text-sm text-surface-600">
          You&apos;ll lose access to this workspace and its data. If this is your only remaining business, your account will no longer have a workspace.
        </p>
        {leaveError && <p className="text-sm text-danger-600 mt-3">{leaveError}</p>}
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" onClick={() => setConfirmLeave(false)}>Cancel</Button>
          <Button variant="danger" onClick={submitLeave}>Leave business</Button>
        </div>
      </Modal>
    </div>
  )
}