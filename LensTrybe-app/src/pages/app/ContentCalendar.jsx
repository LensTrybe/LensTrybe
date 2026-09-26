import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Still from '../../components/Still'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { TODAY as T0, iso, parse, addDays, nice } from '../../lib/store'
import { LIVE } from '../../lib/mode'

// Content calendar: what goes out where, and when. A week at a glance, the post on the right, and the
// channels it goes to, live from Channels. Scheduling and posting go through the same flows the real
// APIs will, so the buttons do not change when the platforms are wired up.
const CH = { ig: ['Instagram', '#E1306C'], fb: ['Facebook', '#4A9EFF'], tt: ['TikTok', '#f4f2f7'], li: ['LinkedIn', '#0A66C2'], gm: ['Google', '#34A853'] }
const KIND = { image: 'Photo', carousel: 'Carousel', reel: 'Reel', story: 'Story', video: 'Video' }
const TODAY = parse(T0)
const short = d => d.toLocaleDateString('en-AU', { weekday: 'short' }), longd = d => d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
const ST = { posted: 'Posted', today: 'Today', scheduled: 'Scheduled', draft: 'Draft', idea: 'Idea' }
const hhmm = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return (h % 12 || 12) + (m ? ':' + String(m).padStart(2, '0') : '') + (h < 12 ? ' am' : ' pm') }
const monday = d => { const x = new Date(d); x.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return x }

