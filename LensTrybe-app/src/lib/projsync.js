import { supabase } from '../backend/supabaseClient'

// Projects, pipeline stages, checklist templates and notes on the live database.
// The pages keep editing the local store the way they always have; this file turns the store into
// the rows the live site uses (projects, pipeline_stages, project_checklists, checklist_items,
// creative_tasks, checklist_templates, notes), and a sync in the Shell writes only what changed.
// Every local id is a uuid, so a row keeps the same id on both sides.

export const isUuid = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''))
export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16) }))

// stage colours: the live site keeps hex, the workspace keeps names
const HEX = { grey: '#8b8f9a', blue: '#4aa3ff', mint: '#1DB954', amber: '#f5a524', rose: '#FF2D78', plum: '#9b6bff', green: '#38d16f' }
const NAME = Object.fromEntries(Object.entries(HEX).map(([n, h]) => [h.toLowerCase(), n]))
const colourName = h => NAME[String(h || '').toLowerCase()] || (String(h || '').toLowerCase() === '#f0516d' ? 'rose' : 'grey')
export const DEFAULT_STAGES = [['New enquiry', 'grey'], ['Quote sent', 'blue'], ['Booked', 'mint'], ['In progress', 'amber'], ['Delivered', 'plum'], ['Complete', 'green']]
export const isDoneStage = st => /deliver|complete|done|finished/i.test(st?.n || '')
const MOODS = ['golden', 'cool', 'dusk', 'rose', 'forest', 'night']
const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) }
const day = s => String(s || '').slice(0, 10)
const ago = iso => { if (!iso) return ''; const d = new Date(iso), n = new Date(); const diff = (n - d) / 864e5; if (diff < 1 && d.getDate() === n.getDate()) return 'Today, ' + d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).replace(' ', '').toLowerCase(); if (diff < 2) return 'Yesterday'; return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) }

