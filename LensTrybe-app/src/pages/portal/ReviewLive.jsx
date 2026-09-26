import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { TokenShell, Loading, NotOurs } from './TokenShell'
import { loadCreativeLite, loadPortal, submitReview, isUuid } from '../../lib/live'

// /review/<creative id>?token=<portal token> — the client leaves a review. Name and email come from the
// portal when a token is there (so it is tied to a real job); anyone else fills them in. Goes
// straight onto the profile (reviews insert), the creative is emailed (notify-review).
const JOBS = ['Wedding', 'Elopement', 'Real estate', 'Event', 'Headshots', 'Brand', 'Family', 'Video', 'Something else']
const WORDS = ['', 'Not great', 'Could be better', 'Good', 'Really good', 'Loved it']

export default function ReviewLive({ id }) {
  const [sp] = useSearchParams(); const token = sp.get('token') || ''
  const [c, setC] = useState(undefined), [n, setN] = useState(0), [hov, setHov] = useState(0), [f, setF] = useState({ name: '', email: '', job: '', body: '' }), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [done, setDone] = useState(false), [verified, setVerified] = useState(false)
  useEffect(() => {
    let on = true
    if (!isUuid(id)) return setC(null)
    loadCreativeLite(id).then(async p => {
      if (!on) return
      if (!p) return setC(null)
      setC(p)
      if (isUuid(token)) { try { const port = await loadPortal(token); if (on && port?.portal && port.creative?.id === id) { setF(x => ({ ...x, name: port.portal.client_name || '', email: port.portal.client_email || '' })); setVerified(true) } } catch { /* fill in by hand */ } }
    }).catch(() => on && setC(null))
    return () => { on = false }
  }, [id, token])
  if (c === undefined) return <Loading text="One moment." />
  if (c === null) return <NotOurs what="review link" />
  const name = c.business_name || 'this creative', first = name.split(' ')[0]
  const u = (k, v) => { setF(x => ({ ...x, [k]: v })); setErr('') }
  const missing = !n ? 'Tap the stars to pick a rating.' : f.body.trim().length < 3 ? 'Write a few words about working with ' + first + '.' : !f.name.trim() ? 'Add your name.' : !/^\S+@\S+\.\S+$/.test(f.email.trim()) ? 'Add your email. It is only used to confirm it is you, never shown.' : ''
  const ok = !missing
  const post = async e => { e.preventDefault(); if (busy) return; if (!ok) return setErr(missing); setBusy(true); setErr(''); try { await submitReview(id, { name: f.name.trim(), email: f.email.trim(), rating: n, body: f.body.trim(), job: f.job }); setDone(true) } catch (x) { setErr(x.message) } finally { setBusy(false) } }
  return (
    <TokenShell creative={c} sub="Leave a review">
      <div className="pjob lg tdoc">
        {done ? <div className="tdone"><span className="tick"><Icon name="check" size={16} /></span><div><b>Thank you, {f.name.trim().split(' ')[0]}.</b><small>It is on {first}'s profile now, and they have been told.</small></div><Link className="btn g" to={'/creatives/' + id} style={{ marginLeft: 'auto' }}>See the profile</Link></div> : <form onSubmit={post} style={{ display: 'contents' }}>
          <div className="pjhead"><div><p className="eb g">{verified ? 'Verified booking' : 'Review'}</p><h1>How was {first}?</h1><p className="sub">A minute of your time helps {first} more than you know. Honest is best.</p></div></div>
          <div className="lrv-stars tstars" onMouseLeave={() => setHov(0)}>{[1, 2, 3, 4, 5].map(i => <button type="button" key={i} className={(hov || n) >= i ? 'on' : ''} onMouseEnter={() => setHov(i)} onClick={() => setN(i)} aria-label={i + ' stars'}>★</button>)}<span>{WORDS[hov || n]}</span></div>
          <div className="field"><label htmlFor="rv-b">What you'd tell a friend</label><textarea id="rv-b" rows={4} value={f.body} onChange={e => u('body', e.target.value)} placeholder={'What was it like working with ' + first + '?'} maxLength={3000} /></div>
          <div className="two"><div className="field"><label htmlFor="rv-n">Your name</label><input id="rv-n" value={f.name} onChange={e => u('name', e.target.value)} placeholder="Harper E." maxLength={120} /></div><div className="field"><label htmlFor="rv-e">Email</label><input id="rv-e" type="email" value={f.email} onChange={e => u('email', e.target.value)} placeholder="Never shown" /></div></div>
          <div className="field"><label htmlFor="rv-j">What was shot</label><select id="rv-j" value={f.job} onChange={e => u('job', e.target.value)}><option value="">Choose</option>{JOBS.map(x => <option key={x}>{x}</option>)}</select></div>
          {err && <p className="fine" style={{ color: 'var(--pink-t)' }}>{err}</p>}
          <div className="trow"><button className="btn p" type="submit" disabled={busy} style={ok ? undefined : { opacity: .6 }}>{busy ? 'Posting' : 'Post review'} <Icon name="arrow" size={14} /></button></div>
          <p className="fine">Reviews are public on {first}'s LensTrybe profile. Your email is used once to confirm it is you and is not kept with the review. Nothing is edited.</p>
        </form>}
      </div>
    </TokenShell>
  )
}
