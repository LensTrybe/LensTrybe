import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Still from '../../components/Still'
import Icon from '../../components/Icon'
import { MOOD_NAMES } from '../../lib/stills'
import { fmt } from '../../lib/format'
import { useToast } from '../../components/Toast'

const SIG = 'M12 48c14-22 26-30 30-22s-4 34 6 30 20-38 30-32-2 32 8 30 22-26 30-20-4 26 6 24 18-24 30-18 4 20 12 18 24-22 36-16 8 20 20 16 26-20 40-14 10 16 22 12'
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const BOOKED = [7, 8, 21, 28]

// The creative, in place: profile, date, package, and a four beat booking.
export default function ProfilePanel({ c, onClose }) {
  const toast = useToast()
  const [date, setDate] = useState('Sat 14 Nov')
  const [pk, setPk] = useState(1)
  const [beat, setBeat] = useState(-1)
  const [booked, setBooked] = useState(false)
  useEffect(() => { setDate('Sat 14 Nov'); setPk(1); setBeat(-1); setBooked(false) }, [c])
  useEffect(() => { document.body.style.overflow = c ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [c])
  useEffect(() => { const k = e => { if (e.key === 'Escape') onClose() }; addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [onClose])
  if (!c) return <><div className="veil" /><aside className="panel" aria-hidden="true" /></>
  const price = c.pk[pk][1], first = c.n.split(' ')[0]
  const book = () => {
    setBeat(0); const durs = [1500, 2100, 1500, 1800]; let i = 0
    const next = () => { i++; if (i < 4) { setBeat(i); setTimeout(next, durs[i]) } else { setBeat(4); setBooked(true); toast('Booked. The thread with ' + first + ' is open.') } }
    setTimeout(next, durs[0])
  }
  const days = Array.from({ length: 14 }, (_, i) => { const d = 9 + i; return { d, dow: DAYS[(d + 5) % 7], x: BOOKED.includes(d) } })
  return (
    <>
      <div className="veil on" onClick={onClose} />
      <aside className="panel on" aria-label="Creative profile and booking">
        <div className="l">
          <button className="close" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
          <Still seed={c.seed} mood={c.mood} />
          <div className="info">
            <h2>{c.n}</h2>
            <div className="meta"><span>{c.d} · {c.c}</span>{c.found && <span className="fb">Founding creative</span>}<span className="st2"><i>★★★★★</i> {c.r} · {c.rv} verified bookings</span></div>
            <div className="strip">{[0, 1, 2, 3, 4, 5].map(i => <div key={i}><Still seed={c.seed * 7 + i} mood={MOOD_NAMES[(i + c.seed) % 6]} /></div>)}</div>
          </div>
        </div>
        <div className="r lg d">
          <div className="lumi-note"><span className="lm" /><span><b>Why {first}:</b> {c.why}</span></div>
          <div><h3>Pick a date</h3><div className="avail" style={{ marginTop: 10 }}>{days.map(x => <button key={x.d} type="button" disabled={x.x} className={(x.x ? 'x' : '') + (date === `${x.dow} ${x.d} Nov` ? ' on' : '')} onClick={() => setDate(`${x.dow} ${x.d} Nov`)}><small>{x.dow}</small><b>{x.d}</b></button>)}</div></div>
          <div><h3>Pick a package</h3><div className="pkgs" style={{ marginTop: 10 }}>{c.pk.map(([n, p, s], i) => <button key={n} type="button" className={i === pk ? 'on' : ''} onClick={() => setPk(i)}><b>{n}</b><span>{fmt(p)}</span><small>{s}</small></button>)}</div></div>
          <button className="bbtn" onClick={book} disabled={beat >= 0 && !booked} style={booked ? { background: 'var(--neon)' } : undefined}>{booked ? 'Booked. Thread opened.' : beat >= 0 ? 'Booking…' : <>Book {first} for {date}<Icon name="arrow" size={14} /></>}</button>
          <div className="book"><details open={beat >= 0}><summary><i>+</i>What happens after you book</summary>
            {[
              ['Quote, assembled', `Built from ${first}'s real rates. Private to you both.`, <><div className="qline"><span>{c.pk[pk][0]}</span><span>{fmt(price)}</span></div><div className="qline"><span>Travel, within 150km of {c.c}</span><span>Included</span></div><div className="qline"><span>Total incl. GST</span><span>{fmt(price)}</span></div></>],
              ['Contract, signed on your phone', 'Plain English. Twelve clauses, all of them readable.', <div className="sig"><svg viewBox="0 0 300 70" preserveAspectRatio="none"><path d={SIG} /></svg></div>],
              ['Deposit, paid', '30% now. The balance is due a week before the day.', <div className="pay"><span className="chip2" /><span>Visa ···· 6411 · <b>{fmt(price * .3)}</b> deposit</span><span className="ok"><Icon name="check" size={14} />Paid</span></div>],
              ['Files, delivered', 'Sneak peek in 48 hours, the gallery in two weeks, all in the same thread.', <div className="gal">{[71, 72, 73, 74].map((s, i) => <div key={s}><Still seed={s} mood={MOOD_NAMES[i]} /></div>)}</div>],
            ].map(([t, p, body], i) => (
              <div key={t} className={'beat' + (beat === i ? ' on' : beat > i ? ' done' : '')}><span className="n">{i + 1}</span>{i === 2 && <span className="ripple" />}<div><b>{t}</b><p>{p}</p><div className="body">{body}</div></div></div>
            ))}
          </details></div>
          {booked && <Link className="btn w" to="/portal/harper-leo" style={{ alignSelf: 'flex-start' }}>Open the client portal <Icon name="arrow" size={14} /></Link>}
        </div>
      </aside>
    </>
  )
}
