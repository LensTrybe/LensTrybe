import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { LIVE } from '../../lib/mode'
import { useAuth } from '../../backend/AuthContext'
import * as live from '../../lib/live'
import { TODAY, nice, daysBetween } from '../../lib/store'

// Team: seats in the workspace. Who is in, who is invited, what each one can see, and which roles are
// offered when you invite. Seats come from the plan; the owner takes the first one.
const ROLE_LINES = { ss: 'threads, calendar and call sheets for their jobs', ed: 'Deliver, upload and cull, no money', sm: 'everything except Subscription', acc: 'Finance and Tax hub, read only' }
export default function Team() { return LIVE ? <TeamLive /> : <TeamDemo /> }
function TeamDemo() {
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

// Live (Elite): up to four people. Invite by email; they accept from the email and get their own
// Elite workspace. They show here with a role label. They never see your workspace.
const MAX_TEAM = 4, TTL_DAYS = 14
const ROLE_OPTS = ['Second shooter', 'Editor', 'Assistant', 'Studio manager', 'Partner', 'Other']
const GRADS = ['linear-gradient(135deg,#2c5e3a,#7fe8a8)', 'linear-gradient(135deg,#5e2c4a,#e87fb8)', 'linear-gradient(135deg,#5e4a2c,#e8c07f)', 'linear-gradient(135deg,#2c3a5e,#7fa8e8)']
const ymd = t => { const d = new Date(t); return isNaN(d) ? '' : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }
function TeamLive() {
  const F = useFlows(); const { s, toast } = F; const { profile: P } = useAuth()
  const elite = s.plan.name === 'Elite'
  const [d, setD] = useState(null), [sel, setSel] = useState(null), [busy, setBusy] = useState('')
  const load = () => live.loadTeam(P.id).then(setD).catch(() => { setD({ members: [], invites: [] }); toast('Could not load your team. Reload to try again.') })
  useEffect(() => { if (P?.id && elite) load() }, [P?.id, elite]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!elite) return (
    <section className="view">
      <div className="vh"><div><h1>Team</h1><p>Team is part of Elite. Bring in up to four people: second shooters, editors, an assistant.</p></div><div className="acts"><Link className="btn w" to="/app/subscription">See plans</Link></div></div>
      <div className="grid"><div className="card lg s7"><div className="h"><b>How it works on Elite</b></div><p className="note2">You invite someone by email. They accept and get their own LensTrybe workspace on Elite, and they show on your team with their role. They don't see your clients, jobs or money.</p><div className="acts" style={{ marginTop: 12 }}><Link className="btn g" to="/app/subscription">Move up to Elite</Link></div></div></div>
    </section>)
  if (!d) return <section className="view"><div className="vh"><div><h1>Team</h1><p>Loading your team…</p></div></div></section>
  const age = r => daysBetween(ymd(r.created_at), TODAY)
  const invites = d.invites.map(r => ({ ...r, expired: age(r) >= TTL_DAYS }))
  const used = d.members.length + invites.filter(r => !r.expired).length, free = Math.max(0, MAX_TEAM - used)
  const people = [{ id: 'me', n: s.profile.n || P.business_name || 'You', em: P.business_email || '', r: 'Owner', st: 'You', g: GRADS[3] },
    ...d.members.map((m, i) => ({ id: m.id, n: m.name || m.email, em: m.email, r: m.role || 'Member', st: 'In', joined: ymd(m.created_at), g: GRADS[i % 3], img: m.avatar_url })),
    ...invites.map(r => ({ id: r.id, n: r.email, em: r.email, r: r.role || 'Member', st: r.expired ? 'Expired' : 'Invited', invited: ymd(r.created_at), inv: true, g: 'var(--bg-3)' }))]
  const m = people.find(x => x.id === sel)
  const run = async (id, fn, ok) => { if (busy) return; setBusy(id); try { await fn(); await load(); if (ok) toast(ok) } catch (e) { toast(e.message) } finally { setBusy('') } }
  const invite = () => {
    if (!free) return toast('Your team is full (' + MAX_TEAM + ' people). Remove someone or cancel an invite first.')
    F.open({ title: 'Invite someone', sub: 'They get an email with a link. When they accept, they get their own Elite workspace and show on your team.', cta: 'Send invite', working: 'Sending',
      fields: [{ k: 'em', l: 'Their email', type: 'email', required: true, placeholder: 'name@example.com' }, { k: 'r', l: 'Role', type: 'select', value: 'Second shooter', options: ROLE_OPTS, hint: 'A label so you know who does what. It does not give access to your workspace.' }],
      submit: async v => { try { await live.inviteTeam(v.em, v.r); await load(); toast('Invite sent to ' + v.em.trim() + '.') } catch (e) { toast(e.message); return false } } })
  }
  const resend = x => run(x.id, () => live.resendTeamInvite(x.id), 'Invite sent again to ' + x.em + '.')
  const cancel = x => F.confirm({ title: 'Cancel the invite for ' + x.em + '?', body: 'The link in their email stops working. You can invite them again any time.', cta: 'Cancel invite', danger: true, onYes: () => run(x.id, () => live.cancelTeamInvite(x.id), 'Invite cancelled.').then(() => sel === x.id && setSel(null)) })
  const remove = x => F.confirm({ title: 'Remove ' + x.n + ' from your team?', body: 'They come off your team list. Their own LensTrybe account stays theirs.', cta: 'Remove', danger: true, onYes: () => run(x.id, () => live.removeTeamMember(x.id), x.n + ' is off your team.').then(() => sel === x.id && setSel(null)) })
  const sub = x => x.st === 'You' ? 'Owner' : x.inv ? (x.st === 'Expired' ? 'Invite expired ' + nice(x.invited) : 'Invited ' + nice(x.invited)) : 'Joined ' + nice(x.joined)
  const acts = x => x.inv ? <><button disabled={!!busy} onClick={e => { e.stopPropagation(); resend(x) }}>{busy === x.id ? 'Sending' : 'Resend'}</button><button disabled={!!busy} onClick={e => { e.stopPropagation(); cancel(x) }}>Cancel</button></> : x.st === 'In' ? <button disabled={!!busy} onClick={e => { e.stopPropagation(); remove(x) }}>Remove</button> : null
  const Row = ({ x }) => <div className={'r' + (sel === x.id ? ' on' : '')} onClick={() => setSel(x.id)} style={sel === x.id ? { borderColor: 'var(--sig-rim)', boxShadow: '0 0 0 3px var(--sig-bg)' } : undefined}><span className="av" style={x.img ? { backgroundImage: 'url(' + x.img + ')', backgroundSize: 'cover' } : { background: x.g }} /><div><b>{x.n} · {x.r}</b><small>{x.em}{x.em ? ' · ' : ''}{sub(x)}</small></div><div className="do"><span className={'st ' + (x.st === 'You' ? 'now' : x.st === 'Invited' ? 'viewed' : x.st === 'Expired' ? 'grey' : 'ok')}>{x.st}</span>{acts(x)}</div></div>
  const inList = people.filter(x => !x.inv), invList = people.filter(x => x.inv)
  return (
    <section className="view">
      <div className="vh"><div><h1>Team</h1><p>Up to {MAX_TEAM} people on your Elite team. Each one gets their own LensTrybe workspace; they don't see yours.</p></div><div className="acts"><span className="btn g" style={{ cursor: 'default' }}>{used} of {MAX_TEAM} places</span><button className="btn w" onClick={invite}><Icon name="plus" size={15} />Invite</button></div></div>
      <div className="grid">
        <div className="s12"><div className="kp">{[['Places', used + ' of ' + MAX_TEAM, free ? free + ' free' : 'all taken', free ? '' : 'w'], ['On the team', d.members.length, d.members.length ? d.members.map(x => (x.name || x.email).split(' ')[0]).join(', ') : 'nobody yet', 'n'], ['Invited', invites.filter(r => !r.expired).length, invites.some(r => !r.expired) ? 'waiting on ' + invites.filter(r => !r.expired).map(r => r.email.split('@')[0]).join(', ') : 'nobody waiting', ''], ['Expired invites', invites.filter(r => r.expired).length, invites.some(r => r.expired) ? 'resend to try again' : 'none', invites.some(r => r.expired) ? 'w' : '']].map(([l, v, e, w]) => <div key={l} className="k lg"><small>{l}</small><b>{v}</b><em className={w}>{e}</em></div>)}</div></div>
        <div className="card lg s8"><div className="h"><b>People</b><small className="lumi-by">{d.members.length} on the team · {invList.length} invited</small></div>
          <div className="need">{inList.map(x => <Row key={x.id} x={x} />)}</div>
          {invList.length > 0 && <><div className="h" style={{ marginTop: 22 }}><b>Invited</b><small className="lumi-by">Invites last {TTL_DAYS} days. Resend if it has been a while.</small></div>
            <div className="need">{invList.map(x => <Row key={x.id} x={x} />)}</div></>}
          {d.members.length === 0 && invList.length === 0 && <p className="note2" style={{ marginTop: 14 }}>Nobody on your team yet. Invite a second shooter or editor you work with often.</p>}
        </div>
        <div className="s4 side">
          {m && m.st !== 'You' ? <div className="card lg"><div className="h"><b style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="av" style={{ ...(m.img ? { backgroundImage: 'url(' + m.img + ')', backgroundSize: 'cover' } : { background: m.g }), width: 30, height: 30, borderRadius: 10 }} />{m.n}</b></div>
            <div className="kv"><span>Role</span><b>{m.r}</b></div><div className="kv"><span>Email</span><b>{m.em}</b></div>
            {m.inv ? <div className="kv"><span>Invited</span><b>{nice(m.invited)} · {daysBetween(m.invited, TODAY)} days ago{m.st === 'Expired' ? ' · expired' : ''}</b></div> : <div className="kv"><span>Joined</span><b>{nice(m.joined, { year: 'numeric' })}</b></div>}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>{m.inv ? <><button className="btn w sm" disabled={!!busy} onClick={() => resend(m)}>Resend invite</button><button className="btn g sm" disabled={!!busy} onClick={() => cancel(m)}>Cancel</button></> : <button className="btn g sm" disabled={!!busy} onClick={() => remove(m)}>Remove</button>}</div>
          </div> : <div className="card lg"><div className="h"><b>How your team works</b></div>
            <div className="kv"><span>Invite</span><b>By email. The link lasts {TTL_DAYS} days.</b></div>
            <div className="kv"><span>They get</span><b>Their own workspace on Elite</b></div>
            <div className="kv"><span>They see</span><b>Only their own work, not yours</b></div>
            <div className="kv"><span>Role</span><b>A label so you know who does what</b></div>
            <div className="kv"><span>Remove</span><b>Takes them off your team list</b></div></div>}
        </div>
      </div>
    </section>
  )
}
