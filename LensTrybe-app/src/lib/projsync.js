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
  const [pj, cl, tk, tp, nt] = await Promise.all([
    supabase.from('projects').select('*, contact:crm_contacts(id, name, email, company)').eq('creative_id', uid).order('created_at', { ascending: false }).then(r => r.data || []),
    supabase.from('project_checklists').select('*').eq('creative_id', uid).order('position').then(r => r.data || []),
    supabase.from('creative_tasks').select('*').eq('user_id', uid).not('project_id', 'is', null).order('position').then(r => r.data || []),
    supabase.from('checklist_templates').select('*').eq('creative_id', uid).order('created_at').then(r => r.data || []),
    supabase.from('notes').select('*').eq('creative_id', uid).order('pinned', { ascending: false }).order('updated_at', { ascending: false }).then(r => r.data || []),
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
      t: em || x.t || '', contact: p.contact_id || null, brief: p.notes || '', crew, gear: Array.isArray(x.gear) ? x.gear : [], files: Array.isArray(x.files) ? x.files : [], log: Array.isArray(x.log) ? x.log : [['' + (day(p.created_at) ? new Date(p.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : ''), 'Project created']],
      lists: cl.filter(c => c.project_id === p.id).map(c => ({ id: c.id, n: c.name || 'Checklist', items: items.filter(i => i.checklist_id === c.id).map(i => [i.text || '', i.done ? 1 : 0, i.id]) })),
      tasks: tk.filter(t => t.project_id === p.id).map(t => [t.title || '', t.done ? 1 : 0, t.due_date || '', t.id]),
    }
  })
  const checklistTemplates = tp.map(t => ({ id: t.id, n: t.name || 'Template', items: (Array.isArray(t.items) ? t.items : []).map(String) }))
  const pname = Object.fromEntries(projects.map(p => [p.id, p.n]))
  const notes = nt.map(n => { const person = n.client_ref ? people.find(q => q.id === n.client_ref) : null; return { id: n.id, t: n.title || 'Untitled', body: n.body || '', proj: n.project_id || '', client: n.client_ref || '', on: n.project_id ? (pname[n.project_id] || 'A project') : person ? person.n : n.client_ref || '', to: n.project_id ? '/app/project/' + n.project_id : n.client_ref ? '/app/thread/' + n.client_ref : '', w: ago(n.updated_at || n.created_at), pinned: !!n.pinned, color: n.color || '' } })
  return { stages, projects, checklistTemplates, notes }
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
  return changed ? { stages, projects, checklistTemplates, notes } : null
}

// Order matters: parents are written before children and removed after them.
const WRITE = ['pipeline_stages', 'projects', 'project_checklists', 'checklist_items', 'creative_tasks', 'checklist_templates', 'notes']
const STAMP = { projects: 'updated_at', creative_tasks: 'updated_at', notes: 'updated_at' }
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
