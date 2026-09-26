import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { TODAY, nice, daysBetween } from '../../lib/store'
import { LIVE } from '../../lib/mode'

// Reviews: every word a client said about the work, verified where it came through a booking, answered in
// the creative's voice. Requests go out from delivered galleries, low stars come to the creative first,
// the best three sit on the site, and anything that breaks the rules can be flagged for a look.
const Stars = ({ n, size = 13 }) => <span className="stars2" style={{ fontSize: size }}>{[1, 2, 3, 4, 5].map(i => <i key={i} className={i <= n ? 'on' : ''}>★</i>)}</span>
const FILT0 = [['all', 'All'], ['unanswered', 'Unanswered'], ['5', '5 star'], ['4', '4 and up'], ['low', '3 and under'], ['featured', 'Featured'], ['private', 'Private'], ['imported', 'Added by you'], ['flagged', 'Flagged']]
const FILT = LIVE ? FILT0.filter(([k]) => k !== 'private') : FILT0
const SRC = { LensTrybe: [LIVE ? 'LensTrybe review' : 'Verified booking', 'ok'], Google: ['Google', 'grey'], Imported: [LIVE ? 'Added by creative' : 'Added by you', 'grey'] }
const FLAGWHY = { never: 'never a client' }

export default function Reviews() {
  const F = useFlows(); const { s, toast } = F; const rs = s.reviews, rules = s.reviewRules, RQ = (s.reviewRequests || []).map(q => q.st === 'sent' && LIVE ? (x => x ? { ...q, st: 'done', rid: x.id } : q)(rs.find(r => !r.imported && r.date >= q.sent && r.who.trim().toLowerCase() === q.who.trim().toLowerCase())) : q)
  const [f, setF] = useState('all'), [sort, setSort] = useState('new'), [draft, setDraft] = useState({})
  const pub = rs.filter(r => r.st !== 'flagged')
  const list = useMemo(() => rs.filter(r => f === 'all' ? r.st !== 'flagged' : f === 'unanswered' ? !r.reply && r.st !== 'flagged' : f === '5' ? r.n === 5 && r.st !== 'flagged' : f === '4' ? r.n >= 4 && r.st !== 'flagged' : f === 'low' ? r.n <= 3 && r.st !== 'flagged' : f === 'featured' ? r.featured : f === 'private' ? r.st === 'private' : f === 'imported' ? r.imported : r.st === 'flagged').sort((a, b) => sort === 'new' ? (a.date < b.date ? 1 : -1) : sort === 'high' ? b.n - a.n || (a.date < b.date ? 1 : -1) : a.n - b.n || (a.date < b.date ? 1 : -1)), [rs, f, sort])
  const scored = pub.filter(r => r.st === 'public'), avg = scored.length ? (scored.reduce((t, r) => t + r.n, 0) / scored.length) : 0
  const dist = [5, 4, 3, 2, 1].map(n => [n, scored.filter(r => r.n === n).length])
  const month = rs.filter(r => (r.date || '').startsWith(TODAY.slice(0, 7)))
  const answered = pub.filter(r => r.reply).length, rate = pub.length ? Math.round(answered / pub.length * 100) : 0
  const asked = RQ.filter(q => q.st !== 'off'), got = asked.filter(q => q.st === 'done').length, waiting = asked.filter(q => q.st === 'sent')
  const post = async (r, text) => { if (await F.postReply(r, text)) setDraft(d => ({ ...d, [r.id]: '' })) }
  const rule = k => F.patch('reviewRules', { [k]: rules[k] ? 0 : 1 })
  const private5 = rs.filter(r => !r.reply && r.n === 5 && r.st === 'public'), priv = rs.filter(r => r.st === 'private' && !r.imported)
  return (
    <section className="view rvw">
      <div className="vh">
        <div><h1>Reviews</h1><p>{LIVE ? 'Everything clients said on your profile, answered in your words. Pin your best three to the top.' : 'Verified where they came through a booking, asked for three days after the gallery opens, answered in your words.'}</p></div>
        <div className="acts">
          <button className="btn g" onClick={() => { try { navigator.clipboard?.writeText(F.reviewLink())?.catch(() => {}) } catch {} toast('Review link copied: ' + F.reviewLink()) }}><Icon name="star" size={15} />Copy review link</button>
          <button className="btn g" onClick={F.addPastReview}><Icon name="plus" size={15} />Add a past review</button>
          <button className="btn w" onClick={() => F.requestReview()}><Icon name="arrow" size={15} />Ask for a review</button>
        </div>
      </div>
      <div className="grid">
        <div className="s12"><div className="kp">
          {[['Rating', avg ? avg.toFixed(1) : '—', scored.length + ' public reviews · ' + scored.filter(r => r.src === 'LensTrybe').length + (LIVE ? ' from clients' : ' verified'), ''], ['This month', String(month.length), month.length ? month.map(r => r.who.split(' ')[0]).slice(0, 3).join(', ') : 'none yet', ''], ['Replied', rate + '%', answered + ' of ' + pub.length + ' · replies lift repeat bookings', rate < 80 ? 'w' : ''], ['Asked → left', asked.length ? Math.round(got / asked.length * 100) + '%' : '—', got + ' of ' + asked.length + ' asked · ' + waiting.length + ' waiting', 'n']].map(([l, v, e, w]) => <div key={l} className="k lg"><small>{l}</small><b>{v}</b><em className={w}>{e}</em></div>)}
        </div></div>

        <div className="card lg s8">
          <div className="h">
            <div className="tfilt" style={{ padding: 0 }}>{FILT.map(([k, l]) => { const n = k === 'flagged' ? rs.filter(r => r.st === 'flagged').length : k === 'private' ? priv.length : k === 'unanswered' ? pub.filter(r => !r.reply).length : 0; return <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{l}{n > 0 && <i>{n}</i>}</button> })}</div>
            <select className="sortsel" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort"><option value="new">Newest</option><option value="high">Highest</option><option value="low">Lowest</option></select>
          </div>
          <div className="revs">
            {list.map(r => { const [sl, sc] = SRC[r.src] || [r.src, 'grey']; return <div key={r.id} className={'rev' + (r.st === 'private' ? ' priv' : '') + (r.st === 'flagged' ? ' flg' : '') + (r.featured ? ' feat' : '')}>
              <div className="rh"><span className="av" style={{ background: r.g }} /><div><b>{r.who}{r.featured ? <Icon name="star" size={12} className="pin" /> : null}</b><small>{r.job} · {r.d}{r.note ? ' · ' + r.note : ''}</small></div><span className={'st ' + sc}>{sl}</span><Stars n={r.n} /></div>
              {r.st === 'private' && !r.imported && <p className="note2 warn2"><Icon name="eye" size={12} /> Private. Under four stars comes to you first{rules.priv ? ' for 48 hours' : ''}; reply, sort it out, then decide whether it goes public.</p>}
              {r.st === 'flagged' && <p className="note2 warn2"><Icon name="shield" size={12} /> Under review · {FLAGWHY[r.flag?.why] || r.flag?.why} · {LIVE ? 'flagged ' : 'hidden from your profile since '}{nice(r.flag?.at || TODAY)}.</p>}
              <p>{r.t}</p>
              {r.reply ? <div className="rr"><span className="lm" style={{ width: 12, height: 12 }} /><span><b>You</b> {r.reply}</span><button className="lnk" onClick={() => F.replyReview(r.id)}>Edit</button></div>
                : r.st !== 'flagged' && <div className="rc"><input value={draft[r.id] ?? ''} onChange={e => setDraft(d => ({ ...d, [r.id]: e.target.value }))} placeholder={r.st === 'private' ? 'Reply privately, in your words' : (LIVE ? 'Reply in your words, or tap Draft' : 'Reply in your words, or let Lumi draft one')} onKeyDown={e => e.key === 'Enter' && post(r, draft[r.id])} /><button className="act2" onClick={() => setDraft(d => ({ ...d, [r.id]: F.draftReply(r).replace(/\n/g, ' ') }))}>Draft</button><button className="btn w sm" onClick={() => post(r, draft[r.id])}>Post</button></div>}
              <div className="racts">
                {r.st === 'public' && <button className="act2" onClick={() => F.featureReview(r.id)}>{r.featured ? 'Unpin' : LIVE ? 'Pin to top' : 'Feature on site'}</button>}
                {!LIVE && r.st === 'public' && r.n >= 4 && <button className="act2" onClick={() => F.shareReview(r.id)}>Share as post</button>}
                {r.st === 'private' && <button className="act2" onClick={() => F.publishReview(r.id)}>Make public</button>}
                {r.t2 && <Link className="act2" to={'/app/thread/' + r.t2}>Thread</Link>}
                {r.st === 'flagged' ? <button className="act2" onClick={() => F.unflagReview(r.id)}>Withdraw flag</button> : r.imported ? <button className="act2 quiet" onClick={() => F.removeReview(r.id)}>Remove</button> : <button className="act2 quiet" onClick={() => F.flagReview(r.id)}>Flag</button>}
              </div>
            </div> })}
            {!list.length && <div className="tempty">Nothing here.{f === 'all' && <> <button className="lnk" onClick={() => F.requestReview()}>Ask a client</button></>}</div>}
          </div>
        </div>

        <div className="s4 side">
          <div className="card lg"><div className="h"><b>Breakdown</b><small className="lumi-by">{scored.length} public</small></div>
            <div className="dist">{dist.map(([n, c]) => <button key={n} type="button" className={'dr' + (f === String(n) || (f === 'low' && n <= 3) ? ' on' : '')} onClick={() => setF(n === 5 ? '5' : n === 4 ? '4' : 'low')}><span>{n} ★</span><span className="bar"><i style={{ width: (scored.length ? c / scored.length * 100 : 0) + '%' }} /></span><b>{c}</b></button>)}</div>
          </div>
          <div className="card lg"><div className="h"><b>Asked</b><button className="lnk" onClick={() => F.requestReview()}>Ask</button></div>
            <div className="rqs">{asked.slice().sort((a, b) => a.st === 'sent' ? -1 : 1).map(q => <div key={q.id} className={'rq ' + q.st}><div><b>{q.who}</b><small>{q.st === 'done' ? 'Left a review · ' + nice(rs.find(r => r.id === q.rid)?.date || q.sent) : (q.reminded ? 'Reminded ' + nice(q.reminded) : 'Asked ' + nice(q.sent)) + ' · ' + daysBetween(q.sent, TODAY) + ' d ago'}</small></div>{q.st === 'sent' ? <span className="acts2"><button className="act2" onClick={() => F.remindReview(q.id)}>Remind</button><button className="act2 quiet" onClick={() => F.cancelRequest(q.id)} aria-label="Stop"><Icon name="x" size={11} /></button></span> : <Icon name="check" size={14} style={{ color: 'var(--sig)' }} />}</div>)}{!asked.length && <p className="tempty">Nobody asked yet.</p>}</div>
          </div>
          <div className="card lg"><div className="h"><b>{LIVE ? 'Your review link' : 'How they arrive'}</b></div>
            {LIVE ? <p className="note2">Send clients the link below, or tap Ask for a review and we email them. Reviews land on your profile straight away and you get an email each time.</p> : <div className="chk set">{[['ask3', 'Ask three days after the gallery opens'], ['again', 'Ask again once, a week later'], ['priv', 'Under four stars comes to me first, 48 hours'], ['site', 'Featured reviews on my site and profile'], ['share', 'Five-star reviews land in Content ideas']].map(([k, l]) => <label key={k} className={rules[k] ? 'on' : ''}><input type="checkbox" checked={!!rules[k]} onChange={() => rule(k)} /><i><Icon name="check" size={11} /></i><span>{l}</span></label>)}</div>}
            <p className="note2">Your review link: <code>{F.reviewLink().replace('https://', '')}</code></p>
          </div>
          {priv.length ? <div className="tlumi"><span className="lm" /><div>{priv[0].who.split(' ')[0]} left {priv[0].n} stars and it is private for now. The gallery ran long, which is fair. A reply today and a small make-good keeps it off the profile and keeps the client.<div className="acts"><button className="y" onClick={() => F.replyReview(priv[0].id)}>Reply now</button><button onClick={() => F.publishReview(priv[0].id)}>Publish as is</button></div></div></div>
            : private5.length > 1 ? <div className="tlumi"><span className="lm" /><div>{private5.slice(0, 3).map(r => r.who.split(' ')[0]).join(', ')}{private5.length > 3 ? ' and ' + (private5.length - 3) + ' more' : ''} left five stars and have no reply. Two lines each, in your voice, ready to post.<div className="acts"><button className="y" onClick={() => F.postAllReplies(private5)}>Post all</button><button onClick={() => toast('Left for you.')}>I will write them</button></div></div></div>
              : waiting.length ? <div className="tlumi"><span className="lm" /><div>{waiting[0].who} was asked {daysBetween(waiting[0].sent, TODAY)} days ago and hasn't left one. One gentle reminder gets about a third of them over the line.<div className="acts"><button className="y" onClick={() => F.remindReview(waiting[0].id)}>Remind</button></div></div></div>
                : <div className="tlumi"><span className="lm" /><div>All replied, nothing waiting. {avg >= 4.8 ? 'A ' + avg.toFixed(1) + ' average puts you in the top tier of the directory.' : ''}</div></div>}
        </div>
      </div>
    </section>
  )
}
