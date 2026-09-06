// LocalFlow CRM — send-invite
// Emails a pending team-invitation link to the invitee. Invoked by
// `sendInviteEmail()` right after an invite is created (and on "Resend").
//
// Security: the caller's JWT is forwarded, so the RLS `invitations` select
// policy (business-scoped) decides what this function may read. A caller who is
// not a member of the invite's business gets zero rows → 404. The client
// supplies the final link (its own origin) so the function needs no site URL
// config.
//
// Delivery reuses `_shared/send.ts`: Resend when `RESEND_API_KEY` is present,
// deterministic dry-run logging otherwise (keeps local/test runs email-free).
import { corsPreflight, json, authHeader } from '../_shared/cors.ts'
import { createSupabase, loadSenderConfig, sendEmail } from '../_shared/send.ts'

Deno.serve(async (req) => {
  const pre = corsPreflight(req)
  if (pre) return pre

  try {
    const auth = authHeader(req)
    const supabase = createSupabase(auth)

    const body = await req.json().catch(() => ({}))
    const inviteId: string | undefined = body?.invite_id
    const link: string | undefined = body?.link
    if (!inviteId || !link) return json({ ok: false, error: 'invite_id and link are required' }, 400)

    const { data: invite, error } = await supabase
      .from('invitations')
      .select('id, email, role, business_id, invited_by, status')
      .eq('id', inviteId)
      .maybeSingle()
    if (error) return json({ ok: false, error: error.message }, 400)
    if (!invite || invite.status !== 'pending') {
      return json({ ok: false, error: 'Invitation not found' }, 404)
    }

    const { data: business } = await supabase
      .from('businesses')
      .select('name')
      .eq('id', invite.business_id)
      .maybeSingle()
    const { data: inviter } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('user_id', invite.invited_by)
      .maybeSingle()

    const businessName = (business?.name as string)?.trim() || 'their business'
    const inviterName =
      inviter && String(inviter.first_name).trim()
        ? `${String(inviter.first_name).trim()} ${String(inviter.last_name).trim()}`.trim()
        : 'A team member'

    const config = await loadSenderConfig(supabase, invite.business_id as string)
    const result = await sendEmail({
      to: String(invite.email),
      subject: `${inviterName} invited you to ${businessName}`,
      text:
        `You've been invited to ${businessName} on LocalFlow.\n\n` +
        'Create your account here to join the team:\n' +
        `${link}\n\n` +
        'This invitation expires in 7 days. If you think you received this in error, you can ignore it.',
      fromName: (config.sender_name as string) || 'LocalFlow CRM',
      fromEmail: (config.from_email as string) ?? '',
    })

    return json(result, result.ok ? 200 : 400)
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500)
  }
})