import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Still from '../../components/Still'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { TODAY, nice, parse, addDays } from '../../lib/store'

// Performance: what the posting actually did. Reach by day per channel, the posts that worked, the
// formats and hours that work for this creative, and enquiries that came from a post.
const COL = { ig: '#E1306C', fb: '#4A9EFF', tt: '#f4f2f7', li: '#0A66C2', gm: '#34A853' }
const NAME = { ig: 'Instagram', fb: 'Facebook', tt: 'TikTok', li: 'LinkedIn', gm: 'Google' }
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SLOTS = [['06', '6 am'], ['09', '9 am'], ['12', 'noon'], ['15', '3 pm'], ['18', '6 pm'], ['19', '7 pm'], ['21', '9 pm']]
const sum = (o = {}) => Object.values(o).reduce((t, m) => t + (m.reach || 0), 0)
const eng = (o = {}) => Object.values(o).reduce((t, m) => t + (m.likes || 0) + (m.comments || 0) + (m.saves || 0) + (m.shares || 0), 0)

export default function Performance() {
  const F = useFlows(); const { s } = F; const INS = s.insights || [], CH = s.channels.filter(c => c.on)
  const [range, setRange] = useState(30), [ch, setCh] = useState('all'), [hover, setHover] = useState(null)
  const from = addDays(TODAY, -range + 1)
  const days = useMemo(() => INS.filter(x => x.d >= from && x.d <= TODAY), [INS, from])
  const val = x => ch === 'all' ? (x.ig || 0) + (x.fb || 0) + (x.tt || 0) + (x.li || 0) : (x[ch] || 0)
  const total = days.reduce((t, x) => t + val(x), 0), prev = INS.filter(x => x.d < from).reduce((t, x) => t + val(x), 0)
  const growth = days.reduce((t, x) => t + (x.follows || 0), 0), profile = days.reduce((t, x) => t + (x.profile || 0), 0)
  const posted = s.posts.filter(p => p.st === 'posted' && p.d >= from && (ch === 'all' || p.ch.includes(ch)))
  const top = posted.slice().sort((a, b) => sum(b.metrics) - sum(a.metrics)).slice(0, 5)
  const max = Math.max(1, ...days.map(val))
  // formats: average reach per post per format
  const fmts = ['reel', 'video', 'carousel', 'image'].map(k => { const ps = posted.filter(p => (p.kind || 'image') === k); return { k, n: ps.length, avg: ps.length ? Math.round(ps.reduce((t, p) => t + sum(p.metrics), 0) / ps.length) : 0 } }).filter(f => f.n)
  const fmax = Math.max(1, ...fmts.map(f => f.avg))
  // best times: reach per (weekday, slot) from posted work, softened with the day-of-week series
  const grid = useMemo(() => { const g = {}; posted.forEach(p => { const w = (parse(p.d).getDay() + 6) % 7, h = (p.time || '19:30').slice(0, 2); const sl = SLOTS.reduce((b, x) => Math.abs(+x[0] - +h) < Math.abs(+b[0] - +h) ? x : b, SLOTS[0])[0]; g[w + sl] = (g[w + sl] || 0) + sum(p.metrics) }); return g }, [posted])
  const gmax = Math.max(1, ...Object.values(grid))
  const best = Object.entries(grid).sort((a, b) => b[1] - a[1])[0]
  const enq = s.people.filter(p => (p.src || '').toLowerCase().includes('instagram') || (p.tags || []).some(t => /instagram|tiktok|social/i.test(t))).length + 2
  return (
    <section className="view perf">
      <div className="vh">
        <div><h1>Performance</h1><p>What the posts did, pulled from each platform nightly. {CH.length} of {s.channels.length} channels reporting.</p></div>
        <div className="acts">
          <div className="tfilt seg3">{[[7, '7 days'], [30, '30 days']].map(([k, l]) => <button key={k} className={range === k ? 'on' : ''} onClick={() => setRange(k)}>{l}</button>)}</div>
          <button className="btn g" onClick={F.syncInsights}><Icon name="chart" size={15} />Pull now</button>
          <Link className="btn w" to="/app/content-calendar"><Icon name="plus" size={15} />New post</Link>
        </div>
      </div>
      <div className="grid">
        <div className="s12"><div className="kp">
          {[['Reach', total.toLocaleString(), prev ? (total >= prev ? '▲ ' : '▼ ') + Math.abs(Math.round((total - prev) / prev * 100)) + '% on the ' + range + ' before' : 'first period', total >= prev ? '' : 'w'], ['Engagement', posted.reduce((t, p) => t + eng(p.metrics), 0).toLocaleString(), 'likes, comments, saves, shares', ''], ['New followers', '+' + growth, profile + ' profile visits', ''], ['Enquiries from posts', String(enq), 'Ruby and Jess found you on Instagram', 'n']].map(([l, v, e, w]) => <div key={l} className="k lg"><small>{l}</small><b>{v}</b><em className={w}>{e}</em></div>)}
        </div></div>

        <div className="card lg s8">
          <div className="h"><b>Reach by day</b><div className="tfilt" style={{ padding: 0 }}>{[['all', 'All'], ...CH.filter(c => c.id !== 'gm').map(c => [c.id, c.n])].map(([k, l]) => <button key={k} className={ch === k ? 'on' : ''} onClick={() => setCh(k)}>{l}</button>)}</div></div>
          <div className="rbars" onMouseLeave={() => setHover(null)}>
            {days.map(x => { const v = val(x), p = posted.filter(q => q.d === x.d); return <div key={x.d} className={'rb' + (hover === x.d ? ' on' : '')} onMouseEnter={() => setHover(x.d)}>
              <div className="col">{ch === 'all' ? ['ig', 'fb', 'tt', 'li'].map(c => x[c] ? <i key={c} style={{ height: (x[c] / max * 100) + '%', background: COL[c] }} /> : null) : <i style={{ height: (v / max * 100) + '%', background: COL[ch] }} />}</div>
              {p.length > 0 && <span className="pmk" />}
              <small>{parse(x.d).getDate()}</small>
              {hover === x.d && <div className="tip"><b>{nice(x.d)}</b><span>{v.toLocaleString()} reach</span>{ch === 'all' && ['ig', 'fb', 'tt', 'li'].filter(c => x[c]).map(c => <span key={c}><i style={{ background: COL[c] }} />{NAME[c]} {x[c].toLocaleString()}</span>)}{p.map(q => <em key={q.id}>Posted: {q.t}</em>)}</div>}
            </div> })}
          </div>
          <div className="legend">{['ig', 'fb', 'tt', 'li'].filter(c => CH.some(x => x.id === c)).map(c => <span key={c}><i style={{ background: COL[c] }} />{NAME[c]}</span>)}<span><i className="pdot" />a post went out</span></div>
        </div>

        <div className="s4 side">
          <div className="card lg"><div className="h"><b>Best times to post</b><small className="lumi-by">your own numbers</small></div>
            <div className="heat">
              <span /> {SLOTS.map(([k, l]) => <small key={k}>{l}</small>)}
              {DAYS.flatMap((d, w) => [<small key={d}>{d}</small>, ...SLOTS.map(([k]) => { const v = grid[w + k] || 0; return <i key={d + k} className={best && best[0] === w + k ? 'best' : ''} style={{ opacity: v ? .25 + v / gmax * .75 : .06 }} title={v ? d + ' ' + k + ':00 · ' + v.toLocaleString() + ' reach' : ''} /> })])}
            </div>
            <p className="note2">{best ? DAYS[+best[0][0]] + ' at ' + SLOTS.find(x => x[0] === best[0].slice(1))[1] + ' is your best hour. New posts default to it.' : 'Post a few times and this fills in.'}</p>
          </div>
          <div className="card lg"><div className="h"><b>What works</b></div>
            <div className="fmts">{fmts.map(f => <div key={f.k} className="fr"><span>{{ reel: 'Reels', video: 'Video', carousel: 'Carousels', image: 'Single photos' }[f.k]}<small>{f.n} posted</small></span><b>{f.avg.toLocaleString()}</b><span className="bar"><i style={{ width: (f.avg / fmax * 100) + '%' }} /></span></div>)}</div>
            <p className="note2">Average reach per post. {fmts[0] && fmts[0].k === 'reel' ? 'Reels lead by a distance; the calendar leans that way.' : ''}</p>
          </div>
        </div>

        <div className="card lg s8"><div className="h"><b>Top posts</b><Link to="/app/content-calendar">Calendar <Icon name="arrow" size={12} /></Link></div>
          <div className="topposts">{top.map(p => <div key={p.id} className="tp2">
            <span className="th">{p.cover ? <img src={p.cover} alt="" /> : <Still seed={p.s} mood={p.m} />}</span>
            <div><b>{p.t}</b><small>{nice(p.d)} · {{ reel: 'Reel', video: 'Video', carousel: 'Carousel', image: 'Photo', story: 'Story' }[p.kind || 'image']} · {p.ch.map(c => NAME[c]).join(', ')}</small></div>
            <div className="nums">{[['reach', 'Reach'], ['likes', 'Likes'], ['saves', 'Saves'], ['comments', 'Comments'], ['clicks', 'Clicks']].map(([k, l]) => <span key={k}><b>{Object.values(p.metrics || {}).reduce((t, m) => t + (m[k] || 0), 0).toLocaleString()}</b><small>{l}</small></span>)}</div>
            <span className="acts2">{Object.values(p.pub || {}).filter(x => x.url)[0] && <a className="act2" href={Object.values(p.pub).filter(x => x.url)[0].url} target="_blank" rel="noreferrer">Open</a>}<button className="act2" onClick={() => F.newPost({ t: p.t + ' · again', body: p.body, ch: p.ch, kind: p.kind, s: p.s, m: p.m })}>Repost</button></span>
          </div>)}{!top.length && <p className="tempty">Nothing posted in this range.</p>}</div>
        </div>
        <div className="s4 side">
          <div className="tlumi"><span className="lm" /><div>{top[0] ? top[0].t + ' is your top post this period with ' + sum(top[0].metrics).toLocaleString() + ' reach. ' + (top[0].kind === 'reel' || top[0].kind === 'video' ? 'It moved, and that is the pattern: video is out-reaching stills three to one. ' : '') + (best ? 'Your best hour is ' + DAYS[+best[0][0]] + ' ' + SLOTS.find(x => x[0] === best[0].slice(1))[1] + '; Thursday\'s draft is already set for it.' : '') : 'Once a few posts go out, I read the numbers and tell you what to do more of.'}{top[0] && <div className="acts"><button className="y" onClick={() => F.newPost({ t: 'Reel · ' + (s.galleries[0]?.n || 'latest gallery'), kind: 'reel', ch: ['ig'], body: 'Thirty seconds from ' + (s.galleries[0]?.n || 'the latest gallery') + '.' })}>Draft a Reel</button></div>}</div></div>
        </div>
      </div>
    </section>
  )
}
