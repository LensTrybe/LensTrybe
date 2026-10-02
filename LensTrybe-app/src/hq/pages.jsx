import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import { api, PLAN, money, day, when, ago, SITE } from './api'
import { useLoad, Head, Tile, Pill, Empty, Err, Loading, useFlash, Modal, Search, Seg, csv } from './ui'
import { can } from './HqApp'
export { Founding, Broadcasts } from './growth'

const PUBLIC = SITE
const n = (c, w) => `${c} ${w}${c === 1 ? '' : 's'}`

// ---------------------------------------------------------------------------------------------
// Overview: the numbers, and what needs someone today.
export function Overview() {
  const { data, err, busy, load } = useLoad(() => api('overview'))
  if (busy && !data) return <Loading />
  if (err) return <><Head title="Overview" /><Err>{err}</Err></>
  const o = data.overview, t = o.by_tier || {}, s = o.subs || {}
  const failing = (data.cron || []).filter(c => c.last_status === 'failed' || c.fails_7d > 0)
  const needs = [
    o.jobs?.no_reply_24h > 0 && { to: '/jobs', tone: 'pink', t: `${o.jobs.no_reply_24h} job${o.jobs.no_reply_24h === 1 ? '' : 's'} with no reply after 24 hours`, s: 'A client is waiting. Nudge a creative near them.' },
    o.support_open > 0 && { to: '/support', tone: 'amber', t: `${o.support_open} open support request${o.support_open === 1 ? '' : 's'}`, s: 'Reply from the Support inbox.' },
    o.reviews_flagged > 0 && { to: '/moderation', tone: 'amber', t: `${o.reviews_flagged} flagged review${o.reviews_flagged === 1 ? '' : 's'}`, s: 'Keep or remove.' },
    o.founding?.applications_new > 0 && { to: '/founding', tone: 'green', t: `${o.founding.applications_new} new founding application${o.founding.applications_new === 1 ? '' : 's'}`, s: 'Invite or dismiss.' },
    s.past_due > 0 && { to: '/users', tone: 'pink', t: `${s.past_due} subscription${s.past_due === 1 ? '' : 's'} past due`, s: 'Card declined. They have been emailed.' },
    failing.length > 0 && { to: '/launch', tone: 'pink', t: `${failing.length} scheduled job${failing.length === 1 ? '' : 's'} failed this week`, s: failing.map(f => f.jobname).join(', ') },
    o.unfinished > 0 && { to: '/users', tone: 'grey', t: `${o.unfinished} sign-up${o.unfinished === 1 ? '' : 's'} never finished`, s: 'Made a login but never picked creative or client.' },
  ].filter(Boolean)
  const days = o.signups_by_day || [], max = Math.max(1, ...days.map(d => d.creatives + d.clients))
  return (
    <>
      <Head title="Overview" sub={'Live numbers. ' + new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }) + ' Brisbane'}><button className="hq-btn g sm" onClick={load}><Icon name="clock" size={14} />Refresh</button></Head>
      <div className="hq-tiles">
        <Tile label="Creatives" value={o.creatives} sub={`${o.listed} listed in Find a creative`} />
        <Tile label="Clients" value={o.clients} sub={`${o.signups_7} new people this week`} />
        <Tile label="Paying" value={s.paying} sub={`${s.trialing} in their free months`} />
        <Tile label="Monthly revenue" value={money(s.mrr_minor)} sub={`${money(s.trial_mrr_minor)} more once free months end`} tone="green" />
        <Tile label="Founding places" value={`${o.founding?.used} / ${o.founding?.cap}`} sub={`${o.founding?.redeemed} signed up`} />
        <Tile label="Open jobs" value={o.jobs?.open} sub={`${o.jobs?.replies_7} replies this week`} />
        <Tile label="Waitlist" value={o.waitlist} sub="Outside South East Queensland" />
        <Tile label="The Trybe Edit" value={o.edit_readers} sub="Opted-in readers" />
      </div>
      <div className="hq-cols">
        <section className="hq-card"><h2>Needs someone</h2>
          {needs.length ? needs.map((n, i) => <Link key={i} to={n.to} className="hq-need"><i className={'dot ' + n.tone} /><div><b>{n.t}</b><small>{n.s}</small></div><Icon name="arrow" size={14} /></Link>) : <Empty>Nothing needs anyone right now.</Empty>}
          {data.unanswered?.length > 0 && <><h3>Jobs still waiting for a reply</h3>{data.unanswered.map(j => <div key={j.id} className="hq-row"><div><b>{j.title}</b><small>{j.location} · posted {ago(j.created_at)}</small></div><a className="hq-link" href={`${PUBLIC}/jobs/${j.id}`} target="_blank" rel="noreferrer">Open</a></div>)}</>}
        </section>
        <section className="hq-card"><h2>Sign-ups, last 30 days</h2>
          <div className="hq-bars" role="img" aria-label="Sign-ups per day for the last 30 days">{days.map(d => <div key={d.d} title={`${day(d.d)}: ${d.creatives} creatives, ${d.clients} clients`}><i className="c" style={{ height: (d.creatives / max * 100) + '%' }} /><i className="k" style={{ height: (d.clients / max * 100) + '%' }} /></div>)}</div>
          <div className="hq-legend"><span><i className="c" />Creatives</span><span><i className="k" />Clients</span><span>{o.signups_30} in 30 days · {o.active_7} signed in this week</span></div>
          <h3>Creatives by plan</h3>
          {['basic', 'pro', 'expert', 'elite'].map(k => <div key={k} className="hq-plan"><span>{PLAN[k]}</span><div><i style={{ width: ((t[k] || 0) / Math.max(1, o.creatives) * 100) + '%' }} /></div><b>{t[k] || 0}</b></div>)}
          {s.next_charge && <p className="hq-note">Next card charge: {day(s.next_charge)}.</p>}
        </section>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Launch and health: scheduled jobs, the configuration check, site switches, test accounts.
