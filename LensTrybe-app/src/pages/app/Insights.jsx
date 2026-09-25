import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { TODAY, nice, parse, addDays, daysBetween } from '../../lib/store'
import { fmt } from '../../lib/format'
import { completeness } from '../../lib/complete'

// Insights: the whole business as numbers you can act on. Where enquiries come from, what they turn
// into, what a booking is worth, how fast you reply and what that does to bookings, which months are
// busy, who comes back, how quickly you get paid, and how visible you are. Everything is worked out
// from the store: a year of enquiries and daily views (sample, the shape the real tables will hold)
// plus the live threads, ledger, reviews and profile.
const SRC_NOTE = { 'Ask bar': 'A sentence typed on lenstrybe.com', 'Your website': 'Enquiry form on your site', Google: 'Business profile and reviews', Instagram: 'Posts, stories and bio link', Referral: 'Past clients and other creatives', 'Passed on': 'Jobs other creatives could not take', 'Repeat client': 'Booked you before' }
const SRC_TO = { 'Ask bar': '/app/website', 'Your website': '/app/website', Google: '/app/reviews', Instagram: '/app/channels', Referral: '/app/reviews', 'Passed on': '/app/collaborate', 'Repeat client': '/app/clients' }
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const BOOKED = e => e.st === 'booked' || e.st === 'delivered'
const pct = (a, b) => b ? Math.round(a / b * 100) : 0
const med = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
const hrs = h => h < 1 ? Math.round(h * 60) + ' min' : h < 24 ? Math.round(h) + ' h' : Math.round(h / 24) + ' d'
const delta = (a, b) => b ? (a >= b ? '▲ ' : '▼ ') + Math.abs(Math.round((a - b) / b * 100)) + '%' : ''
const sum = (a, f = x => x) => a.reduce((t, x) => t + f(x), 0)
const Spark = ({ pts, w = 84, h = 30 }) => { if (pts.length < 2) return null; const mx = Math.max(...pts, 1); const d = pts.map((v, i) => (i ? 'L' : 'M') + (i / (pts.length - 1) * w).toFixed(1) + ' ' + (h - v / mx * (h - 2) - 1).toFixed(1)).join(' '); return <svg viewBox={'0 0 ' + w + ' ' + h}><path d={d} fill="none" strokeWidth="1.6" /></svg> }