// ── load ──────────────────────────────────────────────────────────────────────────────────────
export async function loadProjectBundle(uid, people = []) {
  let { data: st, error: e1 } = await supabase.from('pipeline_stages').select('*').eq('creative_id', uid).order('position')
  if (e1) throw new Error(e1.message)
  if (!st?.length) {
    const rows = DEFAULT_STAGES.map(([n, c], i) => ({ id: uuid(), creative_id: uid, name: n, color: HEX[c], position: i }))
    const { data } = await supabase.from('pipeline_stages').insert(rows).select()
    st = (data || rows).sort((a, b) => a.position - b.position)
  }
  const stages = st.map(x => ({ id: x.id, n: x.name || 'Stage', c: colourName(x.color) }))
  let { data: cst } = await supabase.from('content_stages').select('*').eq('creative_id', uid).order('position')
  if (!cst?.length) { const rows = [['Idea', '#8b8f9a'], ['Draft', '#4aa3ff'], ['Scheduled', '#f5a524'], ['Posted', '#1DB954']].map(([n, c], i) => ({ id: uuid(), creative_id: uid, name: n, color: c, position: i })); const { data } = await supabase.from('content_stages').insert(rows).select(); cst = (data || rows).sort((a, b) => a.position - b.position) }
  const [pj, cl, tk, tp, nt, fo, inv, co, cp, ci] = await Promise.all([
    supabase.from('projects').select('*, contact:crm_contacts(id, name, email, company)').eq('creative_id', uid).order('created_at', { ascending: false }).then(r => r.data || []),
    supabase.from('project_checklists').select('*').eq('creative_id', uid).order('position').then(r => r.data || []),
    supabase.from('creative_tasks').select('*').eq('user_id', uid).not('project_id', 'is', null).order('position').then(r => r.data || []),
    supabase.from('checklist_templates').select('*').eq('creative_id', uid).order('created_at').then(r => r.data || []),
    supabase.from('notes').select('*').eq('creative_id', uid).order('pinned', { ascending: false }).order('updated_at', { ascending: false }).then(r => r.data || []),
    supabase.from('inventory_folders').select('*').eq('creative_id', uid).order('position').then(r => r.data || []),
    supabase.from('inventory_items').select('*').eq('creative_id', uid).order('created_at').then(r => r.data || []),
    supabase.from('inventory_checkouts').select('item_id, project_id').eq('creative_id', uid).is('returned_at', null).then(r => r.data || []),
    supabase.from('content_posts').select('*').eq('creative_id', uid).order('scheduled_date').limit(1000).then(r => r.data || []),
    supabase.from('content_ideas').select('*').eq('creative_id', uid).is('converted_post_id', null).order('created_at', { ascending: false }).then(r => r.data || []),
  ])
  const items = cl.length ? await supabase.from('checklist_items').select('*').in('checklist_id', cl.map(c => c.id)).order('position').then(r => r.data || []) : []
  const parts = pj.length ? await supabase.from('project_participants').select('*').in('project_id', pj.map(p => p.id)).then(r => r.data || []) : []
  const stageById = Object.fromEntries(stages.map(x => [x.id, x]))
  const projects = pj.map(p => {
    const x = p.details || {}, em = String(p.contact?.email || x.t || '').toLowerCase()
    const stage = stageById[p.stage_id] ? p.stage_id : stages[0]?.id
    const crew = Array.isArray(x.crew) ? x.crew : parts.filter(q => q.project_id === p.id).map(q => [q.name, q.role ? String(q.role).toLowerCase() : '', q.email].filter(Boolean).join(' · '))
    return {
      id: p.id, n: p.title || 'Project', c: p.contact?.name || x.c || '', d: p.event_date || '', at: p.location || '', stage, k: isDoneStage(stageById[stage]) ? 'done' : 'live',
      type: p.project_type || 'Other', src: p.lead_source || '', v: Number(p.value) || 0, paid: 0, m: x.m || MOODS[hash(p.id) % 6], s: x.s ?? hash(p.id) % 24,
      t: em || x.t || '', contact: p.contact_id || null, brief: p.notes || '', crew, gear: Array.isArray(x.gear) ? x.gear : co.filter(c => c.project_id === p.id).map(c => c.item_id), files: Array.isArray(x.files) ? x.files : [], log: Array.isArray(x.log) ? x.log : [['' + (day(p.created_at) ? new Date(p.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : ''), 'Project created']],
      lists: cl.filter(c => c.project_id === p.id).map(c => ({ id: c.id, n: c.name || 'Checklist', items: items.filter(i => i.checklist_id === c.id).map(i => [i.text || '', i.done ? 1 : 0, i.id]) })),
      tasks: tk.filter(t => t.project_id === p.id).map(t => [t.title || '', t.done ? 1 : 0, t.due_date || '', t.id]),
    }
  })
  const checklistTemplates = tp.map(t => ({ id: t.id, n: t.name || 'Template', items: (Array.isArray(t.items) ? t.items : []).map(String) }))
  const pname = Object.fromEntries(projects.map(p => [p.id, p.n]))
  const notes = nt.map(n => { const person = n.client_ref ? people.find(q => q.id === n.client_ref) : null; return { id: n.id, t: n.title || 'Untitled', body: n.body || '', proj: n.project_id || '', client: n.client_ref || '', on: n.project_id ? (pname[n.project_id] || 'A project') : person ? person.n : n.client_ref || '', to: n.project_id ? '/app/project/' + n.project_id : n.client_ref ? '/app/thread/' + n.client_ref : '', w: ago(n.updated_at || n.created_at), pinned: !!n.pinned, color: n.color || '' } })
  // inventory: folders are the categories, kept by name in the store with their ids alongside
  const gearFolders = Object.fromEntries(fo.map(f => [f.name || 'Other', f.id]))
  const gearCats = fo.map(f => f.name || 'Other')
  const folderName = Object.fromEntries(fo.map(f => [f.id, f.name || 'Other']))
  if (inv.some(i => !i.folder_id || !folderName[i.folder_id]) && !gearCats.includes('Other')) { const id = uuid(); const { error } = await supabase.from('inventory_folders').insert({ id, creative_id: uid, name: 'Other', position: fo.length }); if (!error) { gearCats.push('Other'); gearFolders.Other = id } }
  const gear = inv.map(i => ({ id: i.id, n: i.name || 'Item', c: folderName[i.folder_id] || 'Other', sn: i.sku || '', v: Number(i.unit_value) || 0, ins: i.insured ? 1 : 0, svc: i.service_date || '', note: i.notes || '', kit: i.in_kit ? 1 : 0, packed: i.packed ? 1 : 0, qty: i.quantity ?? 1, reorder: i.reorder_level ?? 0, photo: i.photo_path || '' }))
  // content: stages Idea / Draft / Scheduled / Posted (the live site's defaults) carry the post's state
  const contentStages = cst.map(x => ({ id: x.id, n: x.name || 'Stage' }))
  const stName = Object.fromEntries(contentStages.map(x => [x.id, String(x.n).toLowerCase()]))
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10)
  const PL = { instagram: 'ig', facebook: 'fb', tiktok: 'tt', linkedin: 'li', google: 'gm' }
  const mediaUrl = p => p ? supabase.storage.from('content-media').getPublicUrl(p).data.publicUrl : ''
  const posts = cp.map(p => { const n = stName[p.stage_id] || 'draft'; const st0 = /post/.test(n) ? 'posted' : /sched/.test(n) ? 'scheduled' : /idea/.test(n) ? 'idea' : 'draft'; const d = p.scheduled_date || String(p.created_at || '').slice(0, 10); return { id: p.id, d, time: p.scheduled_time ? String(p.scheduled_time).slice(0, 5) : '', ch: (p.platforms || []).map(x => PL[x] || x).filter(x => ['ig', 'fb', 'tt', 'li', 'gm'].includes(x)), t: p.title || 'Post', body: p.caption || '', kind: p.format || 'image', st: st0 === 'scheduled' && d === today ? 'today' : st0, s: hash(p.id) % 24, m: MOODS[hash(p.id) % 6], cover: mediaUrl(p.media_path), mediaPath: p.media_path || '', tags: p.hashtags || '', notes: p.notes || '', stats: '' } })
  const ideas = ci.map(i => ({ id: i.id, k: i.kind || 'own', t: i.title || 'Idea', why: i.why || '', cap: i.notes || '', ch: (i.platforms || []).map(x => PL[x] || x).filter(x => ['ig', 'fb', 'tt', 'li', 'gm'].includes(x)), s: hash(i.id) % 24, m: MOODS[hash(i.id) % 6], best: '', bd: '' }))
  return { stages, projects, checklistTemplates, notes, gear, posts, ideas, contentStages, gearCats: gearCats.length ? gearCats : ['Bodies', 'Lenses', 'Lights', 'Drones', 'Audio', 'Support', 'Cards'], gearFolders }
}