export default function ContentCalendar() {
  const F = useFlows(); const { s, toast } = F; const posts = s.posts, CHN = s.channels
  const [start, setStart] = useState(monday(TODAY)), [sel, setSel] = useState(LIVE ? null : 3), [drag, setDrag] = useState(null), [over, setOver] = useState(null)
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d }), [start])
  const p = posts.find(x => x.id === sel)
  const upd = (k, v) => F.upd('posts', sel, { [k]: v })
  const on = id => LIVE || CHN.find(c => c.id === id)?.on
  const movePost = () => F.open({ title: 'Move · ' + p.t, cta: 'Move', fields: [{ k: 'd', l: 'Day', type: 'date', required: true, value: p.d, min: T0, half: true }, { k: 'time', l: 'Time', type: 'time', value: p.time || '19:30', half: true, hint: 'Best for that day: ' + hhmm(F.bestTime(p.d)) }], submit: v => { F.upd('posts', sel, { d: v.d, time: v.time }); setStart(monday(parse(v.d))); toast('Moved to ' + longd(parse(v.d)) + ', ' + hhmm(v.time) + '.') } })
  const rewrite = () => { const takes = [p.body, p.body.split('. ')[0] + '. That is the whole story.', 'Quick one: ' + p.body.charAt(0).toLowerCase() + p.body.slice(1)]; F.open({ title: 'Rewrite', sub: LIVE ? 'Three quick takes. Pick one or edit it.' : 'Three takes in your voice, from your last forty posts. Pick one or edit it.', cta: 'Use this', fields: [{ k: 'body', l: 'Caption', type: 'select', value: takes[0], options: takes.map((t, i) => [t, ['As written', 'Shorter', 'Casual'][i] + ' · ' + t.slice(0, 48) + '…']) }, { k: 'edit', l: 'Or edit', type: 'textarea', rows: 4, value: p.body }], submit: v => { upd('body', v.edit !== p.body ? v.edit : v.body); toast('Caption updated.') } }) }
  const remove = () => F.confirm({ title: 'Delete this post?', body: p.t, cta: 'Delete', danger: true, onYes: () => { F.del('posts', p.id); setSel(null); toast('Deleted.') } })
  const move = n => setStart(x => { const d = new Date(x); d.setDate(x.getDate() + n * 7); return d })
  const week = posts.filter(x => days.some(d => iso(d) === x.d))
  // drag a post onto another day; posted ones stay where they went out
  const dragProps = x => x.st === 'posted' ? {} : { draggable: true, onDragStart: ev => { ev.dataTransfer.setData('text/plain', String(x.id)); ev.dataTransfer.effectAllowed = 'move'; setDrag(x.id) }, onDragEnd: () => { setDrag(null); setOver(null) } }
  const dropProps = k => k < T0 ? {} : { onDragOver: ev => { if (drag != null) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; if (over !== k) setOver(k) } }, onDragLeave: ev => { if (!ev.currentTarget.contains(ev.relatedTarget)) setOver(null) }, onDrop: ev => { ev.preventDefault(); const id = Number(ev.dataTransfer.getData('text/plain')) || drag; setOver(null); setDrag(null); const x = posts.find(y => y.id === id); if (!x || x.d === k) return; F.upd('posts', id, { d: k, st: x.st === 'today' ? 'scheduled' : x.st }); setSel(id); toast('Moved to ' + longd(parse(k)) + (x.time ? ', ' + hhmm(x.time) : '') + '.') } }
  const reach30 = (s.insights || []).filter(x => x.d >= addDays(T0, -29)).reduce((t, x) => t + (x.ig || 0) + (x.fb || 0) + (x.tt || 0) + (x.li || 0), 0)
  const lead = ['ig', 'fb', 'tt', 'li'].map(c => [c, (s.insights || []).filter(x => x.d >= addDays(T0, -29)).reduce((t, x) => t + (x[c] || 0), 0)]).sort((a, b) => b[1] - a[1])[0]
  const connected = CHN.filter(c => c.on)
  const wkLabel = start.getTime() === monday(TODAY).getTime() ? 'This week' : nice(iso(start)) + ' – ' + nice(iso(days[6]))
  return (
    <section className="view ccal">
      <div className="vh">
        <div><h1>Content calendar</h1><p>What goes out where, and when. {week.filter(x => x.st === 'scheduled' || x.st === 'today').length} scheduled this week, {week.filter(x => x.st === 'draft').length} still drafts.</p></div>
        <div className="acts">
          <div className="mnav"><button onClick={() => move(-1)} aria-label="Previous week"><Icon name="back" size={15} /></button><button className="today" onClick={() => setStart(monday(TODAY))}>{wkLabel}</button><button onClick={() => move(1)} aria-label="Next week" className="fwd"><Icon name="back" size={15} /></button></div>
          <Link className="btn g" to="/app/content-ideas"><Icon name="spark" size={15} />Ideas</Link>
          <button className="btn w" onClick={() => F.newPost({ then: id => setSel(id) })}><Icon name="plus" size={15} />New post</button>
        </div>
      </div>
      <div className="grid">
        <div className="s12"><div className="kp">
          {(LIVE ? [['Posted this month', String(posts.filter(x => x.st === 'posted' && x.d.startsWith(T0.slice(0, 7))).length), 'marked as posted', ''], ['Planned this week', String(week.filter(x => x.st === 'scheduled' || x.st === 'today').length), week.filter(x => x.st === 'today').length ? week.filter(x => x.st === 'today').length + ' today' : 'nothing today', ''], ['Drafts', String(posts.filter(x => x.st === 'draft').length), 'not planned yet', 'n'], ['Ideas', String((s.ideas || []).length), 'waiting in Content ideas', 'n']] : [['Posted this month', String(posts.filter(x => x.st === 'posted' && x.d.startsWith(T0.slice(0, 7))).length), '▲ 3 on August', ''], ['Reach, 30 days', reach30.toLocaleString(), (CH[lead[0]]?.[0] || 'Instagram') + ' leads it', ''], ['Enquiries from posts', '3', 'Ruby found you here', 'n'], ['Connected', connected.length + ' of ' + CHN.length, CHN.some(c => !c.on) ? CHN.filter(c => !c.on).map(c => c.n).join(', ') + ' not yet' : 'all channels', 'n']]).map(([l, v, e, w]) => <div key={l} className="k lg"><small>{l}</small><b>{v}</b><em className={w}>{e}</em></div>)}
        </div></div>

        <div className="card lg s8 calc">
          <div className="week">
            {days.map(d => { const k = iso(d), list = posts.filter(x => x.d === k).sort((a, b) => (a.time || '') < (b.time || '') ? -1 : 1), isT = k === T0; return (
              <div key={k} className={'wd' + (isT ? ' today' : '') + (k < T0 ? ' past' : '') + (over === k ? ' over' : '')} {...dropProps(k)}>
                <div className="wdh"><small>{short(d)}</small><b>{d.getDate()}</b>{isT && <em>Today</em>}</div>
                {list.map(x => <button key={x.id} type="button" className={'wp st-' + x.st + (sel === x.id ? ' on' : '') + (drag === x.id ? ' lift' : '')} {...dragProps(x)} onClick={() => setSel(x.id)}>
                  <span className="th">{x.cover ? <img src={x.cover} alt="" /> : <Still seed={x.s} mood={x.m} />}<em className="kd">{KIND[x.kind || 'image']}</em></span>
                  <b>{x.t}</b>
                  <span className="chs">{x.ch.map(c => <i key={c} style={{ background: CH[c][1], opacity: on(c) ? 1 : .3 }} title={CH[c][0] + (on(c) ? '' : ' · not connected')} />)}<em>{x.time && x.st !== 'posted' ? hhmm(x.time) : ST[x.st]}</em></span>
                </button>)}
                {k >= T0 && <button type="button" className={'wadd' + (list.length ? ' quiet' : '')} onClick={() => F.newPost({ d: k, then: id => setSel(id) })} aria-label={'New post on ' + longd(d)}><Icon name="plus" size={13} />{!list.length && <span>Post</span>}</button>}
              </div>) })}
          </div>
        </div>

        {p ? <div className="s4 side">
          <div className="card lg gsel">
            <div className="cover">{p.cover ? <img src={p.cover} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : <Still seed={p.s + 40} mood={p.m} />}<div className="in"><b>{p.t}</b><small>{longd(parse(p.d))}{p.time ? ' · ' + hhmm(p.time) : ''} · {KIND[p.kind || 'image']}</small></div><span className={'st ' + (p.st === 'posted' ? 'ok' : p.st === 'scheduled' ? 'sent' : 'grey')} style={{ position: 'absolute', top: 12, right: 12 }}>{ST[p.st]}</span></div>
            <div className="chpick">{Object.entries(CH).map(([k, [n, c]]) => <button key={k} type="button" className={(p.ch.includes(k) ? 'on' : '') + (on(k) ? '' : ' off')} style={{ '--c': c }} disabled={p.st === 'posted'} title={on(k) ? n : n + ' is not connected'} onClick={() => { if (!on(k)) return toast(n + ' is not connected. Connect it under Channels.'); upd('ch', p.ch.includes(k) ? p.ch.filter(x => x !== k) : [...p.ch, k]) }}><i />{n}</button>)}</div>
            <textarea className="ta cap" rows={4} value={p.body} onChange={e => upd('body', e.target.value)} aria-label="Caption" disabled={p.st === 'posted'} />
            {p.st === 'posted' && p.metrics && <div className="pm">{Object.entries(p.metrics).map(([c, m]) => <div key={c} className="pmr"><i style={{ background: CH[c][1] }} /><span>{CH[c][0]}</span><b>{(m.reach || 0).toLocaleString()}</b><small>reach</small><b>{m.likes || 0}</b><small>likes</small><b>{m.saves || 0}</b><small>saves</small>{p.pub?.[c]?.url && <a href={p.pub[c].url} target="_blank" rel="noreferrer">Open</a>}</div>)}{p.pub?.tt?.private && <p className="note2 warn2">TikTok: private draft on your account until the app is approved.</p>}</div>}
            <div className="ctas">
              {LIVE && p.body && <button className="btn g sm" onClick={() => { try { navigator.clipboard?.writeText(p.body)?.catch(() => {}) } catch {} toast('Caption copied. Paste it into the app.') }}>Copy caption</button>}{LIVE && p.cover && <a className="btn g sm" href={p.cover} target="_blank" rel="noreferrer" download>Open photo</a>}{p.st === 'posted' ? (LIVE ? <button className="btn g sm" onClick={() => F.unschedulePost(p.id)}>Not posted</button> : <Link className="btn g sm" to="/app/performance">Performance</Link>)
                : p.st === 'scheduled' || p.st === 'today' ? <><button className="btn w sm" onClick={() => F.publishPost(p.id)}>{LIVE ? 'Mark as posted' : 'Post now'}</button><button className="btn g sm" onClick={() => F.unschedulePost(p.id)}>{LIVE ? 'Back to draft' : 'Unschedule'}</button><button className="btn g sm" onClick={movePost}>Move</button></>
                : <><button className="btn w sm" onClick={() => F.schedulePost(p.id)}>{LIVE ? 'Plan it' : 'Schedule'} <Icon name="arrow" size={13} /></button><button className="btn g sm" onClick={() => F.publishPost(p.id)}>{LIVE ? 'Mark as posted' : 'Post now'}</button><button className="btn g sm" onClick={movePost}>Move</button></>}
              {p.st !== 'posted' && <button className="btn g sm" onClick={rewrite}>Rewrite</button>}{p.st !== 'posted' && <button className="btn g sm" onClick={remove}>Delete</button>}
            </div>
          </div>
          {LIVE ? <div className="tlumi"><span className="lm" /><div>{p.st === 'posted' ? 'Posted. It stays here as a record of what went out.' : 'You post it yourself on the day: copy the caption, open the photo, share it in the app, then mark it as posted.'}</div></div> : <div className="tlumi"><span className="lm" /><div>{p.id === 3 ? 'Harper said yes to sharing the sneak peek this morning. Six frames are picked, the quote is hers. Thursday ' + hhmm(F.bestTime(p.d)) + ' is your best hour that day.' : p.st === 'posted' ? 'Numbers refresh nightly and within the hour of posting. Reels are out-reaching stills three to one this month.' : p.ch.some(c => !on(c)) ? CH[p.ch.find(c => !on(c))][0] + ' is on this post but not connected, so it would be skipped. Connect it or drop it.' : 'Scheduled posts go out on their own at the time set, and I put a note in Today when each one lands.'}{p.st === 'draft' && p.id === 3 && <div className="acts"><button className="y" onClick={() => { F.upd('posts', p.id, { time: F.bestTime(p.d) }); F.schedulePost(p.id) }}>Schedule it</button><button onClick={() => toast('Left as a draft.')}>Leave it</button></div>}{p.ch.some(c => !on(c)) && p.st !== 'posted' && <div className="acts"><Link className="y" to="/app/channels">Connect</Link><button onClick={() => upd('ch', p.ch.filter(on))}>Drop it</button></div>}</div></div>}
        </div> : <div className="s4 side"><div className="card lg"><p className="tempty">Pick a post, or add one to any day.</p></div></div>}
      </div>
    </section>
  )
}
