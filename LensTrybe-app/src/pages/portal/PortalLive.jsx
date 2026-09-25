import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Aurora from '../../components/Aurora'
import Logo from '../../components/Logo'
import Icon from '../../components/Icon'
import { useSpecular } from '../../lib/useSpecular'
import { loadPortal, portalSend, portalRespondQuote, stageOf, when, nice, money } from '../../lib/live'
import { downloadDocumentPdf } from '../../backend/downloadDocumentPdf'
import { AttachButton, Attachments, Pending, useAttach } from '../../components/Attach'
import { imageUrl } from '../../backend/imageUrl'
import { STAGES } from '../../data/workspace'
import '../../styles/public.css'
import '../../styles/pages.css'
import './portal.css'

// The client's thread on a real portal token. Everything the creative and this client have is
// in one timeline: messages both ways, quotes (accept or decline here), contracts (sign, PDF),
// invoices (PDF), bookings, galleries and meetings, with the stage strip worked out from what
// exists. No login: the link is the key, exactly like the live site's portal.
const low = s => String(s || '').toLowerCase()
const firstItem = items => { try { const a = Array.isArray(items) ? items : JSON.parse(items || '[]'); const i = a[0]; return i ? (i.description || i.name || i.title || i.label || '') : '' } catch { return '' } }
const fmtTime = t => { if (!t) return ''; const [h, m] = String(t).split(':').map(Number); const d = new Date(); d.setHours(h, m || 0); return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).toLowerCase() }
const av = url => { try { return imageUrl(url) || url } catch { return url } }