// ── rows: what the database should hold for the current store ──────────────────────────────────
// Returns Map('table:id' → row). Rows carry no timestamps, so an unchanged item compares equal.
export function rowsOf(uid, s) {
  const out = new Map(), put = (t, row) => out.set(t + ':' + row.id, row)
  const peopleById = Object.fromEntries((s.people || []).map(p => [p.id, p]))
  ;(s.stages || []).forEach((x, i) => { if (isUuid(x.id)) put('pipeline_stages', { id: x.id, creative_id: uid, name: String(x.n || 'Stage').slice(0, 60), color: HEX[x.c] || HEX.grey, position: i }) })
  ;(s.projects || []).forEach(p => {
    if (!isUuid(p.id)) return
    const person = peopleById[p.t]
    put('projects', { id: p.id, creative_id: uid, title: String(p.n || 'Project').slice(0, 200), project_type: p.type || null, stage_id: isUuid(p.stage) ? p.stage : null, event_date: p.d || null, lead_source: p.src || null, value: p.v === '' || p.v == null ? null : Number(p.v) || 0, notes: p.brief || null, location: p.at || null, contact_id: person?.crm?.id || (isUuid(p.contact) ? p.contact : null), details: { crew: p.crew || [], gear: p.gear || [], files: p.files || [], log: (p.log || []).slice(0, 40), t: p.t || '', c: p.c || '', m: p.m, s: p.s } })
    ;(p.lists || []).forEach((l, li) => { if (!isUuid(l.id)) return; put('project_checklists', { id: l.id, creative_id: uid, project_id: p.id, name: String(l.n || 'Checklist').slice(0, 120), position: li }); (l.items || []).forEach((it, ii) => { if (isUuid(it[2])) put('checklist_items', { id: it[2], creative_id: uid, checklist_id: l.id, text: String(it[0] || '').slice(0, 500), done: !!it[1], position: ii }) }) })
    ;(p.tasks || []).forEach((t, ti) => { if (isUuid(t[3])) put('creative_tasks', { id: t[3], user_id: uid, project_id: p.id, kind: 'project', title: String(t[0] || '').slice(0, 300), done: !!t[1], due_date: t[2] || null, position: ti }) })
  })
  const gf = s.gearFolders || {}
  ;(s.gearCats || []).forEach((n, i) => { if (isUuid(gf[n])) put('inventory_folders', { id: gf[n], creative_id: uid, name: String(n).slice(0, 60), position: i }) })
  ;(s.gear || []).forEach(g => { if (isUuid(g.id)) put('inventory_items', { id: g.id, creative_id: uid, folder_id: isUuid(gf[g.c]) ? gf[g.c] : null, name: String(g.n || 'Item').slice(0, 200), sku: g.sn || null, unit_value: Number(g.v) || 0, notes: g.note || null, insured: !!g.ins, service_date: g.svc || null, in_kit: !!g.kit, packed: !!g.packed, quantity: g.qty ?? 1, reorder_level: g.reorder ?? 0, photo_path: g.photo || null }) })
  const CS = s.contentStages || [], csBy = k => (CS.find(x => new RegExp(k, 'i').test(x.n)) || CS[0])?.id || null
  const PLF = { ig: 'instagram', fb: 'facebook', tt: 'tiktok', li: 'linkedin', gm: 'google' }
  ;(s.posts || []).forEach(p => { if (isUuid(p.id)) put('content_posts', { id: p.id, creative_id: uid, stage_id: csBy(p.st === 'posted' ? 'post' : p.st === 'scheduled' || p.st === 'today' ? 'sched' : p.st === 'idea' ? 'idea' : 'draft'), title: String(p.t || 'Post').slice(0, 200), caption: p.body || null, hashtags: p.tags || null, format: p.kind || 'image', platforms: (p.ch || []).map(c => PLF[c] || c), scheduled_date: p.d || null, scheduled_time: p.time || null, media_path: p.mediaPath || null, notes: p.notes || null }) })
  ;(s.ideas || []).forEach(i => { if (isUuid(i.id)) put('content_ideas', { id: i.id, creative_id: uid, title: String(i.t || 'Idea').slice(0, 200), notes: i.cap || null, why: i.why || null, kind: i.k || 'own', platforms: (i.ch || []).map(c => PLF[c] || c) }) })
  ;(s.checklistTemplates || []).forEach(t => { if (isUuid(t.id)) put('checklist_templates', { id: t.id, creative_id: uid, name: String(t.n || 'Template').slice(0, 120), items: (t.items || []).map(x => String(x).slice(0, 500)) }) })
  ;(s.notes || []).forEach(n => { if (isUuid(n.id)) put('notes', { id: n.id, creative_id: uid, title: String(n.t || '').slice(0, 200) || null, body: n.body || null, project_id: isUuid(n.proj) ? n.proj : null, client_ref: n.client ? String(n.client).slice(0, 320) : null, pinned: !!n.pinned, color: n.color || null }) })
  return out
}

