// Files in a thread, both directions. Photos, PDFs, anything that opens, from a phone or a
// computer. Live: every file goes up and comes back through the message-attachments function
// (the bucket is private; a signed link lasts an hour and only the two people in the thread can
// ask for one). Demo: the file stays in the browser as an object URL.
import { supabase } from '../backend/supabaseClient'
import { LIVE } from './mode'

export const MAX_FILES = 10
export const MAX_BYTES = 50 * 1024 * 1024
const BLOCKED = /\.(exe|msi|bat|cmd|com|scr|pif|jar|js|mjs|vbs|vbe|ps1|psm1|sh|bash|zsh|app|dmg|pkg|apk|dll|sys|lnk|reg|hta|cpl|msc|wsf|wsh|scpt|action|xbe|deb|rpm|run|bin|gadget|inf)$/i

export const isImage = a => /^image\//i.test(a?.type || '') || /\.(jpe?g|png|gif|webp|avif|heic|heif|bmp|svg)$/i.test(a?.name || '')
export const isPdf = a => a?.type === 'application/pdf' || /\.pdf$/i.test(a?.name || '')
export const isVideo = a => /^video\//i.test(a?.type || '') || /\.(mp4|mov|m4v|webm)$/i.test(a?.name || '')
export const fmtSize = n => { n = Number(n) || 0; return n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB' }
export const kindOf = a => isImage(a) ? 'Photo' : isPdf(a) ? 'PDF' : isVideo(a) ? 'Video' : (a?.name || '').split('.').pop()?.toUpperCase().slice(0, 5) || 'File'

// Before anything uploads: what is wrong with this set of files, or nothing
export function checkFiles(files, already = 0) {
  if (!files.length) return null
  if (already + files.length > MAX_FILES) return 'Up to ' + MAX_FILES + ' files in one message.'
  for (const f of files) {
    if (f.size > MAX_BYTES) return f.name + ' is over 50 MB. Send a smaller version, or a link to it.'
    if (!f.size) return f.name + ' is empty.'
    if (BLOCKED.test(f.name)) return f.name + ' is a program, not a file to open. It cannot be sent here.'
  }
  return null
}

// ── demo: object URLs, nothing leaves the browser ──
const demoUrls = new Map()

// Upload one file into a thread. ctx = { threadId, token? } (token for the client on the portal).
// Resolves to the attachment record the message carries: { path, name, size, type }.
export async function uploadAttachment(file, ctx, onProgress) {
  if (!LIVE) {
    await new Promise(r => setTimeout(r, 250 + Math.min(600, file.size / 50000)))
    const path = 'demo/' + crypto.randomUUID() + '/' + file.name
    demoUrls.set(path, URL.createObjectURL(file))
    onProgress?.(1)
    return { path, name: file.name, size: file.size, type: file.type || 'application/octet-stream' }
  }
  const form = new FormData()
  form.append('thread_id', ctx.threadId)
  if (ctx.token) form.append('token', ctx.token)
  form.append('file', file, file.name)
  const { data, error } = await supabase.functions.invoke('message-attachments', { body: form })
  if (error) {
    let msg = 'Could not upload ' + file.name + '.'
    try { const j = await error.context?.json?.(); if (j?.error && j.error !== 'not_found') msg = j.error } catch { /* keep the plain message */ }
    throw new Error(msg)
  }
  if (data?.error) throw new Error(data.error)
  onProgress?.(1)
  return data
}

// Signed links for a thread's attachments, cached until shortly before they expire. Every message
// in view asks separately, so asks for the same thread within a moment are folded into one call.
const cache = new Map() // path → { url, exp }
const pending = new Map() // threadId|token → { paths:Set, promise }
function signBatch(ctx) {
  const key = ctx.threadId + '|' + (ctx.token || '')
  let b = pending.get(key)
  if (b) return b
  b = { paths: new Set(), promise: null }
  b.promise = new Promise(res => setTimeout(res, 40)).then(async () => {
    pending.delete(key)
    const need = [...b.paths]
    if (!need.length) return {}
    const urls = {}
    for (let i = 0; i < need.length; i += 50) {
      const { data, error } = await supabase.functions.invoke('message-attachments', { body: { action: 'sign', thread_id: ctx.threadId, token: ctx.token || undefined, paths: need.slice(i, i + 50) } })
      if (error || !data?.urls) continue
      const exp = Date.now() + ((data.ttl || 3600) - 120) * 1000
      for (const [p, u] of Object.entries(data.urls)) { cache.set(p, { url: u, exp }); urls[p] = u }
    }
    return urls
  })
  pending.set(key, b)
  return b
}
export async function signAttachments(paths, ctx) {
  const out = {}, need = []
  const now = Date.now()
  for (const p of paths) {
    if (!LIVE) { const u = demoUrls.get(p); if (u) out[p] = u; continue }
    const c = cache.get(p)
    if (c && c.exp > now) out[p] = c.url; else need.push(p)
  }
  if (!LIVE || !need.length) return out
  const b = signBatch(ctx)
  for (const p of need) b.paths.add(p)
  const urls = await b.promise
  for (const p of need) if (urls[p]) out[p] = urls[p]
  return out
}
