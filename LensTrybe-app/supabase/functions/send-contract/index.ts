import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STORAGE_PREFIX = 'https://lqafxisymvrazipaozfk.supabase.co/storage/v1/'
function esc(s: unknown) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') }
function nl2br(s: unknown) { return esc(s).replace(/\r?\n/g, '<br>') }
function plain(s: unknown, max = 200) { return String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[<>"]/g, '').trim().slice(0, max) }
function isEmail(s: unknown): s is string { return typeof s === 'string' && s.length <= 254 && /^[^\s@<>,;"'()]+@[^\s@<>,;"'()]+\.[^\s@<>,;"'()]+$/.test(s) }
function fmtDate(d: unknown) { if (!d) return ''; const dt = new Date(String(d).length <= 10 ? d + 'T00:00:00' : String(d)); if (Number.isNaN(dt.getTime())) return ''; return dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) }
function safeStorageUrl(u: unknown): string | null {
  if (typeof u !== 'string' || !u.startsWith(STORAGE_PREFIX)) return null
  try { const p = new URL(u); if (p.protocol !== 'https:' || p.host !== 'lqafxisymvrazipaozfk.supabase.co' || !p.pathname.startsWith('/storage/v1/')) return null; return p.toString() } catch { return null }
}
function jsonRes(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
async function getAuthUser(admin: any, req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  try { const { data, error } = await admin.auth.getUser(token); if (error || !data?.user) return null; return data.user } catch { return null }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonRes({ error: 'Method not allowed' }, 405)

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Only the signed-in creative who owns the contract can send it.
    const user = await getAuthUser(admin, req)
    if (!user) return jsonRes({ error: 'Not authenticated' }, 401)

    let body: any = {}
    try { body = await req.json() } catch { return jsonRes({ error: 'Invalid request' }, 400) }
    // Accept only an id. (Older clients sent the whole record; only its id is used.)
    const contractId = String(body?.contract_id ?? body?.contractId ?? body?.contract?.id ?? '')
    if (!UUID_RE.test(contractId)) return jsonRes({ error: 'contract_id required' }, 400)

    const { data: contract, error: loadErr } = await admin.from('contracts').select('*').eq('id', contractId).maybeSingle()
    if (loadErr) console.error('send-contract load failed', loadErr)
    if (!contract || contract.creative_id !== user.id) return jsonRes({ error: 'Contract not found' }, 404)
    if (!isEmail(contract.client_email)) return jsonRes({ error: 'Add a valid client email to this contract before sending.' }, 400)

    const allowed = await admin.rpc('rate_limit_hit', { p_key: 'send-contract:' + user.id, p_max: 60, p_window_seconds: 3600 })
    if (allowed.error) console.error('send-contract rate limit check failed', allowed.error)
    else if (allowed.data === false) return jsonRes({ error: 'Too many contracts sent recently. Please try again later.' }, 429)

    const { data: prof } = await admin.from('profiles').select('business_name, business_email').eq('id', user.id).maybeSingle()
    const profile: any = prof || {}
    const businessName = profile.business_name || 'Creative'
    const shortId = String(contract.id).slice(0, 8).toUpperCase()
    const isUploaded = contract.contract_type === 'uploaded'

    let attachments: any[] = []
    let downloadSection = ''

    if (isUploaded) {
      // Uploaded contracts: link to the file in our own storage only.
      const fileUrl = safeStorageUrl(contract.contract_file_url)
      if (!fileUrl) return jsonRes({ error: 'This contract file could not be found. Please upload it again.' }, 400)
      downloadSection = `
        <div style="text-align:center;margin:32px 0">
          <a href="${esc(fileUrl)}" style="display:inline-block;background:#1DB954;color:#04120a;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none">
            Download Contract
          </a>
        </div>
      `
    } else {
      // Written contract: generate an HTML attachment. Contract text is plain text, so it is escaped.
      const contractHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Contract</title></head>
<body style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:48px;color:#111">
  <table width="100%" style="margin-bottom:40px">
    <tr>
      <td>
        <div style="font-size:26px;font-weight:800;color:#111;margin-bottom:4px">${esc(businessName)}</div>
        <div style="font-size:13px;color:#666">${esc(profile.business_email ?? '')}</div>
      </td>
      <td style="text-align:right">
        <div style="font-size:30px;font-weight:800;color:#111">CONTRACT</div>
        <div style="font-size:13px;color:#666">#${esc(shortId)}</div>
        <div style="font-size:13px;color:#666">${esc(fmtDate(contract.created_at))}</div>
      </td>
    </tr>
  </table>

  <div style="margin-bottom:24px">
    <div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Between</div>
    <div style="font-size:15px;font-weight:600">${esc(businessName)}</div>
    <div style="font-size:13px;color:#666;margin-top:8px">and</div>
    <div style="font-size:15px;font-weight:600;margin-top:8px">${esc(contract.client_name)}</div>
    <div style="font-size:13px;color:#666">${esc(contract.client_email)}</div>
  </div>

  ${contract.project_name ? `
  <div style="margin-bottom:24px;padding:12px 16px;background:#f9fafb;border-radius:8px">
    <span style="font-size:12px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.06em">Project: </span>
    <span style="font-size:14px;color:#111">${esc(contract.project_name)}</span>
    ${contract.project_date ? `<span style="font-size:13px;color:#666;margin-left:12px">&middot; ${esc(fmtDate(contract.project_date))}</span>` : ''}
  </div>` : ''}

  <div style="border-top:1px solid #e5e7eb;padding-top:24px;margin-bottom:32px;font-size:14px;line-height:1.8;white-space:pre-wrap">${esc(contract.content ?? '')}</div>

  ${contract.notes ? `
  <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px">
    <div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Notes</div>
    <div style="font-size:13px;color:#374151">${nl2br(contract.notes)}</div>
  </div>` : ''}

  <div style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:12px;color:#999;text-align:center">
    This contract was created via LensTrybe &middot; ${esc(businessName)}
  </div>
</body>
</html>`

      attachments = [{
        filename: `Contract-${shortId}.html`,
        content: base64Encode(new TextEncoder().encode(contractHtml)),
      }]
    }

    const emailBody = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#080810;color:#fff;padding:40px 32px;border-radius:12px">
        <div style="margin-bottom:24px"><span style="font-size:22px;font-weight:700;color:#1DB954">LensTrybe</span></div>
        <h2 style="font-size:20px;font-weight:600;color:#fff;margin:0 0 8px">You have a new contract</h2>
        <p style="color:#888;font-size:14px;margin:0 0 24px">
          <strong style="color:#fff">${esc(profile.business_name || 'Your creative')}</strong> has sent you a contract${contract.project_name ? ` for <strong style="color:#fff">${esc(contract.project_name)}</strong>` : ''}.
        </p>
        ${isUploaded
          ? `<p style="color:#888;font-size:13px;margin:0 0 8px">Click the button below to download your contract.</p>${downloadSection}`
          : `<p style="color:#888;font-size:13px;margin:0 0 8px">The contract is attached to this email. Open it in your browser and press <strong style="color:#fff">Ctrl+P</strong> (or Cmd+P on Mac) then select <strong style="color:#fff">Save as PDF</strong> to download it.</p>`
        }
        <p style="color:#555;font-size:12px;margin-top:32px">Sent via LensTrybe &middot; <a href="https://lenstrybe.com" style="color:#1DB954">lenstrybe.com</a></p>
      </div>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'LensTrybe <noreply@mail.lenstrybe.com>',
        to: [contract.client_email],
        reply_to: isEmail(profile.business_email) ? profile.business_email : 'connect@lenstrybe.com',
        subject: `Contract from ${plain(profile.business_name || 'Your Creative', 120)}${contract.project_name ? ' - ' + plain(contract.project_name, 120) : ''}`,
        html: emailBody,
        attachments,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error('send-contract resend error', res.status, data)
      return jsonRes({ error: 'Could not send the contract email. Please try again.' }, 502)
    }
    return jsonRes({ success: true, id: (data as any)?.id ?? null })
  } catch (err) {
    console.error('send-contract failed', err)
    return jsonRes({ error: 'Could not send the contract. Please try again.' }, 500)
  }
})
