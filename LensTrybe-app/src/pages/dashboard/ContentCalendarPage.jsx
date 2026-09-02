import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import {
  CONTENT_CSS, PLATFORMS, PLATFORM_MAP, DEFAULT_CONTENT_STAGES, STAGE_COLORS,
  FORMATS, prettyDate, darken, initials,
} from '../../lib/contentShared'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

const BLANK = { title: '', platforms: [], format: '', scheduled_date: '', scheduled_time: '', stage_id: '', caption: '', hashtags: '', notes: '', assigned_to: '' }

export default function ContentCalendarPage() {
  const { user } = useAuth()
  const { tier } = useSubscription()
  const canAssign = ['expert', 'elite'].includes((tier || '').toLowerCase())

  const [loading, setLoading] = useState(true)
  const [stages, setStages] = useState([])
  const [posts, setPosts] = useState([])
  const [team, setTeam] = useState([])
  const [view, setView] = useState('board')
  const [search, setSearch] = useState('')
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [menu, setMenu] = useState(null)
  const [toast, setToast] = useState(null)

  const [showCard, setShowCard] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)

  const dragCard = useRef(null)
  const dragCol = useRef(null)
  const didDrag = useRef(false)

  useEffect(() => { if (user) init() }, [user])
  useEffect(() => {
    function close() { setMenu(null) }
    if (menu) { window.addEventListener('click', close); return () => window.removeEventListener('click', close) }
  }, [menu])

  function flash(msg, type = 'ok') { setToast({ msg, type }); setTimeout(() => setToast(null), 2400) }
  function photoUrl(path) { return path ? supabase.storage.from('content-media').getPublicUrl(path).data.publicUrl : null }

  async function init() {
    setLoading(true)
    let { data: st } = await supabase.from('content_stages').select('*').eq('creative_id', user.id).order('position', { ascending: true })
    if (!st || st.length === 0) {
      const rows = DEFAULT_CONTENT_STAGES.map((s, i) => ({ creative_id: user.id, name: s.name, color: s.color, position: i }))
      const { data: seeded } = await supabase.from('content_stages').insert(rows).select()
      st = (seeded || []).sort((a, b) => a.position - b.position)
    }
    setStages(st || [])
    const [pr, tm] = await Promise.all([
      supabase.from('content_posts').select('*').eq('creative_id', user.id).order('created_at', { ascending: false }),
      supabase.from('team_members').select('id, name, avatar_url').eq('creative_id', user.id),
    ])
    setPosts(pr.data || [])
    setTeam(tm.data || [])
    setLoading(false)
  }

  const memberName = useMemo(() => { const m = {}; team.forEach(t => { m[t.id] = t.name }); return m }, [team])

  const q = search.trim().toLowerCase()
  const filtered = useMemo(() => posts.filter(p => !q ||
    (p.title || '').toLowerCase().includes(q) ||
    (p.caption || '').toLowerCase().includes(q) ||
    (p.hashtags || '').toLowerCase().includes(q)), [posts, q])

  // ── Card modal ──
  function openNew(prefill = {}) {
    setEditing(null)
    setForm({ ...BLANK, stage_id: stages[0]?.id || '', ...prefill })
    setFile(null); setPreview(null); setShowCard(true)
  }
  function openEdit(p) {
    setEditing(p)
    setForm({
      title: p.title || '', platforms: p.platforms || [], format: p.format || '',
      scheduled_date: p.scheduled_date || '', scheduled_time: p.scheduled_time || '', stage_id: p.stage_id || '',
      caption: p.caption || '', hashtags: p.hashtags || '', notes: p.notes || '', assigned_to: p.assigned_to || '',
    })
    setFile(null); setPreview(p.media_path ? photoUrl(p.media_path) : null); setShowCard(true)
  }
  function pickFile(f) { if (!f) return; setFile(f); setPreview(URL.createObjectURL(f)) }
  function togglePlatform(k) { setForm(f => ({ ...f, platforms: f.platforms.includes(k) ? f.platforms.filter(x => x !== k) : [...f.platforms, k] })) }

  async function saveCard() {
    setSaving(true)
    let media_path = editing ? editing.media_path : null
    if (file) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const up = await supabase.storage.from('content-media').upload(path, file, { upsert: false })
      if (up.error) { setSaving(false); flash('Image upload failed', 'err'); return }
      media_path = path
    }
    const payload = {
      creative_id: user.id,
      stage_id: form.stage_id || stages[0]?.id || null,
      title: form.title.trim() || null,
      platforms: form.platforms,
      format: form.format || null,
      scheduled_date: form.scheduled_date || null,
      scheduled_time: form.scheduled_time || null,
      caption: form.caption || null,
      hashtags: form.hashtags || null,
      notes: form.notes || null,
      assigned_to: canAssign ? (form.assigned_to || null) : (editing ? editing.assigned_to : null),
      media_path,
      updated_at: new Date().toISOString(),
    }
    let error
    if (editing) ({ error } = await supabase.from('content_posts').update(payload).eq('id', editing.id))
    else ({ error } = await supabase.from('content_posts').insert(payload))
    setSaving(false)
    if (error) { flash(error.message, 'err'); return }
    setShowCard(false)
    flash(editing ? 'Post updated' : 'Post added')
    init()
  }
  async function deleteCard() {
    if (!editing) return
    if (editing.media_path) await supabase.storage.from('content-media').remove([editing.media_path]).catch(() => {})
    await supabase.from('content_posts').delete().eq('id', editing.id)
    setShowCard(false)
    flash('Post deleted')
    init()
  }

  async function moveCard(postId, stageId) {
    const p = posts.find(x => x.id === postId)
    if (!p || p.stage_id === stageId) return
    setPosts(prev => prev.map(x => x.id === postId ? { ...x, stage_id: stageId } : x))
    await supabase.from('content_posts').update({ stage_id: stageId, updated_at: new Date().toISOString() }).eq('id', postId)
  }

  // ── Stages ──
  async function renameStage(id, name) {
    const clean = (name || '').trim()
    const st = stages.find(s => s.id === id)
    if (!st || !clean || clean === st.name) { setStages(s => [...s]); return }
    setStages(prev => prev.map(s => s.id === id ? { ...s, name: clean } : s))
    await supabase.from('content_stages').update({ name: clean }).eq('id', id)
  }
  async function recolourStage(id, color) {
    setStages(prev => prev.map(s => s.id === id ? { ...s, color } : s))
    await supabase.from('content_stages').update({ color }).eq('id', id)
  }
  async function addStage() {
    const pos = stages.length
    const color = STAGE_COLORS[pos % STAGE_COLORS.length]
    const { data, error } = await supabase.from('content_stages').insert({ creative_id: user.id, name: 'New column', color, position: pos }).select().single()
    if (error) { flash(error.message, 'err'); return }
    setStages(prev => [...prev, data])
    setTimeout(() => { const el = document.querySelector(`[data-stagename="${data.id}"]`); if (el) { el.scrollIntoView({ behavior: 'smooth', inline: 'end' }); el.focus(); document.getSelection().selectAllChildren(el) } }, 60)
  }
  async function persistOrder(list) { await Promise.all(list.map((s, i) => supabase.from('content_stages').update({ position: i }).eq('id', s.id))) }
  async function reorderStage(fromId, toId) {
    if (fromId === toId) return
    const arr = [...stages]; const from = arr.findIndex(s => s.id === fromId); const to = arr.findIndex(s => s.id === toId)
    if (from < 0 || to < 0) return
    const [m] = arr.splice(from, 1); arr.splice(to, 0, m); setStages(arr); await persistOrder(arr)
  }
  function moveStageBy(id, dir) {
    const i = stages.findIndex(s => s.id === id); const j = i + dir
    if (i < 0 || j < 0 || j >= stages.length) return
    const arr = [...stages];[arr[i], arr[j]] = [arr[j], arr[i]]; setStages(arr); persistOrder(arr)
  }
  async function deleteStage(id) {
    if (posts.some(p => p.stage_id === id)) { flash('Move its posts out first', 'err'); return }
    setStages(prev => prev.filter(s => s.id !== id))
    await supabase.from('content_stages').delete().eq('id', id)
    await persistOrder(stages.filter(s => s.id !== id))
  }

  function PlatChips({ list }) {
    if (!list || !list.length) return null
    return <div className="chips">{list.map(k => { const p = PLATFORM_MAP[k]; if (!p) return null; return <span key={k} className="chip" style={{ background: p.color + '22', color: p.color }}>{p.label}</span> })}</div>
  }
  function Avatar({ id }) {
    if (!id) return null
    const t = team.find(x => x.id === id)
    return <span className="avatar" style={{ background: 'linear-gradient(140deg,#1DB954,#0f7a37)' }} title={t?.name}>{initials(t?.name)}</span>
  }

  // ── Calendar weeks ──
  const weeks = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const startDow = (first.getDay() + 6) % 7 // Mon=0
    const start = new Date(first); start.setDate(first.getDate() - startDow)
    const days = []
    for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d) }
    const byDate = {}
    filtered.forEach(p => { if (p.scheduled_date) { (byDate[p.scheduled_date] = byDate[p.scheduled_date] || []).push(p) } })
    return { days, byDate }
  }, [month, filtered])

  const todayStr = ymd(new Date())

  function StageMenu() {
    if (!menu) return null
    const st = stages.find(s => s.id === menu.stageId); if (!st) return null
    return (
      <div className="pop" style={{ top: menu.y, left: menu.x }} onClick={e => e.stopPropagation()}>
        <div className="lbl">Colour</div>
        <div className="swatches">{STAGE_COLORS.map(c => <span key={c} className={'sw' + (c === st.color ? ' sel' : '')} style={{ background: c }} onClick={() => { recolourStage(st.id, c); setMenu(null) }} />)}</div>
        <div className="sep" />
        <button onClick={() => { const el = document.querySelector(`[data-stagename="${st.id}"]`); setMenu(null); if (el) { el.focus(); document.getSelection().selectAllChildren(el) } }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m4 20 4-1 10-10-3-3L5 16z" /></svg>Rename</button>
        <button onClick={() => { moveStageBy(st.id, -1); setMenu(null) }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>Move left</button>
        <button onClick={() => { moveStageBy(st.id, 1); setMenu(null) }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 6 6 6-6 6" /></svg>Move right</button>
        <div className="sep" />
        <button className="danger" onClick={() => { deleteStage(st.id); setMenu(null) }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></svg>Delete column</button>
      </div>
    )
  }

  return (
    <div className="ltc">
      <style>{CONTENT_CSS}</style>
      <div className="inner">
        <div className="phead">
          <div>
            <h1>Content Calendar</h1>
            <div className="sub">Plan your posts across every platform. Drag them through your own stages, or see the month at a glance.</div>
          </div>
          <button className="btn primary" onClick={() => openNew()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg>New post
          </button>
        </div>

        <div className="toolbar">
          <div className="search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>
            <input placeholder="Search posts, captions, hashtags…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="segment">
            <button className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}>Board</button>
            <button className={view === 'calendar' ? 'on' : ''} onClick={() => setView('calendar')}>Calendar</button>
            <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>List</button>
          </div>
        </div>

        {loading && <div className="empty">Loading your content…</div>}

        {/* BOARD */}
        {!loading && view === 'board' && (
          <div className="board">
            {stages.map(st => {
              const inStage = filtered.filter(p => p.stage_id === st.id)
              return (
                <div key={st.id} className="col"
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('dragover') }}
                  onDragLeave={e => e.currentTarget.classList.remove('dragover')}
                  onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('dragover'); if (dragCard.current) moveCard(dragCard.current, st.id); else if (dragCol.current) reorderStage(dragCol.current, st.id) }}>
                  <div className="colhead">
                    <span className="grip" draggable title="Drag to reorder" onDragStart={() => { dragCol.current = st.id }} onDragEnd={() => { dragCol.current = null }}>
                      <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" /><circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" /><circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" /></svg>
                    </span>
                    <span className="dot" style={{ background: st.color }} />
                    <span className="colname" data-stagename={st.id} contentEditable suppressContentEditableWarning spellCheck={false} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }} onBlur={e => renameStage(st.id, e.currentTarget.textContent)}>{st.name}</span>
                    <span className="count">{inStage.length}</span>
                    <span className="colmenu" onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setMenu({ stageId: st.id, x: Math.max(8, r.right - 190), y: Math.min(window.innerHeight - 280, r.bottom + 6) }) }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
                    </span>
                  </div>
                  <div className="cards">
                    {inStage.map(p => {
                      const url = photoUrl(p.media_path)
                      return (
                        <div key={p.id} className="pcard" draggable
                          onMouseDown={() => { didDrag.current = false }}
                          onDragStart={() => { dragCard.current = p.id; didDrag.current = true }}
                          onDragEnd={() => { dragCard.current = null; setTimeout(() => { didDrag.current = false }, 60) }}
                          onClick={() => { if (!didDrag.current) openEdit(p) }}>
                          <span className="accent" style={{ background: st.color }} />
                          {url && <img className="thumb" src={url} alt="" />}
                          <div className="ptitle">{p.title || 'Untitled post'}</div>
                          <PlatChips list={p.platforms} />
                          <div className="prow">
                            {p.format ? <span className="fmt">{p.format}</span> : <span />}
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                              {p.scheduled_date && <span className="cdate"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 3v3M16 3v3" /></svg>{prettyDate(p.scheduled_date)}</span>}
                              {canAssign && <Avatar id={p.assigned_to} />}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    {inStage.length === 0 && <div className="addcard" onClick={() => openNew({ stage_id: st.id })}>+ Add post</div>}
                  </div>
                </div>
              )
            })}
            <div className="addstage"><div className="box" onClick={addStage}>+ Add column</div></div>
          </div>
        )}

        {/* CALENDAR */}
        {!loading && view === 'calendar' && (
          <div className="cal">
            <div className="calhead">
              <div className="calmonth">{MONTHS[month.getMonth()]} {month.getFullYear()}</div>
              <div className="calnav">
                <button onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>‹</button>
                <button style={{ width: 'auto', padding: '0 12px', fontSize: 12.5 }} onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)) }}>Today</button>
                <button onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>›</button>
              </div>
            </div>
            <div className="dow">{DOW.map(d => <span key={d}>{d}</span>)}</div>
            <div className="weeks">
              {weeks.days.map((d, i) => {
                const key = ymd(d); const dayPosts = weeks.byDate[key] || []; const out = d.getMonth() !== month.getMonth()
                return (
                  <div key={i} className={'day' + (out ? ' out' : '') + (key === todayStr ? ' today' : '')} onClick={() => openNew({ scheduled_date: key })}>
                    <div className="daynum">{d.getDate()}</div>
                    {dayPosts.slice(0, 3).map(p => {
                      const col = PLATFORM_MAP[p.platforms?.[0]]?.color || '#1DB954'
                      return <div key={p.id} className="ev" style={{ background: col + '22', color: col }} onClick={e => { e.stopPropagation(); openEdit(p) }}><span className="ed" style={{ background: col }} />{p.title || 'Untitled'}</div>
                    })}
                    {dayPosts.length > 3 && <div className="more">+{dayPosts.length - 3} more</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* LIST */}
        {!loading && view === 'list' && (
          filtered.length === 0 ? <div className="list"><div className="empty"><div className="big">No posts yet</div>Create your first post to start planning.</div></div> : (
            <div className="list">
              <div className="lrow head"><span>Post</span><span className="hide-m">Platforms</span><span className="hide-m">Format</span><span className="hide-m">Date</span><span>Stage</span></div>
              {[...filtered].sort((a, b) => (a.scheduled_date || '9999').localeCompare(b.scheduled_date || '9999')).map(p => {
                const st = stages.find(s => s.id === p.stage_id)
                return (
                  <div key={p.id} className="lrow" onClick={() => openEdit(p)}>
                    <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title || 'Untitled post'}</span>
                    <span className="hide-m"><PlatChips list={p.platforms} /></span>
                    <span className="hide-m" style={{ color: 'var(--lt-muted)', fontSize: 12.5 }}>{p.format || '—'}</span>
                    <span className="hide-m" style={{ color: 'var(--lt-muted)', fontSize: 12.5 }}>{p.scheduled_date ? prettyDate(p.scheduled_date) : '—'}</span>
                    <span>{st ? <span className="stagepill" style={{ background: st.color + '22', color: st.color }}><span className="dot" style={{ background: st.color }} />{st.name}</span> : '—'}</span>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>

      <StageMenu />

      {/* Card modal */}
      {showCard && (
        <div className="modal" onClick={() => setShowCard(false)}>
          <div className="modalbox" onClick={e => e.stopPropagation()}>
            <div className="mtitle">{editing ? 'Edit post' : 'New post'}</div>
            <div className="msub">Everything here is optional. Fill in as much or as little as you like.</div>

            <div className="field">
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => pickFile(e.target.files?.[0])} />
              <div className="uploader" onClick={() => fileRef.current?.click()}>
                {preview ? <img src={preview} alt="" /> : <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600 }}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>Add media</span>}
              </div>
            </div>

            <div className="field"><label className="lab">Title / hook</label><input className="inp" autoFocus value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Behind the scenes of Sarah & Tom's wedding" /></div>

            <div className="field">
              <label className="lab">Platforms</label>
              <div className="platgrid">
                {PLATFORMS.map(p => {
                  const on = form.platforms.includes(p.key)
                  return <div key={p.key} className={'plat' + (on ? ' on' : '')} style={on ? { background: p.color + '22', borderColor: p.color, color: p.color } : {}} onClick={() => togglePlatform(p.key)}><span className="pd" style={{ background: p.color }} />{p.label}</div>
                })}
              </div>
            </div>

            <div className="g2">
              <div className="field"><label className="lab">Format</label><input className="inp" list="ct-formats" value={form.format} onChange={e => setForm(f => ({ ...f, format: e.target.value }))} placeholder="Reel, Carousel…" /><datalist id="ct-formats">{FORMATS.map(f => <option key={f} value={f} />)}</datalist></div>
              <div className="field"><label className="lab">Stage</label><select className="inp" value={form.stage_id} onChange={e => setForm(f => ({ ...f, stage_id: e.target.value }))}>{stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            </div>

            <div className="g2">
              <div className="field"><label className="lab">Post date</label><input className="inp" type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} /></div>
              <div className="field"><label className="lab">Time</label><input className="inp" type="time" value={form.scheduled_time} onChange={e => setForm(f => ({ ...f, scheduled_time: e.target.value }))} /></div>
            </div>

            {canAssign && (
              <div className="field"><label className="lab">Assign to</label>
                <select className="inp" value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}>
                  <option value="">Unassigned</option>
                  {team.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}

            <div className="field"><label className="lab">Caption</label><textarea className="inp" style={{ minHeight: 90, resize: 'vertical' }} value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} placeholder="Write your caption…" />
              <div className="lumihint"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1DB954" strokeWidth="2"><path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z" /></svg>Tip: ask Lumi for caption ideas and hashtags, then paste them here.</div>
            </div>
            <div className="field"><label className="lab">Hashtags</label><textarea className="inp" style={{ minHeight: 54, resize: 'vertical' }} value={form.hashtags} onChange={e => setForm(f => ({ ...f, hashtags: e.target.value }))} placeholder="#wedding #sydneyphotographer" /></div>
            <div className="field"><label className="lab">Notes</label><input className="inp" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Anything to remember" /></div>

            <div className="mactions">
              {editing && <button className="btn ghost danger" style={{ marginRight: 'auto' }} onClick={deleteCard}>Delete</button>}
              <button className="btn" onClick={() => setShowCard(false)}>Cancel</button>
              <button className="btn primary" disabled={saving} onClick={saveCard}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add post'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={'toast show' + (toast.type === 'err' ? ' err' : '')}>{toast.type === 'err' ? '⚠' : '✓'} {toast.msg}</div>}
    </div>
  )
}