export function Launch({ me }) {
  const h = useLoad(() => api('health'))
  const st = useLoad(() => can(me, 'admin') ? api('settings') : Promise.resolve({ settings: [] }))
  const u = useLoad(() => api('users'))
  const [flash, flashNode] = useFlash()
  const get = k => (st.data?.settings || []).find(x => x.key === k)?.value
  const set = async (key, value) => { try { await api('settings_set', { key, value }); flash('Saved. The site picks it up on the next page load.'); st.load() } catch (e) { flash(e.message, 'bad') } }
  const tests = (u.data?.users || []).filter(x => /^test[-_.+]|@example\.|\+test@/i.test(x.email || ''))
  const cfg = h.data?.config
  return (
    <>
      <Head title="Launch and health" sub="Is everything that runs by itself running? And the switches for the public site." />{flashNode}
      <section className="hq-card"><h2>Scheduled jobs</h2><p className="hq-note">These run on their own. "Succeeded" means the job fired; a failure inside the function shows in its own logs and in the configuration check below.</p>
        {h.busy && !h.data ? <Loading /> : <Err>{h.err}</Err>}
        {h.data && <div className="hq-table"><table><thead><tr><th>Job</th><th>When (UTC)</th><th>Last run</th><th>Result</th><th>Failures, 7 days</th></tr></thead><tbody>
          {h.data.cron.map(c => <tr key={c.jobname}><td><b>{c.jobname}</b>{!c.active && <Pill tone="pink">Switched off</Pill>}</td><td><code>{c.schedule}</code></td><td>{c.last_start ? ago(c.last_start) : 'Never'}</td><td>{c.last_status === 'succeeded' ? <Pill tone="green">Succeeded</Pill> : c.last_status ? <Pill tone="pink">{c.last_status}</Pill> : <Pill>Not yet</Pill>}</td><td>{c.fails_7d ? <Pill tone="pink">{c.fails_7d}</Pill> : 0}</td></tr>)}
        </tbody></table></div>}
      </section>
      <section className="hq-card"><h2>Configuration check</h2>
        {!h.data ? null : !cfg ? <Empty>The configuration check didn't answer.</Empty> : <Checks value={cfg} />}
      </section>
      {can(me, 'admin') && <section className="hq-card"><h2>Public site switches</h2>
        <div className="hq-setting"><div><b>Home page hero</b><small>"Ask" is the Lumi search with Post a job under it. "Job" is the Post a job hero on its own.</small></div><Seg value={get('home_hero') || 'ask'} onChange={v => set('home_hero', v)} options={[['ask', 'Ask'], ['job', 'Job']]} /></div>
        <div className="hq-setting"><div><b>Launch offer ends</b><small>Until then every plan, Trybe Free included, can reply to any job. Replies close at midnight at the start of {get('jobs_open_until') ? day(get('jobs_open_until')) : 'a date not set yet'}, Brisbane time.</small></div><input type="date" className="hq-input" defaultValue={get('jobs_open_until') ? new Date(get('jobs_open_until')).toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' }) : ''} key={get('jobs_open_until')} onChange={e => e.target.value && set('jobs_open_until', e.target.value + 'T00:00:00+10:00')} /></div>
      </section>}
      <section className="hq-card"><h2>Test accounts to remove before launch</h2>
        {!u.data ? <Loading /> : tests.length ? tests.map(t => <div key={t.id} className="hq-row"><div><b>{t.email}</b><small>{t.kind} · {t.name || 'No name'} · joined {day(t.created_at)}</small></div><Link className="hq-link" to={'/users?open=' + t.id}>Open</Link></div>) : <Empty>No test accounts left.</Empty>}
      </section>
    </>
  )
}
function Checks({ value }) {
  // config-check answers with labels and true/false, never a secret. Show whatever it returns.
  const rows = []
  const walk = (v, path) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.entries(v).forEach(([k, x]) => walk(x, path ? path + ' · ' + k : k))
    else rows.push([path, v])
  }
  walk(value, '')
  return <div className="hq-checks">{rows.map(([k, v]) => <div key={k}><span>{k.replace(/_/g, ' ')}</span>{v === true ? <Pill tone="green">OK</Pill> : v === false ? <Pill tone="pink">Problem</Pill> : <code>{String(v)}</code>}</div>)}</div>
}

// ---------------------------------------------------------------------------------------------
// People: every creative and client, with the account tools.
const DISPOSABLE = ['mailinator', 'guerrillamail', 'tempmail', '10minutemail', 'trashmail', 'yopmail', 'sharklasers', 'getnada', 'dispostable', 'throwaway', 'maildrop', 'temp-mail', 'fakeinbox']
function worth(u) {
  const e = (u.email || '').toLowerCase(), local = e.split('@')[0] || '', dom = e.split('@')[1] || ''
  if (u.kind === 'unfinished' && Date.now() - new Date(u.created_at).getTime() > 864e5) return 'Signed up over a day ago and never finished'
  if (DISPOSABLE.some(d => dom.includes(d))) return 'Throwaway email address'
  if ((local.match(/\d/g) || []).length >= 6) return 'Email is mostly numbers'
  if (!u.confirmed && Date.now() - new Date(u.created_at).getTime() > 3 * 864e5) return 'Never confirmed their email'
  return null
}
export function Users({ me }) {
  const { data, err, busy, load } = useLoad(() => api('users'))
  const [q, setQ] = useState(''), [kind, setKind] = useState('all'), [open, setOpen] = useState(() => new URLSearchParams(location.search).get('open'))
  const all = data?.users || []
  const list = useMemo(() => all.filter(u => {
    if (kind === 'creative' && u.kind !== 'creative') return false
    if (kind === 'client' && u.kind !== 'client') return false
    if (kind === 'paying' && !['active', 'trialing', 'past_due'].includes(u.sub_status)) return false
    if (kind === 'look' && !worth(u)) return false
    if (kind === 'suspended' && !(u.banned_until && new Date(u.banned_until) > new Date())) return false
    const s = q.trim().toLowerCase()
    return !s || [u.email, u.name, u.location].some(v => String(v || '').toLowerCase().includes(s))
  }), [all, q, kind])
  const exportCsv = () => csv(list.map(u => ({ email: u.email, name: u.name || '', kind: u.kind, plan: u.tier ? PLAN[u.tier] : '', subscription: u.sub_status || '', founding: u.founding ? 'yes' : '', location: u.location || '', joined: day(u.created_at), last_sign_in: u.last_sign_in_at ? day(u.last_sign_in_at) : 'never' })), `lenstrybe-people-${new Date().toISOString().slice(0, 10)}.csv`)
  const look = all.filter(worth).length
  return (
    <>
      <Head title="People" sub={data ? `${all.length} logins: ${n(all.filter(u => u.kind === 'creative').length, 'creative')}, ${n(all.filter(u => u.kind === 'client').length, 'client')}` : ''}>{can(me, 'admin') && <button className="hq-btn g sm" onClick={exportCsv} disabled={!list.length}><Icon name="deliver" size={14} />Export CSV</button>}</Head>
      <div className="hq-bar"><Search value={q} onChange={setQ} placeholder="Name, email or town" /><Seg value={kind} onChange={setKind} options={[['all', 'Everyone'], ['creative', 'Creatives'], ['client', 'Clients'], ['paying', 'Subscribed'], ['look', `Worth a look${look ? ' (' + look + ')' : ''}`], ['suspended', 'Suspended']]} /></div>
      <Err>{err}</Err>
      {busy && !data ? <Loading /> : <div className="hq-table"><table><thead><tr><th>Person</th><th>Type</th><th>Plan</th><th>Joined</th><th>Last in</th><th /></tr></thead><tbody>
        {list.map(u => { const w = worth(u); const banned = u.banned_until && new Date(u.banned_until) > new Date(); return (
          <tr key={u.id} className="click" onClick={() => setOpen(u.id)}>
            <td><b>{u.name || u.email}</b><small>{u.name ? u.email : ''}{u.location ? (u.name ? ' · ' : '') + u.location : ''}</small>{w && <small className="warn">{w}</small>}</td>
            <td>{u.kind === 'creative' ? 'Creative' : u.kind === 'client' ? 'Client' : <Pill tone="amber">Unfinished</Pill>}{u.founding && <Pill tone="green">Founding</Pill>}{banned && <Pill tone="pink">Suspended</Pill>}{u.pending_deletion && <Pill tone="pink">Deleting</Pill>}{u.old_admin && <Pill>Old admin</Pill>}</td>
            <td>{u.tier ? PLAN[u.tier] : ''}{u.comp_tier && <small>complimentary</small>}{u.sub_status && <small>{u.sub_status === 'trialing' ? 'free months' : u.sub_status.replace('_', ' ')}</small>}</td>
            <td>{day(u.created_at)}</td><td>{ago(u.last_sign_in_at)}</td><td><Icon name="chev" size={14} /></td>
          </tr>) })}
      </tbody></table>{!list.length && <Empty>Nobody matches.</Empty>}</div>}
      {open && <Person id={open} me={me} onClose={() => { setOpen(null); history.replaceState(null, '', location.pathname) }} onChanged={load} />}
    </>
  )
}
function Person({ id, me, onClose, onChanged }) {
  const { data, err, busy, load } = useLoad(() => api('user', { id }), [id])
  const [flash, flashNode] = useFlash()
  const [ask, setAsk] = useState(null), [text, setText] = useState(''), [working, setWorking] = useState(false)
  const u = data?.user, p = u?.profile, cl = u?.client, sub = u?.subscriptions?.[0]
  const banned = u?.banned_until && new Date(u.banned_until) > new Date()
  const act = async (action, extra, msg) => { setWorking(true); try { await api(action, { id, ...extra }); flash(msg); setAsk(null); setText(''); load(); onChanged() } catch (e) { flash(e.message, 'bad') } setWorking(false) }
  return (
    <Modal title={u ? (p?.business_name || [cl?.first_name, cl?.last_name].filter(Boolean).join(' ') || u.email) : 'Person'} onClose={onClose} wide>
      {flashNode}
      {busy && !u ? <Loading /> : err ? <Err>{err}</Err> : <div className="hq-person">
        <div className="hq-kv">
          <div><span>Email</span><b>{u.email}{!u.confirmed && <Pill tone="amber">Not confirmed</Pill>}</b></div>
          <div><span>Type</span><b>{p ? 'Creative' : cl ? 'Client' : 'Unfinished sign-up'}{banned && <Pill tone="pink">Suspended</Pill>}</b></div>
          <div><span>Joined</span><b>{when(u.created_at)}</b></div>
          <div><span>Last signed in</span><b>{u.last_sign_in_at ? when(u.last_sign_in_at) : 'Never'}</b></div>
          <div><span>Signs in with</span><b>{(u.providers || []).join(', ') || 'email'}</b></div>
          {p && <><div><span>Plan</span><b>{PLAN[(p.subscription_tier || 'basic').toLowerCase()]}{p.comp_tier && ' (complimentary)'}</b></div>
            <div><span>Listed</span><b>{p.is_listed ? 'Yes, in Find a creative' : 'No'}</b></div>
            <div><span>Where</span><b>{[p.city, p.state].filter(Boolean).join(', ') || 'Not set'}</b></div>
            <div><span>Does</span><b>{(p.skill_types || []).join(', ') || 'Not set'}</b></div>
            {p.founding_member && <div><span>Founding</span><b>Since {day(p.founding_member_since)} · deal {p.founding_deal_status || 'active'}</b></div>}
            {p.is_admin && <div><span>Old admin</span><b>Admin on the old site (lenstrybe.com/dashboard/admin)</b></div>}</>}
          {sub && <div><span>Subscription</span><b>{PLAN[sub.tier] || sub.tier} {sub.billing} · {sub.status === 'trialing' ? 'free months' : sub.status}{sub.amount_minor ? ' · ' + money(sub.amount_minor) : ''}{sub.next_charge_date ? ' · next charge ' + day(sub.next_charge_date) : ''}{sub.card_last4 ? ` · ${sub.card_brand || 'card'} ending ${sub.card_last4}` : ''}{sub.failed_attempts ? ` · ${sub.failed_attempts} failed` : ''}</b></div>}
          {u.deletion && <div><span>Deletion</span><b>{u.deletion.status}, {u.deletion.scheduled_for ? 'goes on ' + day(u.deletion.scheduled_for) : ''}</b></div>}
        </div>
        {Object.keys(u.counts || {}).length > 0 && <div className="hq-mini">{Object.entries(u.counts).map(([k, v]) => <div key={k}><b>{v}</b><small>{(k[0].toUpperCase() + k.slice(1)).replace('_', ' ')}</small></div>)}</div>}
        {p && <a className="hq-link" href={`${PUBLIC}/creatives/${u.id}`} target="_blank" rel="noreferrer">Open their public profile</a>}
        {u.tickets?.length > 0 && <><h3>Support requests</h3>{u.tickets.map(t => <div key={t.id} className="hq-row"><div><b>{t.subject || 'No subject'}</b><small>{day(t.created_at)} · {t.status}</small></div></div>)}</>}
        {can(me, 'admin') && <div className="hq-danger">
          {p && <div className="hq-setting"><div><b>Plan</b><small>Anything above what they pay for is recorded as complimentary, so billing can't undo it. This does not change what they are charged.</small></div>
            <select className="hq-input" value={(p.subscription_tier || 'basic').toLowerCase()} disabled={working} onChange={e => act('user_plan', { tier: e.target.value }, 'Plan changed to ' + PLAN[e.target.value] + '.')}>{Object.entries(PLAN).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>}
          {p && !p.founding_member && <div className="hq-setting"><div><b>Founding place</b><small>Emails them a founding code. They use it on the account they already have (Founding hub), so nothing is deleted and they sign up again for nothing. 12 months free and the badge while places last.</small></div>
            <button className="hq-btn g sm" disabled={working} onClick={() => act('founding', { payload: { action: 'create', send: true, invites: [{ name: p.business_name || u.email, email: u.email, skill_type: (p.skill_types || [])[0] || null, region: p.state || null }] } }, 'Founding invite sent to ' + u.email + '.')}>Offer a founding place</button></div>}
          <div className="hq-setting"><div><b>{banned ? 'Suspended' : 'Suspend'}</b><small>{banned ? 'They cannot sign in. Nothing is deleted.' : 'Stops them signing in. Nothing is deleted and it can be undone.'}</small></div>
            {banned ? <button className="hq-btn g sm" disabled={working} onClick={() => act('user_unban', {}, 'They can sign in again.')}>Lift suspension</button> : <button className="hq-btn g sm" onClick={() => setAsk('ban')}>Suspend</button>}</div>
          <div className="hq-setting"><div><b>Delete account</b><small>Removes the login and everything tied to it, for good. Refused while they have a live subscription.</small></div><button className="hq-btn bad sm" onClick={() => setAsk('delete')}>Delete</button></div>
        </div>}
        {ask === 'ban' && <div className="hq-confirm"><b>Why are you suspending them?</b><textarea className="hq-input" value={text} onChange={e => setText(e.target.value)} placeholder="Goes in the activity log" autoFocus /><div><button className="hq-btn g sm" onClick={() => setAsk(null)}>Cancel</button><button className="hq-btn bad sm" disabled={working || !text.trim()} onClick={() => act('user_ban', { reason: text }, 'Suspended.')}>Suspend</button></div></div>}
        {ask === 'delete' && <div className="hq-confirm"><b>Type {u.email} to delete this account for good</b><input className="hq-input" value={text} onChange={e => setText(e.target.value)} autoFocus autoComplete="off" /><div><button className="hq-btn g sm" onClick={() => setAsk(null)}>Cancel</button><button className="hq-btn bad sm" disabled={working || text.trim().toLowerCase() !== u.email.toLowerCase()} onClick={async () => { setWorking(true); try { await api('user_delete', { id, confirm: text }); onChanged(); onClose() } catch (e) { flash(e.message, 'bad'); setWorking(false) } }}>Delete for good</button></div></div>}
      </div>}
    </Modal>
  )
}

// ---------------------------------------------------------------------------------------------
// Job board: every job clients post, and whether anyone has answered.
export function Jobs({ me }) {
  const { data, err, busy, load } = useLoad(() => api('jobs'))
  const [f, setF] = useState('open'), [open, setOpen] = useState(null), [replies, setReplies] = useState(null), [closing, setClosing] = useState(null), [why, setWhy] = useState('')
  const [flash, flashNode] = useFlash()
  const jobs = (data?.jobs || []).filter(j => f === 'all' || (f === 'open' && j.status === 'active') || (f === 'none' && j.status === 'active' && !j.replies))
  const show = async j => { if (open === j.id) { setOpen(null); return } setOpen(j.id); setReplies(null); try { setReplies((await api('job_replies', { id: j.id })).replies) } catch { setReplies([]) } }
  const close = async () => { try { await api('job_close', { id: closing.id, reason: why }); flash('Job closed.'); setClosing(null); setWhy(''); load() } catch (e) { flash(e.message, 'bad') } }
  return (
    <>
      <Head title="Job board" sub="Every job a client posts. The first days after launch, no job should go unanswered." />{flashNode}
      <div className="hq-bar"><Seg value={f} onChange={setF} options={[['open', 'Open'], ['none', 'No replies yet'], ['all', 'All']]} /></div>
      <Err>{err}</Err>
      {busy && !data ? <Loading /> : !jobs.length ? <Empty>No jobs here.</Empty> : jobs.map(j => (
        <div key={j.id} className="hq-card job">
          <div className="hq-row click" onClick={() => show(j)}>
            <div><b>{j.title}</b><small>{j.location || 'No location'} · {(j.creative_types || []).join(', ')}{j.specialty ? ' · ' + j.specialty : ''}{j.job_date ? ' · for ' + day(j.job_date) : ''}{j.budget_range ? ' · ' + j.budget_range : ''}</small><small>Posted {ago(j.created_at)} by {j.poster_name || 'a client'}{j.poster_email ? ' (' + j.poster_email + ')' : ''}</small></div>
            <div className="hq-right">{j.status !== 'active' ? <Pill>{j.status}</Pill> : j.replies ? <Pill tone="green">{j.replies} repl{j.replies === 1 ? 'y' : 'ies'}</Pill> : <Pill tone={Date.now() - new Date(j.created_at) > 864e5 ? 'pink' : 'amber'}>No replies</Pill>}</div>
          </div>
          {open === j.id && <div className="hq-open">
            {j.description && <p className="hq-quote">{j.description}</p>}
            {replies === null ? <Loading /> : replies.length ? replies.map(r => <div key={r.id} className="hq-row"><div><b>{r.creative_name || 'A creative'}{r.price ? ' · $' + Number(r.price).toLocaleString('en-AU') : ''}</b><small>{ago(r.created_at)}{r.includes ? ' · ' + r.includes : ''}</small>{r.message && <small>{r.message}</small>}</div><Pill>{r.status || 'sent'}</Pill></div>) : <Empty>No replies yet.</Empty>}
            <div className="hq-acts"><a className="hq-btn g sm" href={`${PUBLIC}/jobs/${j.id}`} target="_blank" rel="noreferrer">Open on the site</a>{can(me, 'admin') && j.status === 'active' && <button className="hq-btn bad sm" onClick={() => setClosing(j)}>Take it down</button>}</div>
          </div>}
        </div>))}
      {closing && <Modal title="Take this job down?" onClose={() => setClosing(null)}><p className="hq-sub">"{closing.title}" is closed and no longer shown. The client isn't emailed.</p><textarea className="hq-input" placeholder="Why? Goes in the activity log." value={why} onChange={e => setWhy(e.target.value)} autoFocus /><div className="hq-acts"><button className="hq-btn g sm" onClick={() => setClosing(null)}>Cancel</button><button className="hq-btn bad sm" disabled={!why.trim()} onClick={close}>Take it down</button></div></Modal>}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Support inbox: requests from the Help page and Settings. Reply by email from here.
export function Support() {
  const { data, setData, err, busy } = useLoad(() => api('support'))
  const [f, setF] = useState('open'), [sel, setSel] = useState(null), [reply, setReply] = useState(''), [notes, setNotes] = useState(null), [working, setWorking] = useState(false)
  const [flash, flashNode] = useFlash()
  const all = data?.tickets || []
  const list = all.filter(t => f === 'all' || (f === 'open' ? (t.status || 'open') !== 'closed' : t.status === 'closed'))
  const t = all.find(x => x.id === sel)
  // On a wide screen, open the first request straight away.
  useEffect(() => { if (!sel && list[0] && innerWidth > 900) setSel(list[0].id) }, [data, f]) // eslint-disable-line react-hooks/exhaustive-deps
  const put = n => setData(d => ({ tickets: d.tickets.map(x => x.id === n.id ? n : x) }))
  const run = async (action, extra, msg) => { setWorking(true); try { const r = await api(action, { id: t.id, ...extra }); put(r.ticket); flash(msg); if (action === 'support_reply') setReply('') } catch (e) { flash(e.message, 'bad') } setWorking(false) }
  return (
    <>
      <Head title="Support inbox" sub="Replies go from LensTrybe Support, and people's answers land in connect@lenstrybe.com." />{flashNode}
      <div className="hq-bar"><Seg value={f} onChange={setF} options={[['open', 'Open'], ['closed', 'Closed'], ['all', 'All']]} /></div>
      <Err>{err}</Err>
      {busy && !data ? <Loading /> : <div className={'hq-split' + (t ? ' open' : '')}>
        <div className="hq-list">{list.length ? list.map(x => <button key={x.id} className={'hq-li' + (x.id === sel ? ' on' : '')} onClick={() => { setSel(x.id); setNotes(null) }}><b>{x.subject || x.category || 'No subject'}</b><small>{x.name || x.email} · {ago(x.created_at)}</small><Pill tone={x.status === 'closed' ? 'grey' : x.status === 'waiting' ? 'amber' : 'green'}>{x.status || 'open'}</Pill></button>) : <Empty>Nothing here.</Empty>}</div>
        {t && <div className="hq-card hq-detail">
          <button className="hq-link back" onClick={() => setSel(null)}><Icon name="back" size={14} />All requests</button>
          <h2>{t.subject || 'No subject'}</h2>
          <p className="hq-sub">{t.name} · <a href={'mailto:' + t.email}>{t.email}</a> · {t.role || 'unknown'} · {t.category || 'general'} · {when(t.created_at)}</p>
          <p className="hq-quote">{t.message}</p>
          <div className="hq-acts"><Seg value={t.status || 'open'} onChange={v => run('support_update', { status: v }, 'Marked ' + v + '.')} options={[['open', 'Open'], ['waiting', 'Waiting on them'], ['closed', 'Closed']]} /></div>
          <h3>Reply by email</h3>
          <textarea className="hq-input tall" value={reply} onChange={e => setReply(e.target.value)} placeholder={`Hi ${String(t.name || '').split(' ')[0] || 'there'}, …`} />
          <div className="hq-acts"><button className="hq-btn w sm" disabled={working || !reply.trim()} onClick={() => run('support_reply', { text: reply }, 'Reply sent.')}>Send reply</button></div>
          <h3>Notes</h3>
          <textarea className="hq-input tall" value={notes ?? (t.admin_notes || '')} onChange={e => setNotes(e.target.value)} placeholder="Only staff see these" />
          {notes !== null && notes !== (t.admin_notes || '') && <div className="hq-acts"><button className="hq-btn g sm" disabled={working} onClick={() => run('support_update', { admin_notes: notes }, 'Notes saved.').then(() => setNotes(null))}>Save notes</button></div>}
        </div>}
      </div>}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
export function Moderation() {
  const { data, setData, err, busy } = useLoad(() => api('reviews'))
  const [flash, flashNode] = useFlash()
  const decide = async (r, keep) => { try { await api('review_decide', { id: r.id, keep }); setData(d => ({ reviews: d.reviews.filter(x => x.id !== r.id) })); flash(keep ? 'Review kept.' : 'Review removed from their profile.') } catch (e) { flash(e.message, 'bad') } }
  return (
    <>
      <Head title="Moderation" sub="Reviews a creative has flagged. Accounts worth a look are under People." />{flashNode}
      <Err>{err}</Err>
      {busy && !data ? <Loading /> : !data?.reviews?.length ? <Empty>No flagged reviews.</Empty> : data.reviews.map(r => (
        <div key={r.id} className="hq-card"><div className="hq-row"><div><b>{'★'.repeat(r.rating || 0)} for {r.business_name || 'a creative'}</b><small>From {r.reviewer_name || r.client_name || 'a client'} · {day(r.created_at)} · flagged {ago(r.flagged_at)}</small></div></div>
          <p className="hq-quote">{r.body || r.comment}</p>{r.flag_reason && <p className="hq-note">Their reason: {r.flag_reason}</p>}
          <div className="hq-acts"><button className="hq-btn g sm" onClick={() => decide(r, true)}>Keep it</button><button className="hq-btn bad sm" onClick={() => decide(r, false)}>Remove it</button></div></div>))}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
export function Activity() {
  const { data, err, busy } = useLoad(() => api('audit'))
  const [q, setQ] = useState('')
  const list = (data?.entries || []).filter(e => !q || JSON.stringify(e).toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <Head title="Activity log" sub="Every change made in HQ and every account opened, by whom and when. It can't be edited or deleted." />
      <div className="hq-bar"><Search value={q} onChange={setQ} placeholder="Find in the log" /></div>
      <Err>{err}</Err>
      {busy && !data ? <Loading /> : <div className="hq-table"><table><thead><tr><th>When</th><th>Who</th><th>What</th><th>Details</th></tr></thead><tbody>
        {list.map(e => <tr key={e.id}><td>{when(e.at)}</td><td>{e.staff_email || 'Nobody signed in'}</td><td><code>{e.action}</code>{e.target && <small>{e.target}</small>}</td><td><small>{e.detail ? Object.entries(e.detail).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ') : ''}{e.ip ? ' · ' + e.ip : ''}</small></td></tr>)}
      </tbody></table>{!list.length && <Empty>Nothing yet.</Empty>}</div>}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Staff (owner only): who has an HQ login, invites, switching a login off.
export function Staff({ me }) {
  const { data, err, busy, load } = useLoad(() => api('staff'))
  const [flash, flashNode] = useFlash()
  const [form, setForm] = useState(null), [working, setWorking] = useState(false)
  const run = async (action, extra, msg) => { setWorking(true); try { await api(action, extra); flash(msg); load() } catch (e) { flash(e.message, 'bad') } setWorking(false) }
  const invite = async e => { e.preventDefault(); await run('staff_invite', form, `Invite emailed to ${form.email}. It works for 48 hours.`); setForm(null) }
  return (
    <>
      <Head title="Staff" sub="Only you can see this. Staff logins are separate from creative and client accounts, and always need two-factor."><button className="hq-btn w sm" onClick={() => setForm({ name: '', email: '', role: 'support' })}><Icon name="plus" size={14} />Invite someone</button></Head>{flashNode}
      <Err>{err}</Err>
      {busy && !data ? <Loading /> : <>
        <div className="hq-table"><table><thead><tr><th>Name</th><th>Role</th><th>Two-factor</th><th>Last active</th><th /></tr></thead><tbody>
          {data.staff.map(s => <tr key={s.user_id}><td><b>{s.name}</b><small>{s.email}</small></td><td>{s.role === 'owner' ? 'Owner' : s.role === 'admin' ? 'Admin' : 'Support'}</td><td>{s.two_factor ? <Pill tone="green">On</Pill> : <Pill tone="amber">Not set up</Pill>}</td><td>{ago(s.last_seen_at)}</td>
            <td><div className="hq-right">{s.role !== 'owner' && s.user_id !== me.id && <>{s.two_factor && <button className="hq-btn g sm" disabled={working} onClick={() => run('staff_reset_2fa', { id: s.user_id }, `${s.name} sets up two-factor again next sign in.`)}>Reset two-factor</button>}
              <button className={'hq-btn sm ' + (s.active ? 'bad' : 'g')} disabled={working} onClick={() => run('staff_active', { id: s.user_id, active: !s.active }, s.active ? `${s.name} can no longer get in.` : `${s.name} can sign in again.`)}>{s.active ? 'Switch off' : 'Switch on'}</button></>}</div></td></tr>)}
        </tbody></table></div>
        <section className="hq-card"><h2>Invites waiting</h2>
          {data.invites.length ? data.invites.map(i => <div key={i.id} className="hq-row"><div><b>{i.name} · {i.email}</b><small>{i.role} · expires {when(i.expires_at)}</small></div><button className="hq-btn g sm" onClick={() => run('staff_invite_revoke', { id: i.id }, 'Invite cancelled.')}>Cancel</button></div>) : <Empty>No invites waiting.</Empty>}
        </section>
        <p className="hq-note">Support can see Overview, Launch and health, People (read only), the Job board, Support and Moderation. Admins can also change plans, suspend and delete accounts, run Founding and Broadcasts, change site switches and read the activity log. Only the owner manages staff.</p>
      </>}
      {form && <Modal title="Invite someone to HQ" onClose={() => setForm(null)}>
        <form onSubmit={invite} className="hq-form">
          <label className="hq-field"><span>Name</span><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required autoFocus /></label>
          <label className="hq-field"><span>Their own email (not a creative or client login)</span><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></label>
          <label className="hq-field"><span>Role</span><select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="support">Support</option><option value="admin">Admin</option></select></label>
          <div className="hq-acts"><button type="button" className="hq-btn g sm" onClick={() => setForm(null)}>Cancel</button><button className="hq-btn w sm" disabled={working}>Send invite</button></div>
        </form>
      </Modal>}
    </>
  )
}
