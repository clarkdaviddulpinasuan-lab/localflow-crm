// LocalFlow CRM — send-test-email
// Emails a rendered message to an arbitrary address (used by "Test send" in
// Templates). Requires a signed-in user (JWT) to prevent abuse and reads the
// business sender config through RLS. Nothing is persisted.
import { corsPreflight, json, authHeader } from '../_shared/cors.ts'
import { createSupabase, loadSenderConfig, sendEmail } from '../_shared/send.ts'

// Supabase's gateway has already verified the token; decoding the payload is
// enough to learn which user is calling.
function jwtUserId(auth: string): string | null {
  const token = auth.replace(/^Bearer /i, '').trim()
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload?.sub ?? null
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req)
  if (pre) return pre

  try {
    const auth = authHeader(req)
    if (!auth) return json({ ok: false, error: 'You must be signed in to send a test email.' }, 401)

    const supabase = createSupabase(auth)
    const body = await req.json().catch(() => ({}))
    const to: string | undefined = body?.to
    const subject: string = body?.subject ?? ''
    const text: string = body?.body ?? ''
    if (!to || !text) return json({ ok: false, error: 'Both "to" and "body" are required.' }, 400)

    const userId = jwtUserId(auth)
    let config: Record<string, unknown> = {}
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('business_id')
        .eq('user_id', userId)
        .maybeSingle()
      if (profile?.business_id) {
        config = await loadSenderConfig(supabase, profile.business_id as string)
      }
    }

    const result = await sendEmail({
      to,
      subject,
      text,
      fromName: (config.sender_name as string) || 'LocalFlow CRM',
      fromEmail: (config.from_email as string) ?? '',
    })
    return json(result, result.ok ? 200 : 400)
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500)
  }
})