// Give anything the pages created without a uuid one. Returns null when nothing needed an id.
export function withIds(s) {
  let changed = false
  const fix = id => { if (isUuid(id)) return id; changed = true; return uuid() }
  const stageMap = {}
  const stages = (s.stages || []).map(x => { const id = fix(x.id); if (id !== x.id) stageMap[x.id] = id; return id === x.id ? x : { ...x, id } })
  const projects = (s.projects || []).map(p => {
    const id = fix(p.id), stage = stageMap[p.stage] || p.stage
    const lists = (p.lists || []).map(l => { const lid = fix(l.id); const its = (l.items || []).map(it => isUuid(it[2]) ? it : (changed = true, [it[0], it[1], uuid()])); return { ...l, id: lid, items: its } })
    const tasks = (p.tasks || []).map(t => isUuid(t[3]) ? t : (changed = true, [t[0], t[1], t[2] || '', uuid()]))
    return { ...p, id, stage, lists, tasks }
  })
  const checklistTemplates = (s.checklistTemplates || []).map(t => { const id = fix(t.id); return id === t.id ? t : { ...t, id } })
  const notes = (s.notes || []).map(n => { const id = fix(n.id); return id === n.id ? n : { ...n, id } })
  const posts = (s.posts || []).map(p => { const id = fix(p.id); return id === p.id ? p : { ...p, id } })
  const ideas = (s.ideas || []).map(i => { const id = fix(i.id); return id === i.id ? i : { ...i, id } })
  const gear = (s.gear || []).map(g => { const id = fix(g.id); return id === g.id ? g : { ...g, id } })
  const gf0 = s.gearFolders || {}, gearFolders = {}
  for (const n of (s.gearCats || [])) { if (isUuid(gf0[n])) gearFolders[n] = gf0[n]; else { gearFolders[n] = uuid(); changed = true } }
  if (Object.keys(gf0).some(n => !(n in gearFolders))) changed = true
  return changed ? { stages, projects, checklistTemplates, notes, gear, gearFolders, posts, ideas } : null
}