export default function Insights() {
  const F = useFlows(); const { s, toast } = F
  const [range, setRange] = useState('90'), [src, setSrc] = useState(''), [hov, setHov] = useState(null)
  const days = Number(range); const from = addDays(TODAY, -days + 1), prevFrom = addDays(TODAY, -days * 2 + 1)

  // Live threads opened in the app become enquiries too, so the numbers move when you use the workspace
  const ALL = useMemo(() => { const live = s.threads.filter(t => t.created).map(t => ({ id: 'th' + t.id, d: TODAY, src: 'Ask bar', type: (t.j || '').split(' ·')[0].replace(/^\d+ listings?$/, 'Real estate') || 'Other', v: t.v || 0, reply: 0.4, quoted: t.stage >= 1, st: t.stage >= 7 ? 'delivered' : t.stage >= 4 ? 'booked' : t.stage >= 1 ? 'quoted' : 'enquired', job: t.d && /^\d{4}-/.test(t.d) ? t.d : TODAY, who: t.n, repeat: false, reviewed: false, days: 0, dep: t.stage >= 4, live: 1 })); return [...(s.enquiries || []), ...live] }, [s.threads, s.enquiries])
  const inR = (a, lo, hi) => a.filter(e => e.d >= lo && e.d <= hi)
  const E0 = inR(ALL, from, TODAY), P0 = inR(ALL, prevFrom, addDays(from, -1))
  const E = src ? E0.filter(e => e.src === src) : E0, P = src ? P0.filter(e => e.src === src) : P0
  const V = (s.views || []).filter(v => v.d >= from), PV = (s.views || []).filter(v => v.d >= prevFrom && v.d < from)
  const views = sum(V, v => v.profile + v.site), pviews = sum(PV, v => v.profile + v.site)
  const booked = E.filter(BOOKED), pbooked = P.filter(BOOKED), quoted = E.filter(e => e.quoted), delivered = E.filter(e => e.st === 'delivered'), reviewed = E.filter(e => e.reviewed)
  const rev = sum(booked, e => e.v), prev = sum(pbooked, e => e.v), avg = booked.length ? rev / booked.length : 0, pavg = pbooked.length ? prev / pbooked.length : 0
  const reply = med(E.map(e => e.reply)), preply = med(P.map(e => e.reply))

  // sources: count, share, booked rate, value
  const SRC = useMemo(() => { const m = {}; E0.forEach(e => { m[e.src] = m[e.src] || { n: 0, b: 0, v: 0 }; m[e.src].n++; if (BOOKED(e)) { m[e.src].b++; m[e.src].v += e.v } }); return Object.entries(m).map(([k, x]) => ({ k, ...x, rate: pct(x.b, x.n) })).sort((a, b) => b.n - a.n) }, [E0])
  const TYPES = useMemo(() => { const m = {}; E.forEach(e => { m[e.type] = m[e.type] || { n: 0, b: 0, v: 0, lead: [] }; m[e.type].n++; if (BOOKED(e)) { m[e.type].b++; m[e.type].v += e.v; m[e.type].lead.push(daysBetween(e.d, e.job)) } }); return Object.entries(m).map(([k, x]) => ({ k, ...x, rate: pct(x.b, x.n), avg: x.b ? x.v / x.b : 0, lead: med(x.lead) })).sort((a, b) => b.v - a.v) }, [E])
  const LOST = useMemo(() => { const m = {}; E.filter(e => e.lost).forEach(e => { m[e.lost] = (m[e.lost] || 0) + 1 }); return Object.entries(m).sort((a, b) => b[1] - a[1]) }, [E])
  const SPEED = [['Within 2 hours', e => e.reply <= 2], ['Same day', e => e.reply > 2 && e.reply <= 20], ['Next day', e => e.reply > 20 && e.reply <= 48], ['Later', e => e.reply > 48]].map(([l, f]) => { const a = E.filter(f); return [l, a.length, pct(a.filter(BOOKED).length, a.length)] })
  const QUOTE = [['Quote sent', E.filter(e => e.quoted)], ['No quote', E.filter(e => !e.quoted)]].map(([l, a]) => [l, a.length, pct(a.filter(BOOKED).length, a.length)])
  // money by month: bookings by job date, the twelve months around now, with the year before ghosted
  const MONTHS = useMemo(() => { const out = []; for (let i = -8; i <= 3; i++) { const d = parse(TODAY); d.setDate(1); d.setMonth(d.getMonth() + i); const y = d.getFullYear(), m = d.getMonth(); const key = y + '-' + String(m + 1).padStart(2, '0'); const bk = ALL.filter(e => BOOKED(e) && e.job.startsWith(key)); const enq = ALL.filter(e => e.d.startsWith(key)); out.push({ key, l: MON[m] + (m === 0 || i === -8 ? ' ' + String(y).slice(2) : ''), v: sum(bk, e => e.v), n: bk.length, enq: enq.length, future: key > TODAY.slice(0, 7), now: key === TODAY.slice(0, 7) }) } return out }, [ALL])
  const mmax = Math.max(...MONTHS.map(m => m.v), 1)
  const busiest = MONTHS.filter(m => m.future).sort((a, b) => b.n - a.n)[0]
  // clients
  const repeat = E.filter(e => e.repeat), repeatRev = sum(repeat.filter(BOOKED), e => e.v)
  const TOP = s.people.slice().sort((a, b) => (b.v || 0) - (a.v || 0)).slice(0, 5)
  // reviews and money from the live store
  const RV = s.reviews.filter(r => r.st !== 'removed'), rating = RV.length ? sum(RV, r => r.n) / RV.length : 0, replied = RV.filter(r => r.reply).length
  const RQ = s.reviewRequests || [], rqDone = RQ.filter(r => r.st === 'done').length
  const INV = s.ledger.filter(r => r.k === 'inv'), owed = INV.filter(r => r.stt !== 'Paid'), owedV = sum(owed, r => r.v), payDays = med(E.filter(e => BOOKED(e) && e.days).map(e => e.days)), depRate = pct(booked.filter(e => e.dep).length, booked.length)
  // visibility line: profile + site by day, bucketed so the line stays readable on the year view
  const LINE = useMemo(() => { const b = days <= 90 ? 1 : 7; const out = []; for (let i = 0; i < V.length; i += b) { const c = V.slice(i, i + b); out.push({ d: c[0].d, p: sum(c, v => v.profile), w: sum(c, v => v.site), q: sum(c, v => v.search), a: sum(c, v => v.ask) }) } return out }, [V, days])
  const lmax = Math.max(...LINE.map(x => x.p + x.w), 1)
  // profile strength, worked out from what is actually set up
  const COMP = completeness(s); const CHECK = COMP.items.map(i => [i.label, i.done, i.to]); const strength = COMP.pct
  // Lumi: the sentences worth acting on, from the numbers above
  const bestSrc = SRC.filter(x => x.n >= 8).sort((a, b) => b.rate - a.rate)[0], bigSrc = SRC[0]
  const fast = SPEED[0], slow = SPEED[3]
  const nudges = [
    bestSrc && bigSrc && bestSrc.k !== bigSrc.k ? [bigSrc.k + ' brings the most enquiries (' + bigSrc.n + '), but ' + bestSrc.k.toLowerCase() + ' books at ' + bestSrc.rate + '% against ' + bigSrc.rate + '%. Worth a nudge to past clients.', 'Ask for a review', '/app/reviews'] : bigSrc ? [bigSrc.k + ' is both your biggest source and books at ' + bigSrc.rate + '%. Keep it easy to find.', 'See the site', '/app/website'] : null,
    fast[1] && slow[1] ? ['Replies within two hours book at ' + fast[2] + '%; replies after two days book at ' + slow[2] + '%. ' + slow[1] + (slow[1] === 1 ? ' enquiry' : ' enquiries') + ' waited that long in this period.', 'Auto-reply from Lumi', '/app/lumi'] : null,
    busiest && busiest.n ? [busiest.l + ' is your busiest month coming up with ' + busiest.n + ' jobs worth ' + fmt(busiest.v) + '. Second shooters book out early.', 'Book crew', '/app/collaborate'] : null,
    owed.length ? [owed.length + ' invoice' + (owed.length > 1 ? 's' : '') + ' still out, ' + fmt(owedV) + '. You are paid in ' + payDays + ' days on average when the invoice goes with the delivery.', 'Chase', '/app/invoicing'] : null,
    strength < 100 ? ['Your profile is ' + strength + '% there. ' + CHECK.filter(c => !c[1]).map(c => c[0].toLowerCase()).join(', ') + ' would lift where you show in search.', 'Fix it', CHECK.find(c => !c[1])?.[2]] : null,
  ].filter(Boolean)

  const exportCsv = () => { const rows = [['date', 'from', 'type', 'client', 'value', 'reply_hours', 'quoted', 'status', 'job_date', 'lost_reason'], ...E.map(e => [e.d, e.src, e.type, e.who, e.v, e.reply, e.quoted ? 'yes' : 'no', e.st, e.job, e.lost || ''])]; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\n')], { type: 'text/csv' })); a.download = 'insights-' + range + 'd' + (src ? '-' + src.toLowerCase().replace(/\s+/g, '-') : '') + '.csv'; a.click(); toast(E.length + ' enquiries exported.') }
  const FUNNEL = [['Profile and site views', views, '/app/website'], ['Enquiries', E.length, '/app/threads'], ['Quoted', quoted.length, '/app/quotes'], ['Booked', booked.length, '/app/bookings'], ['Delivered', delivered.length, '/app/deliver'], ['Reviewed', reviewed.length, '/app/reviews']]
  const QTRS = useMemo(() => { const out = []; const A = src ? ALL.filter(e => e.src === src) : ALL; for (let i = 3; i >= 0; i--) { const d = parse(TODAY); d.setDate(1); d.setMonth(d.getMonth() - d.getMonth() % 3 - i * 3); const y = d.getFullYear(), q = Math.floor(d.getMonth() / 3); const lo = y + '-' + String(q * 3 + 1).padStart(2, '0') + '-01', hi = y + '-' + String(q * 3 + 3).padStart(2, '0') + '-31'; const a = A.filter(e => e.d >= lo && e.d <= hi), b = a.filter(BOOKED); out.push({ l: 'Q' + (q + 1) + ' ' + String(y).slice(2), n: a.length, b: b.length, v: sum(b, e => e.v), now: i === 0 }) } return out }, [ALL, src])
  const rangeL = { 30: '30 days', 90: '90 days', 365: 'year' }[range]

  return (
    <section className="view ins">
      <div className="vh"><div><h1>Insights</h1><p>Where enquiries come from, what they turn into, what a booking is worth, and what to do about it.</p></div><div className="acts"><div className="tfilt" style={{ padding: 0 }}>{[['30', '30 days'], ['90', '90 days'], ['365', 'Year']].map(([k, l]) => <button key={k} className={range === k ? 'on' : ''} onClick={() => setRange(k)}>{l}</button>)}</div><button className="btn g" onClick={exportCsv}><Icon name="deliver" size={15} />Export</button></div></div>
      {src && <div className="insfilt"><span>Showing <b>{src}</b> only</span><button onClick={() => setSrc('')}>Show everything</button></div>}
      <div className="grid">
        <div className="s12"><div className="kp six">{[
          ['Views', views.toLocaleString(), pviews ? delta(views, pviews) + ' on the ' + rangeL + ' before' : Math.round(views / days) + ' a day', views >= pviews ? '' : 'w', LINE.map(x => x.p + x.w)],
          ['Enquiries', E.length, (P.length ? delta(E.length, P.length) + ' · ' : '') + Math.round(E.length / days * 7 * 10) / 10 + ' a week', E.length >= P.length ? '' : 'w', MONTHS.filter(m => !m.future).map(m => m.enq)],
          ['Booked', pct(booked.length, E.length) + '%', booked.length + ' of ' + E.length + (P.length ? ' · was ' + pct(pbooked.length, P.length) + '%' : ''), !P.length || pct(booked.length, E.length) >= pct(pbooked.length, P.length) ? '' : 'w'],
          ['Booked value', fmt(rev), (prev ? delta(rev, prev) + ' · ' : '') + 'from this period\'s enquiries', rev >= prev ? '' : 'w', MONTHS.filter(m => !m.future).map(m => m.v)],
          ['Avg booking', fmt(avg), pavg ? 'was ' + fmt(pavg) : 'per booking', avg >= pavg ? '' : 'w'],
          ['Reply time', hrs(reply), 'median' + (P.length ? ' · was ' + hrs(preply) : ''), !P.length || reply <= preply ? '' : 'w'],
        ].map(([l, v, e, w, sp]) => <div key={l} className="k lg"><small>{l}</small><b>{v}</b><em className={w}>{e}</em>{sp && <Spark pts={sp} />}</div>)}</div></div>

        <div className="card lg s7"><div className="h"><b>From a view to a review</b><small className="lumi-by">Each step as a share of the one before</small></div>
          <div className="funnel">{FUNNEL.map(([l, n, to], i) => { const prevN = i ? FUNNEL[i - 1][1] : n; const w = i ? Math.max(4, Math.round(n / Math.max(FUNNEL[1][1], 1) * 100)) : 100; return <Link key={l} to={to} className="fr"><span className="fl">{l}</span><span className="fb"><i style={{ width: (i ? Math.min(100, w) : 100) + '%' }} className={i ? '' : 'top'} /></span><b>{n.toLocaleString()}</b><small>{i === 1 ? '1 in ' + Math.round(prevN / Math.max(n, 1)) : i ? pct(n, prevN) + '%' : ''}</small></Link> })}</div>
          {P.length > 0 && <div className="fcmp">{[['Views', views, pviews], ['Enquiries', E.length, P.length], ['Quoted', quoted.length, P.filter(e => e.quoted).length], ['Booked', booked.length, pbooked.length], ['Value', rev, prev, 1]].map(([l, a, b, m]) => <div key={l}><small>{l}</small><b>{m ? fmt(a) : a.toLocaleString()}</b><em className={a >= b ? '' : 'w'}>{b ? delta(a, b) : '—'} <span>· {m ? fmt(b) : b.toLocaleString()} before</span></em></div>)}</div>}
          <div className="fq"><div className="fqh"><span>Quarter</span><span>Enquiries</span><span>Booked</span><span>Rate</span><span>Value</span></div>{QTRS.map(q => <div key={q.l} className={'fqr' + (q.now ? ' now' : '')}><span>{q.l}{q.now ? ' · so far' : ''}</span><span>{q.n}</span><span>{q.b}</span><span>{pct(q.b, q.n)}%</span><span>{fmt(q.v)}</span></div>)}</div>
          <div className="fnote">{E.length ? <>One enquiry for every <b>{Math.round(views / Math.max(E.length, 1))}</b> views, one booking for every <b>{Math.round(E.length / Math.max(booked.length, 1) * 10) / 10}</b> enquiries. {delivered.length ? <>{pct(reviewed.length, delivered.length)}% of delivered jobs left a review.</> : ''}</> : 'No enquiries in this period.'}</div>
        </div>
        <div className="card lg s5"><div className="h"><b>Where enquiries come from</b><small className="lumi-by">Tap one to filter the page</small></div>
          <div className="cats">{SRC.map(x => <div key={x.k} className={'cat srcrow' + (src === x.k ? ' on' : '')} onClick={() => setSrc(src === x.k ? '' : x.k)}><div className="r"><b>{x.k}</b><span>{x.n} · {pct(x.n, E0.length)}%</span></div><div className="bar"><i style={{ width: pct(x.n, SRC[0].n) + '%' }} /></div><small>{SRC_NOTE[x.k] || ''} · books at <b>{x.rate}%</b>{x.v ? ' · ' + fmt(x.v) : ''}</small></div>)}</div>
          {src && <Link className="act2" to={SRC_TO[src] || '/app/website'} style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center' }}>Improve {src.toLowerCase()} <Icon name="arrow" size={12} /></Link>}
        </div>

        <div className="card lg s8"><div className="h"><b>Money by month</b><small className="lumi-by">Bookings by the date of the job · lit months are ahead</small></div>
          <div className="mbars" onMouseLeave={() => setHov(null)}>{MONTHS.map((m, i) => <div key={m.key} className={'mb' + (m.future ? ' fut' : '') + (m.now ? ' now' : '') + (hov === i ? ' hov' : '')} onMouseEnter={() => setHov(i)}><div className="mbv"><em>{m.v ? (m.v >= 1000 ? '$' + (Math.round(m.v / 100) / 10) + 'k' : fmt(m.v)) : ''}</em><i style={{ height: Math.max(3, m.v / mmax * 100) + '%' }} /></div><small>{m.l}</small></div>)}</div>
          <div className="mlegend">{hov !== null ? <><b>{MONTHS[hov].l}</b> · {fmt(MONTHS[hov].v)} from {MONTHS[hov].n} booking{MONTHS[hov].n === 1 ? '' : 's'} · {MONTHS[hov].enq} enquir{MONTHS[hov].enq === 1 ? 'y' : 'ies'} came in</> : <><b>{fmt(sum(MONTHS.filter(m => !m.future), m => m.v))}</b> booked across the last nine months · <b>{fmt(sum(MONTHS.filter(m => m.future), m => m.v))}</b> already booked for the next three</>}</div>
        </div>
        <div className="card lg s4"><div className="h"><b>By job type</b></div>
          {TYPES.map(t => <div key={t.k} className="kv"><span>{t.k}<small className="sub"> · {t.n} asked, {t.rate}% booked</small></span><b>{fmt(t.v)}<small className="sub"> · avg {fmt(t.avg)}</small></b></div>)}
          {!TYPES.length && <div className="tempty">Nothing in this period.</div>}
        </div>

        <div className="card lg s4"><div className="h"><b>What converts</b><small className="lumi-by">Booked rate by how you replied</small></div>
          {SPEED.map(([l, n, r]) => <div key={l} className="kv"><span>{l}<small className="sub"> · {n}</small></span><b className={r >= 40 ? 'good' : r < 20 && n ? 'warn' : ''}>{n ? r + '% booked' : '—'}</b></div>)}
          <div style={{ height: 8 }} />
          {QUOTE.map(([l, n, r]) => <div key={l} className="kv"><span>{l}<small className="sub"> · {n}</small></span><b className={r >= 40 ? 'good' : ''}>{n ? r + '% booked' : '—'}</b></div>)}
        </div>
        <div className="card lg s4"><div className="h"><b>Why jobs were lost</b><small className="lumi-by">Enquiries that did not book</small></div>
          {LOST.length ? <div className="cats">{LOST.map(([k, n]) => <div key={k} className="cat"><div className="r"><b>{k}</b><span>{n}</span></div><div className="bar"><i className="grey" style={{ width: pct(n, LOST[0][1]) + '%' }} /></div></div>)}</div> : <div className="tempty">Nothing lost yet in this period. Recent enquiries are still open.</div>}
          {LOST[0]?.[0] === 'Price' && <Link className="act2" to="/app/profile" style={{ marginTop: 12, display: 'inline-flex' }}>Show prices on the profile</Link>}
          {LOST[0]?.[0] === 'Went quiet' && <Link className="act2" to="/app/lumi" style={{ marginTop: 12, display: 'inline-flex' }}>Let Lumi follow up</Link>}
        </div>
        <div className="card lg s4"><div className="h"><b>Lead time</b><small className="lumi-by">Enquiry to job, typical</small></div>
          {TYPES.filter(t => t.b).map(t => <div key={t.k} className="kv"><span>{t.k}</span><b>{t.lead >= 60 ? Math.round(t.lead / 30) + ' months' : t.lead >= 14 ? Math.round(t.lead / 7) + ' weeks' : t.lead + ' days'}</b></div>)}
          <div className="kv"><span>Busiest month ahead</span><b>{busiest?.n ? busiest.l + ' · ' + busiest.n + ' job' + (busiest.n > 1 ? 's' : '') : '—'}</b></div>
          <div className="kv"><span>Weekend jobs</span><b>{pct(booked.filter(e => [0, 6].includes(parse(e.job).getDay())).length, booked.length)}%</b></div>
        </div>

        <div className="card lg s4"><div className="h"><b>Clients</b><Link to="/app/clients">All clients <Icon name="arrow" size={12} /></Link></div>
          <div className="kv"><span>New clients</span><b>{E.length - repeat.length}</b></div>
          <div className="kv"><span>Came back</span><b>{repeat.length} · {pct(repeat.length, E.length)}%</b></div>
          <div className="kv"><span>Repeat business</span><b>{fmt(repeatRev)} · {pct(repeatRev, rev)}%</b></div>
          <div className="h" style={{ marginTop: 14 }}><b style={{ fontSize: 12.5 }}>Worth the most, all time</b></div>
          {TOP.map(p => <Link key={p.id} to="/app/clients" onClick={() => { try { sessionStorage.setItem('lt-client', p.id) } catch {} }} className="kv"><span><i className="dot" style={{ background: p.g }} />{p.n}<small className="sub"> · {p.j} job{p.j === 1 ? '' : 's'}</small></span><b>{fmt(p.v || 0)}</b></Link>)}
        </div>
        <div className="card lg s4"><div className="h"><b>Getting paid</b><Link to="/app/invoicing">Invoices <Icon name="arrow" size={12} /></Link></div>
          <div className="kv"><span>Outstanding</span><b className={owed.length ? 'warn' : ''}>{owed.length ? fmt(owedV) + ' · ' + owed.length : 'Nothing'}</b></div>
          <div className="kv"><span>Days to be paid</span><b>{payDays || '—'}</b></div>
          <div className="kv"><span>Deposit taken</span><b>{depRate}% of bookings</b></div>
          <div className="kv"><span>Quotes accepted</span><b>{pct(booked.length, quoted.length)}%</b></div>
          <div className="kv"><span>Paid this period</span><b>{fmt(sum(INV.filter(r => r.stt === 'Paid' && r.date >= from), r => r.v))}</b></div>
          <div className="kv"><span>Average invoice</span><b>{INV.length ? fmt(sum(INV, r => r.v) / INV.length) : '—'}</b></div>
          <div className="kv"><span>Longest outstanding</span><b>{owed.length ? Math.max(...owed.map(r => daysBetween(r.date, TODAY))) + ' days · ' + owed.slice().sort((a, b) => a.date < b.date ? -1 : 1)[0].who : '—'}</b></div>
          <div className="kv"><span>Booked but no deposit</span><b className={booked.filter(e => !e.dep).length ? 'warn' : ''}>{booked.filter(e => !e.dep).length}</b></div>
        </div>
        <div className="card lg s4"><div className="h"><b>Reviews</b><Link to="/app/reviews">Reviews <Icon name="arrow" size={12} /></Link></div>
          <div className="kv"><span>Rating</span><b className="good">{rating ? rating.toFixed(1) + ' ★' : '—'}<small className="sub"> · {RV.length}</small></b></div>
          <div className="kv"><span>You replied to</span><b>{pct(replied, RV.length)}%</b></div>
          <div className="kv"><span>Requests that came back</span><b>{RQ.length ? pct(rqDone, RQ.length) + '%' : '—'}</b></div>
          <div className="kv"><span>Delivered jobs reviewed</span><b>{delivered.length ? pct(reviewed.length, delivered.length) + '%' : '—'}</b></div>
          <div className="kv"><span>Featured on the site</span><b>{RV.filter(r => r.featured).length} of 3</b></div>
          <div className="kv"><span>Five stars</span><b>{pct(RV.filter(r => r.n === 5).length, RV.length)}%</b></div>
          <div className="kv"><span>Under four, kept private</span><b>{RV.filter(r => r.n < 4).length}</b></div>
          <div className="kv"><span>Newest</span><b>{RV.length ? nice(RV.slice().sort((a, b) => a.date < b.date ? 1 : -1)[0].date) + ' · ' + RV.slice().sort((a, b) => a.date < b.date ? 1 : -1)[0].who.split(' ')[0] : '—'}</b></div>
        </div>

        <div className="card lg s8 vis"><div className="h"><b>Visibility</b><small className="lumi-by">Profile and site views by {days <= 90 ? 'day' : 'week'} · {sum(V, v => v.search).toLocaleString()} search appearances · {sum(V, v => v.ask)} ask bar</small></div>
          <div className="vline"><svg viewBox={'0 0 ' + LINE.length * 10 + ' 100'} preserveAspectRatio="none">
            <path className="w" d={LINE.map((x, i) => (i ? 'L' : 'M') + (i * 10 + 5) + ' ' + (100 - (x.p + x.w) / lmax * 92).toFixed(1)).join(' ') + ' L' + (LINE.length * 10 - 5) + ' 100 L5 100 Z'} />
            <path className="l" d={LINE.map((x, i) => (i ? 'L' : 'M') + (i * 10 + 5) + ' ' + (100 - (x.p + x.w) / lmax * 92).toFixed(1)).join(' ')} />
            <path className="p" d={LINE.map((x, i) => (i ? 'L' : 'M') + (i * 10 + 5) + ' ' + (100 - x.p / lmax * 92).toFixed(1)).join(' ')} />
          </svg></div><div className="vax"><span>{nice(LINE[0]?.d || from)}</span><span>{nice(TODAY)}</span></div>
          <div className="vkeys"><span><i className="a" />Site and profile together</span><span><i className="b" />Profile on LensTrybe</span><span className="r">Best {days <= 90 ? 'day' : 'week'}: {(() => { const b = LINE.slice().sort((a, c) => c.p + c.w - a.p - a.w)[0]; return b ? nice(b.d) + ' · ' + (b.p + b.w) : '—' })()}</span></div>
        </div>
        <div className="card lg s4"><div className="h"><b>Profile strength</b><b className={strength >= 80 ? 'good' : 'warn'}>{strength}%</b></div>
          <div className="bar2"><i style={{ width: strength + '%' }} /></div>
          <div className="chk set" style={{ marginTop: 12 }}>{CHECK.map(([l, ok, to]) => <Link key={l} to={to} className={ok ? 'on' : ''}><i><Icon name="check" size={11} /></i><span>{l}</span></Link>)}</div>
        </div>

        <div className="s12"><div className="h" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><b>What to do about it</b><small className="lumi-by">Lumi, from the numbers above</small></div>
          <div className="nudges">{nudges.map(([t, cta, to], i) => <div key={i} className="tlumi"><span className="lm" /><div>{t}<div className="acts"><Link className="y" to={to}>{cta}</Link></div></div></div>)}</div>
        </div>
      </div>
    </section>
  )
}
