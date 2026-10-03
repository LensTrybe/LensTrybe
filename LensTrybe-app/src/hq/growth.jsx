import { useState } from 'react'
import Icon from '../components/Icon'
import { api, PLAN, day, when, ago } from './api'
import { useLoad, Head, Tile, Pill, Empty, Err, Loading, useFlash, Modal, Search, Seg } from './ui'

// Founding and Broadcasts run through the existing founding-invites and broadcasts functions
// (the same ones the old admin panel uses), called by hq-api after its staff checks.
const fnd = payload => api('founding', { payload })
const bc = payload => api('broadcasts', { payload })
const INVITE_BASE = 'https://lenstrybe.com/join/creative?code='

function state(inv) {
  if (inv.status === 'redeemed') return ['Signed up', 'green', 'signed']
  if (inv.status === 'cancelled') return ['Cancelled', 'grey', 'cancelled']
  const left = inv.expires_at ? Math.ceil((new Date(inv.expires_at) - Date.now()) / 864e5) : null
  if (inv.status === 'expired' || (left !== null && left <= 0)) return ['Expired', 'pink', 'expired']
  if (!inv.sent_at) return ['Draft', 'grey', 'draft']
  return [`${inv.reminded_at ? 'Reminded' : 'Sent'} · ${left} day${left === 1 ? '' : 's'} left`, inv.reminded_at ? 'amber' : 'green', 'live']
}