// Order matters: parents are written before children and removed after them.
const WRITE = ['pipeline_stages', 'inventory_folders', 'inventory_items', 'content_posts', 'content_ideas', 'projects', 'project_checklists', 'checklist_items', 'creative_tasks', 'checklist_templates', 'notes']
const STAMP = { content_posts: 'updated_at', content_ideas: 'updated_at', inventory_items: 'updated_at', projects: 'updated_at', creative_tasks: 'updated_at', notes: 'updated_at' }
export async function pushDiff(prev, next) {
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  const ups = {}, dels = {}
  for (const [k, row] of next) if (!prev.has(k) || !same(prev.get(k), row)) { const t = k.split(':')[0]; (ups[t] = ups[t] || []).push(row) }
  for (const [k] of prev) if (!next.has(k)) { const [t, id] = k.split(':'); (dels[t] = dels[t] || []).push(id) }
  const now = new Date().toISOString()
  for (const t of WRITE) if (ups[t]?.length) {
    const rows = STAMP[t] ? ups[t].map(r => ({ ...r, [STAMP[t]]: now })) : ups[t]
    const { error } = await supabase.from(t).upsert(rows)
    if (error) throw new Error(t + ': ' + error.message)
  }
  for (const t of [...WRITE].reverse()) if (dels[t]?.length) {
    const { error } = await supabase.from(t).delete().in('id', dels[t])
    if (error) throw new Error(t + ': ' + error.message)
  }
  return Object.keys(ups).length + Object.keys(dels).length
}
