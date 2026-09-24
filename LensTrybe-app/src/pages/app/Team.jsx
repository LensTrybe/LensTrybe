import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { TODAY, nice, daysBetween } from '../../lib/store'

// Team: seats in the workspace. Who is in, who is invited, what each one can see, and which roles are
// offered when you invite. Seats come from the plan; the owner takes the first one.
const ROLE_LINES = { ss: 'threads, calendar and call sheets for their jobs', ed: 'Deliver, upload and cull, no money', sm: 'everything except Subscription', acc: 'Finance and Tax hub, read only' }
export default function Team() {
  const F = useFlows(); const { s, toast } = F; const M = s.team, limit = F.seatLimit(), free = Math.max(0, limit - M.length)
  const [sel, setSel] = useState(null)
  const roles = s.settings.roles || { ss: 1, ed: 1, sm: 0, acc: 0 }
  const active = M.filter(m => m.st !== 'Invited'), invited = M.filter(m => m.st === 'Invited')
  const m = M.find(x => x.id === sel)
  const toggleRole = k => { const inUse = M.filter(x => x.r === F.ROLES[k][0]).length; if (roles[k] && inUse) return toast(F.ROLES[k][0] + ' is in use by ' + inUse + ' seat' + (inUse > 1 ? 's' : '') + '. Change their role first.'); F.patch('settings', { roles: { ...roles, [k]: roles[k] ? 0 : 1 } }); toast(F.ROLES[k][0] + (roles[k] ? ' is off the invite list.' : ' can be invited now.')) }
  const remind = x => { F.upd('team', x.id, { invited: TODAY }); toast('Invite sent again to ' + x.em + '.') }
  const cancel = x => F.confirm({ title: 'Cancel the invite for ' + x.n + '?', body: 'The link in their email stops working. You can invite them again any time.', cta: 'Cancel invite', danger: true, onYes: () => { F.del('team', x.id); if (sel === x.id) setSel(null); toast('Invite cancelled. The seat is free.') } })
  const remove = x => F.confirm({ title: 'Remove ' + x.n + '?', body: 'They lose access straight away. Nothing they worked on is deleted.', cta: 'Remove seat', danger: true, onYes: () => { F.del('team', x.id); if (sel === x.id) setSel(null); toast(x.n + ' removed. The seat is free.') } })
  const Row = ({ x }) => <div className={'r' + (sel === x.id ? ' on' : '')} onClick={() => setSel(x.id)} style={sel === x.id ? { borderColor: 'var(--sig-rim)', boxShadow: '0 0 0 3px var(--sig-bg)' } : undefined}><span className="av" style={{ background: x.g }} /><div><b>{x.n} · {x.r}</b><small>{x.em} · sees {x.sees.toLowerCase()}{x.st === 'Invited' ? ' · invited ' + nice(x.invited || TODAY) : x.last ? ' · active ' + (x.last === TODAY ? 'today' : nice(x.last)) : ''}</small></div><div className="do"><span className={'st ' + (x.st === 'You' ? 'now' : x.st === 'Invited' ? 'viewed' : 'ok')}>{x.st}</span>{x.st === 'Invited' ? <><button onClick={e => { e.stopPropagation(); remind(x) }}>Resend</button><button className="y" onClick={e => { e.stopPropagation(); F.acceptSeat(x.id) }}>Accepted</button></> : x.st !== 'You' && <button onClick={e => { e.stopPropagation(); F.editSeat(x.id) }}>Edit</button>}</div></div>
  return (
    <section className="view">
      <div className="vh"><div><h1>Team</h1><p>Seats for the people who work in your workspace. Each one sees only what their role needs.</p></div><div className="acts"><Link className="btn g" to="/app/subscription">{s.plan.name} · {M.length} of {limit} seats</Link><button className="btn w" onClick={() => F.invite('team')}><Icon name="plus" size={15} />Invite</button></div></div>
      <div className="grid">
        <div className="s12"><div className="kp">{[['Seats', M.length + ' of ' + limit, free ? free + ' free' : 'all taken · ', free ? '' : 'w', !free && <Link to="/app/subscription">move up</Link>], ['In', active.length, active.filter(x => x.last === TODAY).length + ' active today', 'n'], ['Invited', invited.length, invited.length ? 'waiting on ' + invited.map(x => x.n.split(' ')[0]).join(', ') : 'nobody waiting', ''], ['Roles offered', Object.keys(roles).filter(k => roles[k]).length, 'of ' + Object.keys(F.ROLES).length + ' built in', '']].map(([l, v, e, w, x]) => <div key={l} className="k lg"><small>{l}</small><b>{v}</b><em className={w}>{e}{x}</em></div>)}</div></div>
        <div className="card lg s8"><div className="h"><b>People</b><small className="lumi-by">{active.length} in · {invited.length} invited</small></div>
          <div className="need">{active.map(x => <Row key={x.id} x={x} />)}</div>
          {invited.length > 0 && <><div className="h" style={{ marginTop: 22 }}><b>Invited</b><small className="lumi-by">Resend if it has been a few days</small></div>
            <div className="need">{invited.map(x => <Row key={x.id} x={x} />)}</div></>}
          <div className="h" style={{ marginTop: 22 }}><b>Roles you can invite</b><small className="lumi-by">Each one sets what a seat sees</small></div>
          <div className="chk set">{Object.entries(F.ROLES).map(([k, [r]]) => <label key={k} className={roles[k] ? 'on' : ''}><input type="checkbox" checked={!!roles[k]} onChange={() => toggleRole(k)} /><i><Icon name="check" size={11} /></i><span>{r} · {ROLE_LINES[k]}</span></label>)}</div>
        </div>
        <div className="s4 side">
          {m ? <div className="card lg"><div className="h"><b style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="av" style={{ background: m.g, width: 30, height: 30, borderRadius: 10 }} />{m.n}</b>{m.st !== 'You' && <button className="ic2" aria-label="Edit" onClick={() => F.editSeat(m.id)}><Icon name="edit" size={14} /></button>}</div>
            <div className="kv"><span>Role</span><b>{m.r}</b></div><div className="kv"><span>Email</span><b>{m.em}</b></div><div className="kv"><span>Can see</span><b>{m.sees}</b></div>
            {m.st === 'Invited' ? <div className="kv"><span>Invited</span><b>{nice(m.invited || TODAY)} · {daysBetween(m.invited || TODAY, TODAY)} days ago</b></div> : <><div className="kv"><span>Joined</span><b>{m.joined ? nice(m.joined, { year: 'numeric' }) : 'From the start'}</b></div><div className="kv"><span>Last active</span><b>{m.last === TODAY ? 'Today' : m.last ? nice(m.last) : '—'}</b></div></>}
            {m.st !== 'You' && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>{m.st === 'Invited' ? <><button className="btn w sm" onClick={() => remind(m)}>Resend invite</button><button className="btn g sm" onClick={() => F.acceptSeat(m.id)}>Mark accepted</button><button className="btn g sm" onClick={() => cancel(m)}>Cancel</button></> : <><button className="btn w sm" onClick={() => F.editSeat(m.id)}>Change access</button><button className="btn g sm" onClick={() => remove(m)}>Remove</button></>}</div>}
          </div> : <div className="card lg"><div className="h"><b>Who sees what</b></div>{Object.values(F.ROLES).map(([r, sees]) => <div key={r} className="kv"><span>{r}</span><b>{sees}</b></div>)}<div className="kv"><span>You</span><b>Everything</b></div></div>}
          {!M.some(x => x.r === 'Accountant') ? <div className="tlumi"><span className="lm" /><div>Your accountant asked for the Q1 pack. An Accountant seat sees Finance and Tax hub only, read only, and you'd never email a CSV again.<div className="acts"><button className="y" onClick={() => { if (!roles.acc) F.patch('settings', { roles: { ...roles, acc: 1 } }); F.invite('team', { r: 'Accountant' }) }}>Invite them</button><button onClick={() => toast('Sticking with the pack.')}>Not now</button></div></div></div>
            : invited.length ? <div className="tlumi"><span className="lm" /><div>{invited[0].n.split(' ')[0]} has not opened the invite from {nice(invited[0].invited || TODAY)}. Want me to send it again?<div className="acts"><button className="y" onClick={() => remind(invited[0])}>Resend</button><button onClick={() => toast('Leaving it.')}>Leave it</button></div></div></div>
            : <div className="tlumi"><span className="lm" /><div>Everyone is in. {free ? free + ' seat' + (free > 1 ? 's' : '') + ' free if you need a hand in the busy season.' : 'All seats are taken; moving up a plan opens more.'}</div></div>}
        </div>
      </div>
    </section>
  )
}
