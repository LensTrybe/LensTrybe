import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Logo from '../../components/Logo'
import Still from '../../components/Still'
import { useStore, TODAY, nice } from '../../lib/store'
import { paperOf, fam, loadFont, onColour } from '../../lib/brand'
import '../../styles/public.css'
import ReviewLive from '../portal/ReviewLive'
import { isUuid } from '../../lib/live'

// The client's side of a review: the link the creative sends. Stars, a few words, an optional photo,
// done on a phone in a minute. Under four stars goes to the creative privately first when their rules say so.
const GR = ['linear-gradient(135deg,#2c3a5e,#7fa8e8)', 'linear-gradient(135deg,#1c452f,#7fd0aa)', 'linear-gradient(135deg,#472657,#c6a5e5)', 'linear-gradient(135deg,#3d2450,#e8a0c0)']
export default function LeaveReview() {
  const { slug } = useParams()
  if (isUuid(slug)) return <ReviewLive id={slug} />
  return <LeaveReviewDemo />
}
function LeaveReviewDemo() {
  const { slug } = useParams(); const { s, add, upd } = useStore(); const b = s.brand, P = paperOf(b.paper)
  const [n, setN] = useState(0), [hov, setHov] = useState(0), [who, setWho] = useState(''), [em, setEm] = useState(''), [job, setJob] = useState('Wedding'), [t, setT] = useState(''), [done, setDone] = useState(null)
  useEffect(() => { loadFont(b.head); loadFont(b.body); document.title = 'Review ' + b.name }, [b])
  const submit = e => { e.preventDefault(); if (!n || !t.trim() || !who.trim()) return
    const p = s.people.find(x => x.em && em && x.em.toLowerCase() === em.trim().toLowerCase()); const priv = n < 4 && s.reviewRules.priv
    const id = add('reviews', { who: who.trim(), job, d: nice(TODAY), date: TODAY, n, t: t.trim(), reply: '', src: p ? 'LensTrybe' : 'Google', g: GR[s.reviews.length % GR.length], st: priv ? 'private' : 'public', featured: 0, t2: p?.id, email: em.trim() }, 'review')
    if (p) { const q = s.reviewRequests.find(x => x.t === p.id && x.st === 'sent'); if (q) upd('reviewRequests', q.id, { st: 'done', rid: id }) }
    setDone({ priv, name: who.trim().split(' ')[0] }) }
  const acc = b.accent
  return (
    <div className="lrv" style={{ background: P[2], color: P[3], fontFamily: fam(b.body), '--acc': acc }}>
      <div className="lrv-card">
        <div className="lrv-head"><span className="lrv-av"><Still seed={3} mood="golden" /></span><div><b style={{ fontFamily: fam(b.head) }}>{b.name}</b><small>{s.profile.n} · {s.profile.city}</small></div></div>
        {done ? <div className="lrv-done"><span className="lrv-tick" style={{ background: acc, color: onColour(acc) }}>✓</span><h1 style={{ fontFamily: fam(b.head) }}>Thank you, {done.name}.</h1><p>{done.priv ? s.profile.n.split(' ')[0] + ' will read this first and get back to you. It is not on the profile yet.' : 'It is on ' + s.profile.n.split(' ')[0] + '\'s profile now, and they will see it in a moment.'}</p><Link to={'/creatives/mara'} className="lrv-btn" style={{ background: acc, color: onColour(acc) }}>See the profile</Link></div>
          : <form onSubmit={submit}>
            <h1 style={{ fontFamily: fam(b.head) }}>How was it?</h1>
            <p className="lrv-sub">A minute of your time helps {s.profile.n.split(' ')[0]} more than you know. Honest is best.</p>
            <div className="lrv-stars" onMouseLeave={() => setHov(0)}>{[1, 2, 3, 4, 5].map(i => <button type="button" key={i} className={(hov || n) >= i ? 'on' : ''} style={{ color: (hov || n) >= i ? acc : undefined }} onMouseEnter={() => setHov(i)} onClick={() => setN(i)} aria-label={i + ' stars'}>★</button>)}<span>{['', 'Not great', 'Could be better', 'Good', 'Really good', 'Loved it'][hov || n]}</span></div>
            <label><span>What you'd tell a friend</span><textarea rows={4} value={t} onChange={e => setT(e.target.value)} placeholder={'What was it like working with ' + s.profile.n.split(' ')[0] + '?'} required /></label>
            <div className="lrv-row"><label><span>Your name</span><input value={who} onChange={e => setWho(e.target.value)} placeholder="Harper E." required /></label><label><span>Email</span><input type="email" value={em} onChange={e => setEm(e.target.value)} placeholder="So it shows as a verified booking" /></label></div>
            <label><span>What was shot</span><select value={job} onChange={e => setJob(e.target.value)}>{['Wedding', 'Elopement', 'Real estate', 'Event', 'Headshots', 'Brand', 'Family', 'Something else'].map(x => <option key={x}>{x}</option>)}</select></label>
            <button className="lrv-btn" type="submit" disabled={!n || !t.trim() || !who.trim()} style={{ background: acc, color: onColour(acc) }}>Post review</button>
            <p className="lrv-fine">Reviews are public on {s.profile.n.split(' ')[0]}'s LensTrybe profile{s.reviewRules.priv ? '. Under four stars goes to them first, so it can be sorted out' : ''}. Nothing is edited.</p>
          </form>}
        <div className="lrv-foot"><Logo height={11} /><span>Verified reviews</span></div>
      </div>
    </div>
  )
}