export function Founding() {
  const inv = useLoad(() => fnd({ action: 'list' }))
  const st = useLoad(() => api('founding_status'))
  const [tab, setTab] = useState('invites'), [q, setQ] = useState(''), [f, setF] = useState('all'), [form, setForm] = useState(null), [busy, setBusy] = useState(''), [preview, setPreview] = useState(null)
  const [flash, flashNode] = useFlash()
  const d = inv.data, places = d?.places
  const newApps = (d?.applications || []).filter(a => a.status === 'new')
  const list = (d?.invites || []).filter(i => (f === 'all' || state(i)[2] === f) && (!q || [i.full_name, i.email, i.code, i.region].some(v => String(v || '').toLowerCase().includes(q.toLowerCase()))))
  const merge = x => x && inv.setData(o => ({ ...o, invites: o.invites.some(p => p.id === x.id) ? o.invites.map(p => p.id === x.id ? x : p) : [x, ...o.invites] }))
  const act = async (i, action, extra = {}) => {
    setBusy(i.id + action)
    try {
      const r = await fnd({ action, id: i.id, ...extra })
      if (action === 'delete') inv.setData(o => ({ ...o, invites: o.invites.filter(p => p.id !== i.id) })); else merge(r.invite)
      if (r.places) inv.setData(o => ({ ...o, places: r.places }))
      if (extra.manual) { try { await navigator.clipboard.writeText(INVITE_BASE + encodeURIComponent(i.code)) ; flash(`Link copied for ${i.full_name}. It works for 14 days.`) } catch { flash('The link is ' + INVITE_BASE + i.code) } }
      else flash({ send: `Invite emailed to ${i.full_name}.`, cancel: `Cancelled ${i.code}. The place is free again.`, extend: `${i.full_name}'s code now runs to ${day(r.invite?.expires_at)}.`, delete: 'Draft deleted.', end_deal: `${i.full_name}'s founding deal has ended. They've been emailed.` }[action] || 'Done.')
    } catch (e) { flash(e.message, 'bad') }
    setBusy('')
  }
  const create = async (e, send) => {
    e.preventDefault(); setBusy('create')
    try {
      const r = await fnd({ action: 'create', send, invites: [{ name: form.name, email: form.email, skill_type: form.type, region: form.region, note: form.note }] })
      ;(r.created || []).forEach(merge); if (r.places) inv.setData(o => ({ ...o, places: r.places }))
      const failed = (r.sent || []).find(s => !s.ok)
      flash(failed ? 'Added, but the email did not send: ' + failed.error : send ? `Invite emailed to ${form.email}.` : 'Added as a draft.', failed ? 'bad' : 'ok')
      setForm(null); inv.load()
    } catch (x) { flash(x.data?.problems?.map(p => p.error).join('. ') || x.message, 'bad') }
    setBusy('')
  }
  const app = async (a, status) => { try { await fnd({ action: 'application', application_id: a.id, status }); inv.load(); flash(status === 'dismissed' ? 'Dismissed.' : 'Updated.') } catch (e) { flash(e.message, 'bad') } }
  const showPreview = async () => { try { const r = await fnd({ action: 'preview', name: form?.name, note: form?.note }); setPreview(r) } catch (e) { flash(e.message, 'bad') } }
  return (
    <>
      <Head title="Founding" sub="The founding 100: invite codes, applications from the Founding page, and how each founding creative is tracking."><button className="hq-btn w sm" onClick={() => setForm({ name: '', email: '', type: 'Photographer', region: '', note: '' })}><Icon name="plus" size={14} />New invite</button></Head>{flashNode}
      {places && <div className="hq-tiles"><Tile label="Places taken" value={`${places.used} / ${places.cap}`} sub="Taken when a creative signs up with a code" /><Tile label="Places left" value={places.available} /><Tile label="New applications" value={newApps.length} tone={newApps.length ? 'green' : ''} /><Tile label="Founding creatives" value={st.data?.founders?.length ?? '…'} /></div>}
      <div className="hq-bar"><Seg value={tab} onChange={setTab} options={[['invites', 'Invites'], ['apps', `Applications${newApps.length ? ' (' + newApps.length + ')' : ''}`], ['founders', 'Founding creatives'], ['feedback', 'Feedback']]} /></div>
      <Err>{inv.err}</Err>
      {inv.busy && !d ? <Loading /> : tab === 'invites' ? <>
        <div className="hq-bar"><Search value={q} onChange={setQ} placeholder="Name, email, code or region" /><Seg value={f} onChange={setF} options={[['all', 'All'], ['live', 'Live'], ['draft', 'Drafts'], ['signed', 'Signed up'], ['expired', 'Expired'], ['cancelled', 'Cancelled']]} /></div>
        {list.length ? <div className="hq-table"><table><thead><tr><th>Creative</th><th>Code</th><th>State</th><th /></tr></thead><tbody>{list.map(i => { const [l, tone, k] = state(i); return (
          <tr key={i.id}><td><b>{i.full_name}</b><small>{[i.email, i.skill_type, i.region].filter(Boolean).join(' · ')}</small>{i.email_error && <small className="warn">{i.email_error}</small>}</td><td><code>{i.code}</code></td><td><Pill tone={tone}>{l}</Pill></td>
            <td><div className="hq-right">
              {k === 'draft' && <><button className="hq-btn w sm" disabled={!!busy} onClick={() => act(i, 'send')}>Email it</button><button className="hq-btn g sm" disabled={!!busy} onClick={() => act(i, 'send', { manual: true })}>Copy link instead</button><button className="hq-btn g sm" disabled={!!busy} onClick={() => act(i, 'delete')}>Delete</button></>}
              {k === 'live' && <><button className="hq-btn g sm" disabled={!!busy} onClick={() => act(i, 'send')}>Resend</button><button className="hq-btn g sm" disabled={!!busy} onClick={() => navigator.clipboard.writeText(INVITE_BASE + i.code).then(() => flash('Link copied.'))}>Copy link</button><button className="hq-btn g sm" disabled={!!busy} onClick={() => act(i, 'extend')}>Add 14 days</button><button className="hq-btn bad sm" disabled={!!busy} onClick={() => act(i, 'cancel')}>Cancel</button></>}
              {k === 'expired' && <><button className="hq-btn g sm" disabled={!!busy} onClick={() => act(i, 'send')}>Send a fresh code</button><button className="hq-btn g sm" disabled={!!busy} onClick={() => act(i, 'cancel')}>Cancel</button></>}
              {k === 'signed' && <span className="hq-note">Signed up {day(i.redeemed_at)}</span>}
            </div></td></tr>) })}</tbody></table></div> : <Empty>No invites match.</Empty>}
      </> : tab === 'apps' ? (
        (d.applications || []).length ? (d.applications || []).map(a => <div key={a.id} className="hq-card"><div className="hq-row"><div><b>{a.name}{a.business_name && a.business_name !== a.name ? ' · ' + a.business_name : ''}</b><small>{a.email} · {a.creative_type} · {a.region} · {ago(a.created_at)}</small>{a.portfolio_url && <a className="hq-link" href={/^https?:\/\//.test(a.portfolio_url) ? a.portfolio_url : 'https://' + a.portfolio_url} target="_blank" rel="noreferrer noopener">{a.portfolio_url}</a>}</div>
          <div className="hq-right">{a.status === 'new' ? <><button className="hq-btn w sm" onClick={() => { setForm({ name: a.name, email: a.email, type: a.creative_type || 'Photographer', region: a.region || '', note: '' }); }}>Invite</button><button className="hq-btn g sm" onClick={() => app(a, 'dismissed')}>Dismiss</button></> : <Pill tone={a.status === 'invited' ? 'green' : 'grey'}>{a.status}</Pill>}</div></div></div>) : <Empty>No applications yet.</Empty>
      ) : tab === 'founders' ? (
        !st.data ? <Loading /> : st.data.founders.length ? <div className="hq-table"><table><thead><tr><th>Founding creative</th><th>Since</th><th>Profile complete</th><th>Jobs through LensTrybe</th><th>Last feedback</th><th>Deal</th></tr></thead><tbody>
          {st.data.founders.map(x => { const since = x.founding_member_since ? (Date.now() - new Date(x.founding_member_since)) / 864e5 : 0; const signedUp = (d.invites || []).find(i => i.redeemed_by === x.id); return (
            <tr key={x.id}><td><b>{x.business_name || 'No name yet'}</b><small>{x.business_email}</small></td><td>{day(x.founding_member_since)}</td>
              <td>{x.listing_complete ? <Pill tone="green">Yes</Pill> : <Pill tone={since > 7 ? 'pink' : 'amber'}>{since > 7 ? 'Overdue' : 'Not yet'}</Pill>}</td>
              <td>{x.job_count} of 3</td><td>{x.last_feedback_at ? ago(x.last_feedback_at) : 'Never'}</td>
              <td>{x.deal_status === 'active' ? <><Pill tone="green">Active</Pill>{signedUp && <button className="hq-btn bad sm" disabled={!!busy} onClick={() => confirm(`End ${x.business_name}'s founding deal? They move to the standard price and are emailed.`) && act(signedUp, 'end_deal')}>End deal</button>}</> : <Pill>{x.deal_status}</Pill>}</td></tr>) })}
        </tbody></table></div> : <Empty>No founding creatives yet.</Empty>
      ) : (!st.data ? <Loading /> : st.data.feedback.length ? st.data.feedback.map(fb => { const who = st.data.founders.find(x => x.id === fb.creative_id); return <div key={fb.id} className="hq-card"><div className="hq-row"><div><b>{who?.business_name || 'A founding creative'}</b><small>{fb.category} · {when(fb.created_at)}</small></div></div><p className="hq-quote">{fb.message}</p></div> }) : <Empty>No feedback yet.</Empty>)}
      {form && <Modal title="New founding invite" onClose={() => setForm(null)}>
        <form className="hq-form" onSubmit={e => create(e, true)}>
          <label className="hq-field"><span>Name</span><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required autoFocus /></label>
          <label className="hq-field"><span>Business email (published on their own site)</span><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></label>
          <div className="hq-two"><label className="hq-field"><span>What they do</span><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option>Photographer</option><option>Videographer</option></select></label>
            <label className="hq-field"><span>Region</span><input value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} placeholder="Brisbane" /></label></div>
          <label className="hq-field"><span>Personal note (optional, sits at the top of the email)</span><textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={3} /></label>
          <p className="hq-note">The email comes from "Michael from LensTrybe", with the code, what they get and what's asked of them. The code works for 14 days and takes one of the 100 places while it's live.</p>
          <div className="hq-acts"><button type="button" className="hq-btn g sm" onClick={showPreview}>Preview email</button><button type="button" className="hq-btn g sm" disabled={busy === 'create'} onClick={e => create(e, false)}>Save as draft</button><button className="hq-btn w sm" disabled={busy === 'create'}>Email the invite</button></div>
        </form>
      </Modal>}
      {preview && <Modal title={preview.subject} onClose={() => setPreview(null)} wide><iframe className="hq-preview" title="Email preview" sandbox="" srcDoc={preview.html} /></Modal>}
    </>
  )
}

const AUD = [['all', 'Everyone'], ['creatives', 'All creatives'], ['clients', 'All clients'], ['basic', PLAN.basic], ['pro', PLAN.pro], ['expert', PLAN.expert], ['elite', PLAN.elite], ['founding', 'Founding creatives']]
export function Broadcasts() {
  const { data, setData, err, busy } = useLoad(() => bc({ action: 'list' }))
  const [flash, flashNode] = useFlash()
  const [form, setForm] = useState(null), [reach, setReach] = useState(null), [working, setWorking] = useState(false), [preview, setPreview] = useState(null)
  const count = async audience => { setReach(null); try { setReach(await bc({ action: 'count', audience })) } catch { setReach(null) } }
  const open = () => { const f = { title: '', body: '', audience: 'creatives', style: 'banner', cta_label: '', cta_url: '', send_email: false, ends_at: '' }; setForm(f); count(f.audience) }
  const send = async e => {
    e.preventDefault()
    if (!confirm(`Send "${form.title}" to ${reach?.recipients ?? 'this audience'}${form.send_email ? `, and email ${reach?.subscribed ?? 'the subscribed'} of them` : ''}?`)) return
    setWorking(true)
    try { const r = await bc({ action: 'send', ...form, ends_at: form.ends_at ? form.ends_at + 'T23:59:00+10:00' : null }); setData(d => ({ broadcasts: [r.broadcast, ...(d?.broadcasts || [])] })); flash(r.emailError ? 'Sent to bells, but the email failed: ' + r.emailError : 'Sent.', r.emailError ? 'bad' : 'ok'); setForm(null) } catch (x) { flash(x.message, 'bad') }
    setWorking(false)
  }
  const end = async b => { try { const r = await bc({ action: 'end', id: b.id }); setData(d => ({ broadcasts: d.broadcasts.map(x => x.id === b.id ? { ...x, ...r.broadcast } : x) })); flash('Stopped showing.') } catch (e) { flash(e.message, 'bad') } }
  const live = b => !b.ends_at || new Date(b.ends_at) > new Date()
  return (
    <>
      <Head title="Broadcasts" sub="A message in everyone's notification bell, and by email to those subscribed to LensTrybe emails."><button className="hq-btn w sm" onClick={open}><Icon name="plus" size={14} />New broadcast</button></Head>{flashNode}
      <Err>{err}</Err>
      {busy && !data ? <Loading /> : !data?.broadcasts?.length ? <Empty>Nothing sent yet.</Empty> : data.broadcasts.map(b => (
        <div key={b.id} className="hq-card"><div className="hq-row"><div><b>{b.title}</b><small>{(AUD.find(a => a[0] === b.audience) || [, b.audience])[1]} · {when(b.created_at)} · reached {b.recipients}{b.send_email ? ` · emailed ${b.emailed}` : ''} · {b.dismissed} dismissed</small>{b.email_error && <small className="warn">{b.email_error}</small>}</div>
          <div className="hq-right">{live(b) ? <><Pill tone="green">Showing</Pill><button className="hq-btn g sm" onClick={() => end(b)}>Stop showing</button></> : <Pill>Ended {day(b.ends_at)}</Pill>}</div></div><p className="hq-quote">{b.body}</p></div>))}
      {form && <Modal title="New broadcast" onClose={() => setForm(null)} wide>
        <form className="hq-form" onSubmit={send}>
          <label className="hq-field"><span>Title</span><input value={form.title} maxLength={120} onChange={e => setForm({ ...form, title: e.target.value })} required autoFocus /></label>
          <label className="hq-field"><span>Message</span><textarea rows={5} maxLength={2000} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} required /></label>
          <div className="hq-two"><label className="hq-field"><span>Who</span><select value={form.audience} onChange={e => { setForm({ ...form, audience: e.target.value }); count(e.target.value) }}>{AUD.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label className="hq-field"><span>Stop showing after (optional)</span><input type="date" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} /></label></div>
          <div className="hq-two"><label className="hq-field"><span>Button label (optional)</span><input value={form.cta_label} maxLength={40} onChange={e => setForm({ ...form, cta_label: e.target.value })} placeholder="See what's new" /></label>
            <label className="hq-field"><span>Button link</span><input value={form.cta_url} onChange={e => setForm({ ...form, cta_url: e.target.value })} placeholder="/app/jobs or https://…" /></label></div>
          <label className="hq-check"><input type="checkbox" checked={form.send_email} onChange={e => setForm({ ...form, send_email: e.target.checked })} />Also email it{reach ? ` (${reach.subscribed} of ${reach.recipients} are subscribed)` : ''}</label>
          <p className="hq-note">{reach ? `Reaches ${reach.recipients}: ${reach.creatives} creatives and ${reach.clients} clients.` : 'Counting who it reaches.'}</p>
          <div className="hq-acts"><button type="button" className="hq-btn g sm" onClick={async () => { try { setPreview(await bc({ action: 'preview', title: form.title, body: form.body, cta_label: form.cta_label, cta_url: form.cta_url })) } catch (x) { flash(x.message, 'bad') } }}>Preview email</button><button className="hq-btn w sm" disabled={working}>Send</button></div>
        </form>
      </Modal>}
      {preview && <Modal title={preview.subject} onClose={() => setPreview(null)} wide><iframe className="hq-preview" title="Email preview" sandbox="" srcDoc={preview.html} /></Modal>}
    </>
  )
}