export default function PortalLive({ token }) {
  useSpecular([])
  const [p, setP] = useState(undefined), [v, setV] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(''), [ok, setOk] = useState(''), [prog, setProg] = useState({})
  const end = useRef(null)
  const att = useAttach(m => setErr(m))
  const load = async () => { try { setP(await loadPortal(token)) } catch { setP(null) } }
  useEffect(() => { load() }, [token]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); const k = setTimeout(() => end.current?.scrollIntoView({ block: 'end' }), 600); return () => clearTimeout(k) }, [p])
  if (p === undefined) return <div className="pub pub-light portal"><Aurora /><main className="pwrap"><p className="fine" style={{ textAlign: 'center', paddingTop: 120 }}>Opening your thread.</p></main></div>
  if (p === null) return <div className="pub pub-light portal"><Aurora /><main className="pwrap"><div className="pjob lg" style={{ marginTop: 100 }}><p className="eb p">Link not recognised</p><h1>That link is not one of ours.</h1><p className="sub">It may have been trimmed by your email app. Open the newest email from your creative and tap the button in it, or ask them to send the link again.</p><Link className="btn p" to="/" style={{ marginTop: 14 }}>LensTrybe home</Link></div></main></div>

  const c = p.creative || {}, who = p.portal?.client_name || 'there', first = String(who).split(' ')[0]
  const stage = stageOf(p)
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = p.bookings.filter(b => b.booking_date && b.booking_date >= today && !b.cancelled_at).sort((a, b) => a.booking_date < b.booking_date ? -1 : 1)[0]
  const owed = p.invoices.filter(i => !['paid', 'draft'].includes(low(i.status))).reduce((s, i) => s + Number(i.amount || 0), 0)
  const items = []
  for (const t of p.threads) for (const m of t.messages || []) items.push({ at: m.created_at, k: m.sender_type === 'creative' ? 'them' : 'me', text: m.body, id: m.id, att: Array.isArray(m.attachments) && m.attachments.length ? m.attachments : null, thread: t.id })
  for (const q of p.quotes) items.push({ at: q.created_at, k: 'quote', q })
  for (const x of p.contracts) items.push({ at: x.created_at, k: 'contract', x })
  for (const i of p.invoices) items.push({ at: i.created_at, k: 'invoice', i })
  for (const b of p.bookings) items.push({ at: b.created_at, k: 'booking', b })
  for (const d of p.deliveries) items.push({ at: d.created_at, k: 'delivery', d })
  for (const m of p.meetings) items.push({ at: m.created_at, k: 'meeting', m })
  items.sort((a, b) => (a.at || '') < (b.at || '') ? -1 : 1)
  const threadId = p.threads[0]?.id
  const send = async () => {
    const x = v.trim(); if ((!x && !att.files.length) || busy) return
    if (!threadId) return setErr('Messages open once ' + (c.business_name || 'your creative') + ' has replied to your enquiry.')
    setBusy('send'); setErr(''); setProg({})
    try { await portalSend(token, threadId, x, c.subscription_tier, att.files, i => setProg(q => ({ ...q, [i]: 1 }))); setV(''); att.clear(); await load() } catch (e) { setErr(e.message) } finally { setBusy('') }
  }
  const respond = async (q, action) => { setBusy(q.id); setErr(''); try { await portalRespondQuote(token, q.id, action); setOk(action === 'accept' ? 'Quote accepted. ' + (c.business_name || 'Your creative') + ' has been told.' : 'Quote declined.'); await load() } catch (e) { setErr(e.message) } finally { setBusy('') } }
  const pdf = async (type, id) => { setBusy(id); setErr(''); try { await downloadDocumentPdf({ type, id, portalToken: token }) } catch (e) { setErr(e.message || 'Could not make the PDF.') } finally { setBusy('') } }
  const qst = q => low(q.status) === 'accepted' ? ['ok', 'Accepted'] : low(q.status) === 'declined' ? ['pink', 'Declined'] : ['live', 'Waiting on you']
  return (
    <div className="pub pub-light portal">
      <Aurora />
      <header className="phdr lg"><Link to="/" className="plogo"><Logo height={18} /></Link><span className="who"><span className="pav" style={c.avatar_url ? { backgroundImage: 'url(' + av(c.avatar_url) + ')', backgroundSize: 'cover', borderRadius: '50%' } : undefined} /><div><b>{c.business_name || 'Your creative'}</b><small>{c.tagline || [c.skill_types?.join(' and '), c.city].filter(Boolean).join(' · ') || 'On LensTrybe'}</small></div></span></header>
      <main className="pwrap">
        <div className="pjob lg"><div className="pjhead"><div><p className="eb g">Your thread with {c.business_name || 'your creative'}</p><h1>Hi {first}.</h1><p className="sub">{upcoming ? [nice(upcoming.booking_date), upcoming.location, upcoming.service].filter(Boolean).join(' · ') : p.quotes.length ? 'Quote from ' + (c.business_name || 'your creative') : 'Everything about this job, in one place.'}</p></div><div className="pnext"><small>Next up</small><b>{upcoming ? 'Shoot day, ' + nice(upcoming.booking_date) : p.quotes.some(q => !['accepted', 'declined'].includes(low(q.status))) ? 'A quote to look at' : p.contracts.some(x => low(x.status) !== 'signed' && low(x.status) !== 'draft') ? 'A contract to sign' : owed > 0 ? money(owed) + ' to pay' : 'Nothing waiting on you'}</b>{owed > 0 && upcoming && <span>{money(owed)} outstanding</span>}</div></div>
          <div className="pstage">{STAGES.map((s, i) => <span key={s} className={i < stage ? 'd' : i === stage ? 'c' : ''}><i>{i < stage ? <Icon name="check" size={9} /> : null}</i>{s}</span>)}</div></div>
        <div className="pthread2">
          {!items.length && <div className="tsys">Nothing here yet. Your enquiry is with {c.business_name || 'your creative'}.</div>}
          {items.map((it, n) => {
            if (it.k === 'me' || it.k === 'them') return <div key={it.id || n} className={'tm ' + it.k}>{it.text}{it.att && <Attachments items={it.att} ctx={{ threadId: it.thread, token }} />}<span className="w">{when(it.at)}</span></div>
            if (it.k === 'quote') { const q = it.q, [st, stt] = qst(q), open = !['accepted', 'declined'].includes(low(q.status)); return <div key={q.id} className={'pcard lg' + (open ? ' now' : '')}><i className="pk"><Icon name={open ? 'doc' : 'check'} size={13} /></i><div><b>Quote{firstItem(q.items) ? ' · ' + firstItem(q.items) : ''}</b><small>{money(q.amount)} incl. GST{q.valid_until ? ' · valid until ' + nice(q.valid_until) : ''}</small>{open && <div className="ln" style={{ marginTop: 8, display: 'flex', gap: 8 }}><button className="btn p sm" disabled={busy === q.id} onClick={() => respond(q, 'accept')}>Accept quote</button><button className="pbtn" disabled={busy === q.id} onClick={() => respond(q, 'decline')}>Decline</button></div>}</div><span className={'st ' + st}>{stt}</span><button className="pbtn" disabled={busy === q.id} onClick={() => pdf('quote', q.id)}>PDF</button></div> }
            if (it.k === 'contract') { const x = it.x, s = low(x.status), done = s === 'signed' || s === 'completed'; return <div key={x.id} className={'pcard lg' + (!done ? ' now' : '')}><i className="pk"><Icon name={done ? 'check' : 'sign'} size={13} /></i><div><b>Contract{x.title ? ' · ' + x.title : ''}</b><small>{done ? 'Signed ' + when(x.signed_at) : 'Ready for your signature'}</small></div><span className={'st ' + (done ? 'pink' : 'live')}>{done ? 'Signed' : 'To sign'}</span>{!done && x.signing_token ? <Link className="pbtn" to={'/sign/' + x.signing_token}>Read and sign</Link> : <button className="pbtn" disabled={busy === x.id} onClick={() => pdf('contract', x.id)}>PDF</button>}</div> }
            if (it.k === 'invoice') { const i = it.i, s = low(i.status); return <div key={i.id} className={'pcard lg' + (!['paid'].includes(s) ? ' now' : '')}><i className="pk"><Icon name={s === 'paid' ? 'check' : 'money'} size={13} /></i><div><b>Invoice{firstItem(i.items) ? ' · ' + firstItem(i.items) : ''}</b><small>{money(i.amount)}{i.due_date ? ' · due ' + nice(i.due_date) : ''}{s === 'paid' ? ' · paid, thank you' : ''}</small></div><span className={'st ' + (s === 'paid' ? 'ok' : s === 'overdue' ? 'pink' : 'live')}>{s === 'paid' ? 'Paid' : s === 'overdue' ? 'Overdue' : 'Due'}</span><button className="pbtn" disabled={busy === i.id} onClick={() => pdf('invoice', i.id)}>PDF</button></div> }
            if (it.k === 'booking') { const b = it.b, s = low(b.status); return <div key={b.id} className="pcard lg"><i className="pk cal"><Icon name="cal" size={13} /></i><div><b>{b.service || 'Booking'}{b.booking_date ? ' · ' + nice(b.booking_date) : ''}</b><small>{[b.all_day ? 'All day' : [fmtTime(b.start_time), fmtTime(b.end_time)].filter(Boolean).join(' to '), b.location].filter(Boolean).join(' · ') || 'Details to come'}</small>{b.response_note && <small>{b.response_note}</small>}</div><span className={'st ' + (['confirmed', 'accepted'].includes(s) ? 'ok' : b.cancelled_at ? 'pink' : 'live')}>{b.cancelled_at ? 'Cancelled' : ['confirmed', 'accepted'].includes(s) ? 'Confirmed' : 'Requested'}</span></div> }
            if (it.k === 'delivery') { const d = it.d, gone = !!d.files_purged_at, exp = d.expires_at && d.expires_at < new Date().toISOString(); return <div key={d.id} className="pcard lg peek"><i className="pk"><Icon name="grid" size={13} /></i><div><b>{d.title || 'Your photos'}</b><small>{gone ? 'This gallery has been removed.' : exp ? 'This link has expired. Ask for it to be renewed.' : (d.file_count || 0) + ' files' + (d.expires_at ? ' · available until ' + nice(d.expires_at.slice(0, 10)) : '') + (d.password_protected ? ' · password from your creative' : '')}</small></div><span className={'st ' + (gone || exp ? 'pink' : 'ok')}>{gone ? 'Removed' : exp ? 'Expired' : d.is_final ? 'Final' : 'Ready'}</span>{!gone && !exp && <a className="pbtn" href={'/deliver/' + d.download_token}>Open gallery</a>}</div> }
            if (it.k === 'meeting') { const m = it.m, s = low(m.status); return <div key={m.id} className="pcard lg"><i className="pk cal"><Icon name="chat" size={13} /></i><div><b>{m.title || 'Meeting'}{m.meeting_date ? ' · ' + nice(m.meeting_date) : ''}</b><small>{[fmtTime(m.start_time), m.meeting_type, m.location].filter(Boolean).join(' · ')}</small></div><span className={'st ' + (s === 'confirmed' ? 'ok' : s === 'declined' ? 'pink' : 'live')}>{s === 'confirmed' ? 'Confirmed' : s === 'declined' ? 'Declined' : 'Proposed'}</span>{s !== 'confirmed' && s !== 'declined' && m.response_token && <a className="pbtn" href={'/meeting/' + m.response_token}>Respond</a>}</div> }
            return null
          })}
          {stage >= 6 && !p.reviews.length && c.id && <div className="pcard lg"><i className="pk"><Icon name="chat" size={13} /></i><div><b>How was {c.business_name || 'it'}?</b><small>A minute of your time. Verified booking, posted to their profile.</small></div><Link className="pbtn" to={'/review/' + c.id + '?token=' + token}>Leave a review</Link></div>}
          {ok && <div className="tsys">{ok}</div>}
          {err && <div className="tsys" style={{ color: 'var(--pink-t)' }}>{err}</div>}
          <div ref={end} />
        </div>
        <div className="pcbox"><Pending files={att.files} onRemove={att.remove} busy={busy === 'send'} progress={prog} />
        <div className="pcompose lg"><span className="lens" aria-hidden="true" /><AttachButton onFiles={att.add} count={att.files.length} disabled={busy === 'send'} /><input value={v} onChange={e => { setV(e.target.value); setErr('') }} onKeyDown={e => e.key === 'Enter' && send()} placeholder={att.files.length ? 'Add a note, or just send the files' : 'Message ' + (c.business_name || 'your creative')} disabled={busy === 'send'} /><button onClick={send} aria-label="Send" disabled={busy === 'send'}><Icon name="arrow" /></button></div></div>
        <p className="fine" style={{ textAlign: 'center', marginTop: 10 }}>Photos, PDFs and files up to 50 MB each, straight from your phone or computer. Only you and {c.business_name || 'your creative'} can open them.</p>
        <p className="fine" style={{ textAlign: 'center', marginTop: 18 }}>This link is yours. No account, no password. Lose it and {c.business_name || 'your creative'} can resend it in a tap. <Link to="/" style={{ color: 'var(--green-t)' }}>lenstrybe.com</Link></p>
      </main>
    </div>
  )
}
