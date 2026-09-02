import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { CONTENT_CSS, PLATFORMS, PLATFORM_MAP, DEFAULT_CONTENT_STAGES } from '../../lib/contentShared'

const EXTRA = `
.ltc .ideagrid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.ltc .idea{border-radius:15px;padding:16px 17px;background:var(--lt-glass-bg);border:var(--lt-glass-border);box-shadow:var(--lt-glass-shadow);backdrop-filter:var(--lt-glass-blur);-webkit-backdrop-filter:var(--lt-glass-blur);display:flex;flex-direction:column;gap:9px}
.ltc .idea .it{font-size:14.5px;font-weight:700;letter-spacing:-0.01em}
.ltc .idea .inote{font-size:12.5px;color:var(--lt-muted);line-height:1.5;flex:1}
.ltc .idea .iacts{display:flex;gap:6px;flex-wrap:wrap;margin-top:2px}
@media (max-width:900px){.ltc .ideagrid{grid-template-columns:1fr 1fr}}
@media (max-width:600px){.ltc .ideagrid{grid-template-columns:1fr}}
`

const BLANK = { title: '', notes: '', platforms: [] }

export default function ContentIdeasPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [ideas, setIdeas] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => { if (user) load() }, [user])
  function flash(msg, type = 'ok') { setToast({ msg, type }); setTimeout(() => setToast(null), 2400) }

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('content_ideas').select('*').eq('creative_id', user.id).order('created_at', { ascending: false })
    setIdeas(data || [])
    setLoading(false)
  }

  function openNew() { setEditing(null); setForm(BLANK); setShowModal(true) }
  function openEdit(i) { setEditing(i); setForm({ title: i.title || '', notes: i.notes || '', platforms: i.platforms || [] }); setShowModal(true) }
  function togglePlatform(k) { setForm(f => ({ ...f, platforms: f.platforms.includes(k) ? f.platforms.filter(x => x !== k) : [...f.platforms, k] })) }

  async function save() {
    setSaving(true)
    const payload = { creative_id: user.id, title: form.title.trim() || null, notes: form.notes || null, platforms: form.platforms, updated_at: new Date().toISOString() }
    let error
    if (editing) ({ error } = await supabase.from('content_ideas').update(payload).eq('id', editing.id))
    else ({ error } = await supabase.from('content_ideas').insert(payload))
    setSaving(false)
    if (error) { flash(error.message, 'err'); return }
    setShowModal(false); flash(editing ? 'Idea updated' : 'Idea saved'); load()
  }
  async function remove(i) { await supabase.from('content_ideas').delete().eq('id', i.id); setIdeas(prev => prev.filter(x => x.id !== i.id)); flash('Idea deleted') }

  async function turnIntoPost(i) {
    // Find (or seed) the first content stage, create a post, mark the idea converted.
    let { data: st } = await supabase.from('content_stages').select('id, position').eq('creative_id', user.id).order('position', { ascending: true }).limit(1)
    let stageId = st && st[0] ? st[0].id : null
    if (!stageId) {
      const rows = DEFAULT_CONTENT_STAGES.map((s, idx) => ({ creative_id: user.id, name: s.name, color: s.color, position: idx }))
      const { data: seeded } = await supabase.from('content_stages').insert(rows).select()
      stageId = seeded && seeded[0] ? seeded.sort((a, b) => a.position - b.position)[0].id : null
    }
    const { data: post, error } = await supabase.from('content_posts').insert({
      creative_id: user.id, stage_id: stageId, title: i.title || 'Untitled post', caption: i.notes || null, platforms: i.platforms || [],
    }).select().single()
    if (error) { flash('Could not create post', 'err'); return }
    await supabase.from('content_ideas').update({ converted_post_id: post.id, updated_at: new Date().toISOString() }).eq('id', i.id)
    flash('Added to your calendar')
    navigate('/dashboard/content/calendar')
  }

  return (
    <div className="ltc">
      <style>{CONTENT_CSS + EXTRA}</style>
      <div className="inner">
        <div className="phead">
          <div>
            <h1>Content Ideas</h1>
            <div className="sub">A home for every spark. Jot ideas down as they come, then turn the good ones into planned posts.</div>
          </div>
          <button className="btn primary" onClick={openNew}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg>New idea
          </button>
        </div>

        {loading ? <div className="empty">Loading ideas…</div> : ideas.length === 0 ? (
          <div className="list"><div className="empty"><div className="big">No ideas yet</div>Capture your first content idea, a hook, a trend, a shoot concept, anything.</div></div>
        ) : (
          <div className="ideagrid">
            {ideas.map(i => (
              <div key={i.id} className="idea">
                <div className="it">{i.title || 'Untitled idea'}</div>
                {i.platforms && i.platforms.length > 0 && (
                  <div className="chips" style={{ padding: 0 }}>{i.platforms.map(k => { const p = PLATFORM_MAP[k]; return p ? <span key={k} className="chip" style={{ background: p.color + '22', color: p.color }}>{p.label}</span> : null })}</div>
                )}
                {i.notes && <div className="inote">{i.notes.length > 160 ? i.notes.slice(0, 160) + '…' : i.notes}</div>}
                {i.converted_post_id && <div className="cdate" style={{ color: '#1DB954' }}>✓ In your calendar</div>}
                <div className="iacts">
                  <button className="btn primary sm" onClick={() => turnIntoPost(i)}>Turn into post</button>
                  <button className="btn sm" onClick={() => openEdit(i)}>Edit</button>
                  <button className="btn sm ghost danger" onClick={() => remove(i)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal" onClick={() => setShowModal(false)}>
          <div className="modalbox sm" onClick={e => e.stopPropagation()}>
            <div className="mtitle">{editing ? 'Edit idea' : 'New idea'}</div>
            <div className="msub">Keep it loose. You can flesh it out when it becomes a post.</div>
            <div className="field"><label className="lab">Idea</label><input className="inp" autoFocus value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="5 myths about wedding photography" /></div>
            <div className="field"><label className="lab">Notes</label><textarea className="inp" style={{ minHeight: 90, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Angle, hook, references…" /></div>
            <div className="field">
              <label className="lab">Platforms (optional)</label>
              <div className="platgrid">
                {PLATFORMS.map(p => {
                  const on = form.platforms.includes(p.key)
                  return <div key={p.key} className={'plat' + (on ? ' on' : '')} style={on ? { background: p.color + '22', borderColor: p.color, color: p.color } : {}} onClick={() => togglePlatform(p.key)}><span className="pd" style={{ background: p.color }} />{p.label}</div>
                })}
              </div>
            </div>
            <div className="mactions">
              <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Save idea'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={'toast show' + (toast.type === 'err' ? ' err' : '')}>{toast.type === 'err' ? '⚠' : '✓'} {toast.msg}</div>}
    </div>
  )
}
