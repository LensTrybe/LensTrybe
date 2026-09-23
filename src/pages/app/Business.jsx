import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Still from '../../components/Still'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { fmt } from '../../lib/format'
import Chart from './Chart'

const Tiles = ({ t }) => <div className="s12"><div className="kp">{t.map(([l, v, e, w]) => <div key={l} className="k lg"><small>{l}</small><b>{v}</b><em className={w}>{e}</em></div>)}</div></div>
const Head = ({ h, p, children }) => <div className="vh"><div><h1>{h}</h1><p>{p}</p></div><div className="acts">{children}</div></div>
const Stars = ({ n }) => <span className="stars2">{[1, 2, 3, 4, 5].map(i => <i key={i} className={i <= n ? 'on' : ''}>★</i>)}</span>

/* Insights: where enquiries come from and what they turn into. */
export function Insights() {
  const F = useFlows(); const { toast } = F; const [r, setR] = useState('90')
  const SRC = [['Ask bar', 41, 'Client typed a sentence on lenstrybe.com'], ['Your website', 22, 'maraokafor.lenstrybe.com'], ['Google', 18, 'Business profile and reviews'], ['Instagram', 12, 'Posts and bio link'], ['Referrals', 9, 'Ana, Coastline, Marcus'], ['Passed on', 2, 'Other creatives']]
  const tot = SRC.reduce((s, x) => s + x[1], 0)
  return (
    <section className="view">
      <Head h="Insights" p="Where enquiries come from, what they turn into, and what a booking is worth."><div className="tfilt" style={{ padding: 0 }}>{[['30', '30 days'], ['90', '90 days'], ['365', 'Year']].map(([k, l]) => <button key={k} className={r === k ? 'on' : ''} onClick={() => setR(k)}>{l}</button>)}</div><button className="btn g" onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['source,enquiries\n' + SRC.map(x => x[0] + ',' + x[1]).join('\n')], { type: 'text/csv' })); a.download = 'insights-' + r + 'd.csv'; a.click(); toast('Exported.') }}><Icon name="deliver" size={15} />Export</button></Head>
      <div className="grid">
        <Tiles t={[['Profile views', '1,284', '▲ 41% since launch', ''], ['Enquiries', tot, r + ' days', ''], ['Turned into bookings', '38%', '40 of 104', ''], ['Average booking', '$1,860', 'up from $1,540', 'n']]} />
        <div className="card lg s7"><div className="h"><b>Where enquiries come from</b></div>
          <div className="cats">{SRC.map(([n, v, d]) => <div key={n} className="cat"><div className="r"><b>{n}</b><span>{v} · {Math.round(v / tot * 100)}%</span></div><div className="bar"><i style={{ width: (v / SRC[0][1] * 100) + '%' }} /></div><small>{d}</small></div>)}</div>
        </div>
        <div className="s5 side">
          <div className="card lg"><div className="h"><b>Money this year</b><Link to="/app/money">Finance hub <Icon name="arrow" size={12} /></Link></div><Chart id="i" /></div>
          <div className="card lg"><div className="h"><b>What converts</b></div>
            <div className="kv"><span>Replied within an hour</span><b>61% booked</b></div><div className="kv"><span>Replied next day</span><b>24% booked</b></div><div className="kv"><span>Quote sent with the reply</span><b>71% accepted</b></div><div className="kv"><span>Quote sent later</span><b>44% accepted</b></div>
          </div>
          <div className="tlumi"><span className="lm" /><div>The ask bar brings four in ten enquiries and they book at nearly twice the rate of Instagram. Your Saturday availability in November is the thing holding bookings back, not leads.<div className="acts"><button className="y" onClick={() => F.nav('/app/availability')}>Show me</button></div></div></div>
        </div>
      </div>
    </section>
  )
}
