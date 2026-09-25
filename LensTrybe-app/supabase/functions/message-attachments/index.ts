// Supabase Edge Function: message-attachments
//
// Files in a thread. The message-attachments bucket is private, so every file goes in and comes
// out through this function, which checks who is asking before touching storage.
//
// Two ways in, both checked server side:
//   { token }              the client's portal token, from /portal/:token
//   Authorization: Bearer  the creative's JWT, from the workspace
// Either way the thread must belong to that portal / that creative.
//
// Two actions:
//   multipart/form-data  action=upload, thread_id, [token], file
//       → { path, name, size, type }   stored at <creative_id>/<thread_id>/<uuid>.<ext>
//   application/json     { action: 'sign', thread_id, [token], paths: [...] }
//       → { urls: { [path]: signedUrl } }   one hour, only for paths inside that thread's folder
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const BUCKET = 'message-attachments'
const MAX_BYTES = 50 * 1024 * 1024
const MAX_SIGN = 60
const TTL_SECONDS = 60 * 60
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Anything that runs is out. Everything that opens (photos, PDFs, documents, video, audio, zips) is in.
const BLOCKED_EXT = new Set(['exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'pif', 'jar', 'js', 'mjs', 'vbs', 'vbe', 'ps1', 'psm1', 'sh', 'bash', 'zsh', 'app', 'dmg', 'pkg', 'apk', 'dll', 'sys', 'lnk', 'reg', 'hta', 'cpl', 'msc', 'wsf', 'wsh', 'scpt', 'action', 'xbe', 'deb', 'rpm', 'run', 'bin', 'gadget', 'inf'])

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

type Who = { creative_id: string; thread_id: string; sender: 'creative' | 'client' }

// Works out who is asking and whether they may touch this thread. null = no.
async function resolve(admin: ReturnType<typeof createClient>, req: Request, token: string, threadId: string): Promise<Who | null> {
  if (!UUID_RE.test(threadId)) return null
  if (token) {
    if (!UUID_RE.test(token)) return null
    const { data: p } = await admin.from('client_portals').select('creative_id, client_email').eq('portal_token', token).maybeSingle()
    if (!p) return null
    const { data: t } = await admin.from('message_threads').select('id, creative_id, client_email').eq('id', threadId).maybeSingle()
    if (!t || t.creative_id !== p.creative_id || String(t.client_email || '').toLowerCase() !== String(p.client_email || '').toLowerCase()) return null
    return { creative_id: t.creative_id, thread_id: t.id, sender: 'client' }
  }
  const bearer = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!bearer) return null
  const { data: u } = await admin.auth.getUser(bearer)
  const uid = u?.user?.id
  if (!uid) return null
  const { data: t } = await admin.from('message_threads').select('id, creative_id, client_user_id').eq('id', threadId).maybeSingle()
  if (!t) return null
  if (t.creative_id === uid) return { creative_id: t.creative_id, thread_id: t.id, sender: 'creative' }
  if (t.client_user_id === uid) return { creative_id: t.creative_id, thread_id: t.id, sender: 'client' }
  return null
}

const extOf = (name: string) => { const m = /\.([a-z0-9]{1,8})$/i.exec(name || ''); return m ? m[1].toLowerCase() : '' }
const cleanName = (name: string) => (name || 'file').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120) || 'file'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const supabaseUrl = Deno.env.get('SUPABASE_URL'), serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Not configured' }, 500)
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const ctype = req.headers.get('content-type') || ''
  if (ctype.includes('multipart/form-data')) {
    let form: FormData
    try { form = await req.formData() } catch { return json({ error: 'bad_request' }, 400) }
    const token = String(form.get('token') || ''), threadId = String(form.get('thread_id') || '')
    const file = form.get('file')
    if (!(file instanceof File)) return json({ error: 'No file' }, 400)
    const who = await resolve(admin, req, token, threadId)
    if (!who) return json({ error: 'not_found' }, 404)
    if (file.size <= 0) return json({ error: 'That file is empty.' }, 400)
    if (file.size > MAX_BYTES) return json({ error: 'Files up to 50 MB each.' }, 413)
    const ext = extOf(file.name)
    if (BLOCKED_EXT.has(ext)) return json({ error: 'That kind of file cannot be sent here.' }, 415)
    const name = cleanName(file.name)
    const path = `${who.creative_id}/${who.thread_id}/${crypto.randomUUID()}${ext ? '.' + ext : ''}`
    const type = file.type || 'application/octet-stream'
    const { error } = await admin.storage.from(BUCKET).upload(path, file, { contentType: type, upsert: false })
    if (error) return json({ error: 'Could not save the file. Try again.' }, 500)
    return json({ path, name, size: file.size, type })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'bad_request' }, 400) }
  if (body.action !== 'sign') return json({ error: 'Unknown action' }, 400)
  const token = typeof body.token === 'string' ? body.token : '', threadId = typeof body.thread_id === 'string' ? body.thread_id : ''
  const who = await resolve(admin, req, token, threadId)
  if (!who) return json({ error: 'not_found' }, 404)
  const prefix = `${who.creative_id}/${who.thread_id}/`
  const paths = (Array.isArray(body.paths) ? body.paths : []).filter(p => typeof p === 'string' && p.startsWith(prefix) && !p.includes('..')).slice(0, MAX_SIGN) as string[]
  if (!paths.length) return json({ urls: {} })
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrls([...new Set(paths)], TTL_SECONDS)
  if (error) return json({ error: 'Could not open the files right now.' }, 500)
  const urls: Record<string, string> = {}
  for (const r of data || []) if (r.signedUrl && r.path) urls[r.path] = r.signedUrl
  return json({ urls, ttl: TTL_SECONDS })
})
