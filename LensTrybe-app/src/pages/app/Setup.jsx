import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { completeness } from '../../lib/complete'

// The profile checklist: a ring, the count, and every item as a link to where it gets done.
// Sits at the top of Today until it is complete (or hidden), and inside Edit profile always.
export function Ring({ pct, size = 64 }) { const r = (size - 8) / 2, c = 2 * Math.PI * r; return <svg className="sring" width={size} height={size} viewBox={'0 0 ' + size + ' ' + size}><circle cx={size / 2} cy={size / 2} r={r} className="bg" /><circle cx={size / 2} cy={size / 2} r={r} className="fg" style={{ strokeDasharray: c, strokeDashoffset: c * (1 - pct / 100) }} /><text x="50%" y="50%" dy=".36em" textAnchor="middle">{pct}<tspan>%</tspan></text></svg> }

export default function SetupCard({ compact = false, onHide }) {
  const F = useFlows(); const { s } = F; const c = completeness(s)
  const nextUp = c.items.find(i => !i.done)
  return (
    <div className={'card lg setup' + (compact ? ' compact' : '') + (c.complete ? ' done' : '')}>
      <div className="setuph"><Ring pct={c.pct} size={compact ? 56 : 72} /><div><b>{c.complete ? 'Your profile is complete' : c.pct >= 60 ? 'Nearly there' : 'Complete your profile'}</b><small>{c.done} of {c.total} done · {c.complete ? 'Complete profiles rank higher in the ask and get three times the enquiries.' : nextUp ? 'Next: ' + nextUp.label.toLowerCase() + '. ' + (c.remaining === 1 ? 'One to go.' : c.remaining + ' to go.') : ''}</small></div>{onHide && !c.complete && <button className="ic2" aria-label="Hide for now" onClick={onHide}><Icon name="x" size={14} /></button>}</div>
      <div className="setupl">{c.items.map(i => i.done ? <div key={i.key} className="si on"><i><Icon name="check" size={11} /></i><span>{i.label}</span></div> : <Link key={i.key} to={i.to} className="si"><i /><span>{i.label}</span><small>{i.hint}</small><Icon name="arrow" size={12} /></Link>)}</div>
    </div>
  )
}
