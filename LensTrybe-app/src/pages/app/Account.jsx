import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Still from '../../components/Still'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { PLANS } from '../../data/workspace'
import { TODAY, nice, iso } from '../../lib/store'
import { MOOD_NAMES } from '../../lib/stills'
import SetupCard from './Setup'
import { completeness } from '../../lib/complete'
import DeleteAccount from './DeleteAccount'
import { useAuth } from '../../backend/AuthContext'
import { LIVE } from '../../lib/mode'
import { changeEmail, downloadMyData, newsletterStatus, sendPasswordReset, setNewsletter } from '../../lib/account'
import { signOut } from '../../lib/auth'
import { useNavigate } from 'react-router-dom'

const Tiles = ({ t }) => <div className="s12"><div className="kp">{t.map(([l, v, e, w]) => <div key={l} className="k lg"><small>{l}</small><b>{v}</b><em className={w}>{e}</em></div>)}</div></div>
const Head = ({ h, p, children }) => <div className="vh"><div><h1>{h}</h1><p>{p}</p></div><div className="acts">{children}</div></div>
const Sw = ({ on, set }) => <span className={'sw2' + (on ? ' on' : '')} role="switch" aria-checked={!!on} onClick={set}><i /></span>
const Fld = ({ l, v, set, area, type = 'text', readOnly }) => <label className="bf"><span>{l}</span>{area ? <textarea className="ta" rows={3} value={v} onChange={e => set(e.target.value)} /> : <input type={type} readOnly={readOnly} style={readOnly ? { opacity: .7 } : undefined} value={v} onChange={e => set(e.target.value)} />}</label>
const read = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v === '1' } catch { return d } }

/* Edit profile: what clients see on lenstrybe.com. Edit once, the website follows. */
export function EditProfile() {
  const F = useFlows(); const { s, toast } = F
  const [p, setP] = useState(s.profile), [dirty, setDirty] = useState(false); const file = useRef(), avf = useRef()
  const [pk, setPk] = useState(s.packages || [])
  useEffect(() => { if (!dirty) setP(s.profile) }, [s.profile, dirty])
  const set = k => v => { setP(x => ({ ...x, [k]: v })); setDirty(true) }
  const tog = p.tog || {}
  const ALL = ['Weddings', 'Elopements', 'Real estate', 'Events', 'Brand', 'Headshots', 'Family', 'Food', 'Drone']
  const shots = p.shots || [0, 1, 2, 3, 4, 5, 6, 7]
  const strength = completeness({ ...s, profile: p, packages: pk }).pct
  const publish = () => { F.set('profile', { ...p, shots, strength }); F.set('packages', pk.filter(x => x[0].trim())); if (p.h || p.bio) F.upd('pages', 'home', { h: p.h, p: (p.bio.split('. ')[0] || '') + (p.bio ? '.' : '') }); setDirty(false); toast('Published. Profile and website updated.') }
  const pickAvatar = e => { const x = e.target.files?.[0]; if (!x) return; const r = new FileReader(); r.onload = () => set('avatar')(r.result); r.readAsDataURL(x); e.target.value = '' }
  const setPkAt = (i, j, v) => { setPk(a => a.map((x, k) => k === i ? x.map((y, l) => l === j ? v : y) : x)); setDirty(true) }
  const addPhotos = () => { file.current.onchange = e => { const n = e.target.files.length; if (!n) return; set('shots')([...shots, ...Array.from({ length: n }, (_, i) => shots.length + i + 20)]); toast(n + (n === 1 ? ' photo' : ' photos') + ' added. Publish when happy.'); e.target.value = '' }; file.current.click() }
  const addFilm = () => F.open({ title: 'Add a film', sub: 'From a delivered gallery, or a link.', cta: 'Add', fields: [{ k: 'from', l: 'Film', type: 'select', value: '', options: [['', 'Paste a link instead'], ...s.galleries.filter(g => g.films).map(g => [g.id, g.n + ' · ' + g.films + (g.films > 1 ? ' films' : ' film')])] }, { k: 'url', l: 'Link', placeholder: 'vimeo.com/…', when: v => !v.from }], submit: v => { set('film')(v.from || v.url); toast('Film added. Publish when happy.') } })
  const removeShot = i => set('shots')(shots.filter((_, j) => j !== i))
  return (
    <section className="view">
      <input ref={file} type="file" multiple accept="image/*" style={{ display: 'none' }} aria-hidden="true" />
      <Head h="Edit profile" p="What clients see on lenstrybe.com. Edit once and your website follows."><Link className="btn g" to="/app/view-profile"><Icon name="eye" size={15} />View as a client</Link><button className={'btn w' + (dirty ? '' : ' quiet')} onClick={publish}>{dirty ? 'Publish changes' : 'Published'}</button></Head>
      <div className="grid">
        <div className="s7 side">
          <div className="card lg"><div className="h"><b>Portfolio</b><small className="lumi-by">Tap a photo to remove · {shots.length} of 40 on {s.plan.name}</small></div>
            <div className="strip2">{shots.map((sd, i) => <span key={sd + '-' + i} className="sg" style={{ cursor: 'pointer' }} onClick={() => i === 0 ? toast('The cover stays. Drag another photo first to change it.') : removeShot(i)} title={i === 0 ? 'Cover' : 'Remove'}><Still seed={sd * 5 + 3} mood={MOOD_NAMES[sd % 6]} />{i === 0 && <em>Cover</em>}</span>)}<button type="button" className="sg add" onClick={addPhotos}><Icon name="plus" size={16} /></button></div>
          </div>
          <div className="card lg"><div className="h"><b>About you</b></div>
            <div className="avrow"><span className="avbig" onClick={() => avf.current?.click()}>{p.avatar && p.avatar !== 'seed' ? <img src={p.avatar} alt="" /> : <Still seed={3} mood="golden" />}</span><div><b>{p.avatar ? 'Profile photo' : 'Add a profile photo'}</b><small>Square works best. It shows in search, on your card and on the home page.</small><button className="act2" onClick={() => avf.current?.click()}>{p.avatar ? 'Change' : 'Choose a photo'}</button><input ref={avf} type="file" accept="image/*" hidden onChange={pickAvatar} /></div></div>
            <div className="fields two"><Fld l="Name" v={p.n} set={set('n')} /><Fld l="Where (suburb, state)" v={p.city} set={set('city')} /></div>
            <div className="bf"><span>What you do</span><div className="chips2">{['Photographer', 'Videographer', 'Both'].map(d => <button key={d} type="button" className={p.disc === d ? 'on' : ''} onClick={() => set('disc')(d)}>{d}</button>)}</div></div>
            <Fld l="One line clients see first" v={p.h} set={set('h')} />
            <Fld l="Bio" v={p.bio} set={set('bio')} area />
            <div className="fields two"><Fld l="Phone" v={p.ph || ''} set={set('ph')} /><Fld l="Website" v={p.web || ''} set={set('web')} /></div>
            <div className="fields two"><Fld l="Instagram" v={p.ig} set={set('ig')} /><Fld l="From price, shown on your card" v={p.from} set={set('from')} /></div>
          </div>
          <div className="card lg"><div className="h"><b>Packages</b><small className="lumi-by">Lumi quotes from these · clients see "from" the lowest</small></div>
            <div className="pkrows">{pk.map((x, i) => <div key={i} className="pkrow"><input value={x[0]} placeholder="Full day" onChange={e => setPkAt(i, 0, e.target.value)} /><span>$<input type="number" value={x[1]} placeholder="3200" onChange={e => setPkAt(i, 1, Number(e.target.value) || 0)} /></span><input value={x[2]} placeholder="10 hours · 400+ photos" onChange={e => setPkAt(i, 2, e.target.value)} /><button className="ic2" aria-label="Remove" onClick={() => { setPk(a => a.filter((_, k) => k !== i)); setDirty(true) }}><Icon name="x" size={12} /></button></div>)}</div>
            {pk.length < 5 && <button className="lnk" onClick={() => { setPk(a => [...a, ['', 0, '']]); setDirty(true) }}>Add a package</button>}
            {!pk.length && <p className="note2">Three is plenty: a short one, your main one, and a big one. Prices stay private until you send a quote.</p>}
          </div>
          <div className="card lg"><div className="h"><b>What you shoot</b><small className="lumi-by">Shown on your card, used by the ask bar</small></div>
            <div className="chips2">{ALL.map(k => <button key={k} type="button" className={p.kinds.includes(k) ? 'on' : ''} onClick={() => { set('kinds')(p.kinds.includes(k) ? p.kinds.filter(x => x !== k) : [...p.kinds, k]) }}>{k}</button>)}</div>
          </div>
        </div>
        <div className="s5 side sticky">
          <SetupCard compact />
          <div className="card lg"><div className="h"><b>What clients can do</b></div>
            <div className="brows one">
              {[['enquiry', 'Instant enquiry', 'Message you without an account'], ['price', 'Show from-price', '"Full day from $' + p.from + '" on your card'], ['avail', 'Live availability', 'Open dates show before they ask'], ['book', 'Book and pay a deposit directly', 'Skip the quote for fixed packages'], ['badge', 'Founding creative badge', 'Permanent, on your card and profile']].map(([k, a, b]) => <label key={k} className="brow"><span>{a}<small>{b}</small></span><Sw on={tog[k]} set={() => set('tog')({ ...tog, [k]: tog[k] ? 0 : 1 })} /></label>)}
            </div>
          </div>
          {!p.bioRewritten && <div className="tlumi"><span className="lm" /><div>Your bio mentions weddings four times and real estate once, but real estate is 40% of your income. Want a version that says both?<div className="acts"><button className="y" onClick={() => { set('bio')('Documentary weddings and twilight real estate, from Noosaville across the Sunshine Coast. Eight years, four hundred weddings, a monthly run of listings, and one camera bag that is always too heavy.'); set('bioRewritten')(1); toast('Bio rewritten. Publish when happy.') }}>Rewrite it</button><button onClick={() => { F.patch('profile', { bioRewritten: 1 }); toast('Kept.') }}>Keep mine</button></div></div></div>}
        </div>
      </div>
    </section>
  )
}

/* View profile: your public card, as a client sees it. */
export function ViewProfile() {
  const F = useFlows(); const { s, toast } = F; const p = s.profile
  const link = 'https://lenstrybe.com/creatives/' + p.n.split(' ')[0].toLowerCase()
  const free = (() => { const out = []; let d = new Date(2026, 9, 3); while (out.length < 5) { const k = iso(d); const e = s.events.find(x => x.d === k); if (!e || e.k === 'p') out.push([d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }), e?.k === 'p']); d.setDate(d.getDate() + 7) } return out })()
  const revs = s.reviews.filter(r => r.n === 5).slice(0, 2)
  return (
    <section className="view">
      <Head h="View profile" p={'Exactly what a client sees on ' + link.replace('https://', '') + '. Nothing here is editable on purpose.'}><button className="btn g" onClick={() => { try { navigator.clipboard?.writeText(link)?.catch(() => {}) } catch {} toast('Link copied') }}><Icon name="globe" size={15} />Copy link</button><Link className="btn w" to="/app/profile"><Icon name="edit" size={15} />Edit profile</Link></Head>
      <div className="grid">
        <div className="card lg s12 pubp">
          <div className="hero"><Still seed={3} mood="golden" /><div className="in">{p.tog?.badge ? <span className="fb">Founding creative</span> : null}<h2>{p.n}</h2><p>{p.h} · {p.city.split(',')[0]} · {s.reviews.length ? (s.reviews.reduce((t, r) => t + r.n, 0) / s.reviews.length).toFixed(1) + ' from ' + (34 + s.reviews.length) + ' reviews' : 'New'}</p><div className="ctas">{p.tog?.enquiry ? <span className="btn w sm">Enquire</span> : null}{p.tog?.price ? <span className="btn g sm" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}>Full day from ${p.from}</span> : null}</div></div></div>
          <div className="pgrid2">
            <div>
              <b>Recent work</b>
              <div className="strip2">{(p.shots || [0, 1, 2, 3, 4, 5]).slice(0, 6).map((sd, i) => <span key={sd + '-' + i} className="sg"><Still seed={sd * 5 + 3} mood={MOOD_NAMES[sd % 6]} /></span>)}</div>
              <b style={{ marginTop: 18 }}>About</b>
              <p className="note2">{p.bio}</p>
            </div>
            <div>
              {p.tog?.avail ? <><b>Free next</b><div className="avail2">{free.map(([d, pen]) => <span key={d} className={pen ? 'p' : ''}>{d}{pen && <small>pencilled</small>}</span>)}</div></> : null}
              <b style={{ marginTop: 18 }}>Clients say</b>
              <div className="revs small">{revs.map(r => <div key={r.id} className="rev"><p>"{r.t.length > 90 ? r.t.slice(0, 88) + '…' : r.t}"</p><small style={{ color: 'var(--ink-3)' }}>{r.who.split(' ')[0]}</small></div>)}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* Subscription: your plan, billing and invoices from us. */
export function Subscription() {
  const F = useFlows(); const { s, toast } = F; const [annual, setAnnual] = useState(!!s.plan.annual)
  const cur = s.plan.name, pending = s.plan.pending
  const gb = Math.round(s.galleries.reduce((t, x) => t + (x.gb || 0), 0) * 10) / 10 + 4.8
  const move = p => F.confirm({ title: 'Move to ' + p.n + '?', body: ['Basic', 'Pro'].includes(p.n) && cur !== 'Basic' ? <>Downgrades apply at the end of the period, 1 Oct. You keep {cur} until then. {cur === 'Expert' && 'Your founding rate is lost if you move down.'}</> : <>{p.n} from 1 Oct at {annual ? p.a : p.m} a month{annual ? ', billed yearly' : ''}. {cur === 'Expert' ? 'Your founding rate carries over as a $49 credit each month.' : ''}</>, cta: 'Move to ' + p.n, onYes: () => { F.patch('plan', { pending: p.n, annual }); toast(p.n + ' from 1 Oct.' + (cur === 'Expert' && p.n === 'Elite' ? ' Founding credit applied.' : '')) } })
  const payment = () => F.open({ title: 'Payment method', sub: 'Visa ···· 6411 · expires 08/28. Cards are handled by Stripe; we never see the number.', cta: 'Open Stripe', body: <>To change the card, Stripe opens in a new tab with your account already found.</>, submit: () => { window.open('https://billing.stripe.com', '_blank', 'noopener'); return true } })
  const cancel = () => F.confirm({ title: 'Cancel ' + cur + '?', body: <>You keep access to 1 Oct and your data stays for 90 days. {cur === 'Expert' && <b>Your founding rate does not come back.</b>} Sorry to see you go.</>, cta: 'Cancel my plan', danger: true, onYes: () => { F.patch('plan', { pending: 'Basic', cancelled: true }); toast('Cancelled from 1 Oct. Email confirmation sent.') } })
  const keep = () => { F.patch('plan', { pending: null, cancelled: false }); toast('Staying on ' + cur + '.') }
  return (
    <section className="view">
      <Head h="Subscription" p="Your plan, billing and the invoices we send you. No commission, ever."><button className="btn g" onClick={payment}><Icon name="card" size={15} />Payment method</button></Head>
      <div className="grid">
        <Tiles t={[['Plan', cur, pending ? pending + ' from 1 Oct' : 'Founding · $49 a month for life', pending ? 'w' : ''], ['Next payment', '1 Oct', (pending === 'Elite' ? '$99.00' : pending === 'Basic' ? '$0.00' : '$49.00') + ' · Visa ···· 6411', 'n'], ['Bookings this month', String(s.events.filter(e => e.d.startsWith('2026-09') && e.k !== 'x').length + 6), 'unlimited on ' + cur, 'n'], ['Deliver', gb + ' of 50 GB', 'more on Elite', '']]} />
        <div className="card lg s8">
          <div className="h"><b>Plans</b><div className="tfilt" style={{ padding: 0 }}><button className={!annual ? 'on' : ''} onClick={() => setAnnual(false)}>Monthly</button><button className={annual ? 'on' : ''} onClick={() => setAnnual(true)}>Annual · 2 months free</button></div></div>
          <div className="plans2">{PLANS.map(p => <div key={p.n} className={'plan2' + (p.n === cur ? ' mine' : '')}><b>{p.n}</b><span className="pp">{annual ? p.a : p.m}{p.m !== 'Free' && <small>/mo</small>}</span><p>{p.d}</p>{p.n === cur ? <span className="st ok">Your plan</span> : p.n === pending ? <button className="btn g sm" onClick={keep}>From 1 Oct · undo</button> : <button className="btn g sm" onClick={() => move(p)}>{PLANS.findIndex(x => x.n === p.n) < PLANS.findIndex(x => x.n === cur) ? 'Move down' : 'Move up'}</button>}</div>)}</div>
          <p className="tempty" style={{ textAlign: 'left', padding: '12px 2px 0', fontSize: 12 }}>Founding creatives keep $49 a month on Expert for life. Moving to Elite keeps the founding discount as a credit.</p>
        </div>
        <div className="s4 side">
          <div className="card lg"><div className="h"><b>Invoices from us</b></div>
            <div className="tl">{[['1 Sep', 'LT-2026-09', '$49.00'], ['1 Aug', 'LT-2026-08', '$49.00'], ['1 Jul', 'LT-2026-07', '$49.00'], ['1 Jun', 'LT-2026-06', '$0.00 · founding year']].map(([d, n, v]) => <div key={n} className="e" onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['LensTrybe tax invoice ' + n + '\nTo: ' + s.settings.biz + '\nABN ' + s.settings.abn + '\n' + cur + ' plan · ' + v + ' incl. GST\n'], { type: 'text/plain' })); a.download = n + '.txt'; a.click(); toast(n + ' downloaded') }}><span className="t">{d}</span><div><b>{n}</b><small>Tax invoice · GST included</small></div><span className="amt2">{v}</span></div>)}</div>
          </div>
          <div className="card lg"><div className="h"><b>Cancel</b></div><p className="note2">Cancel anytime. You keep access to the end of the period, and your data stays for 90 days.</p>{s.plan.cancelled ? <button className="lnk" style={{ marginTop: 8 }} onClick={keep}>Cancelled from 1 Oct · keep {cur} instead</button> : <button className="lnk" style={{ marginTop: 8 }} onClick={cancel}>Cancel {cur}</button>}</div>
        </div>
      </div>
    </section>
  )
}

/* Referrals: invite a creative, both of you get a month. */
export function Referrals() {
  const F = useFlows(); const { s, toast } = F; const R = s.referrals
  const link = 'lenstrybe.com/join?ref=' + s.profile.n.split(' ')[0].toLowerCase()
  const copy = () => { try { navigator.clipboard?.writeText('https://' + link)?.catch(() => {}) } catch {} toast('Link copied: ' + link) }
  const joined = R.filter(r => r.st === 'ok')
  const remind = r => { F.upd('referrals', r.id, { s: 'Reminded ' + nice(TODAY), l: 'Reminded' }); toast('Reminder sent to ' + r.n + '.') }
  const share = how => F.open({ title: how === 'post' ? 'Post about it' : 'Share your link', cta: how === 'post' ? 'To the calendar' : 'Send', fields: [...(how === 'email' ? [{ k: 'to', l: 'To', type: 'email', required: true }] : how === 'sms' ? [{ k: 'to', l: 'Number', type: 'tel', required: true }] : []), { k: 'msg', l: how === 'post' ? 'Caption' : 'Message', type: 'textarea', rows: 4, value: how === 'post' ? 'If you shoot for a living and still send invoices by hand, this is what I use. A month free with my link: ' + link : 'Hey, this is what I run my whole business on now. A month free for you (and me) if you join with this: ' + link }], submit: v => { if (how === 'post') { F.add('posts', { d: '2026-09-27', ch: ['ig', 'li'], t: 'LensTrybe · referral', body: v.msg, st: 'draft', s: 19, m: 'cool', stats: '' }, 'post'); toast('Drafted on the content calendar.') } else { F.add('referrals', { n: v.to, s: 'Invited ' + nice(TODAY), st: 'grey', l: 'Not yet', g: 'linear-gradient(135deg,#283047,#9ac4c5)' }, 'ref'); toast('Sent to ' + v.to + '.') } } })
  return (
    <section className="view">
      <Head h="Referrals" p="Invite a creative. When they start a paid plan, you both get a month free."><button className="btn g" onClick={() => F.invite('creative')}><Icon name="plus" size={15} />Invite by email</button><button className="btn w" onClick={copy}><Icon name="gift" size={15} />Copy your link</button></Head>
      <div className="grid">
        <Tiles t={[['Invited', R.length, 'this year', 'n'], ['Joined', joined.length, joined.map(r => r.n.split(' ')[0]).join(', '), ''], ['Months earned', joined.length, '$' + joined.length * 49 + ' off your plan', ''], ['Pending', R.length - joined.length, 'not on a paid plan yet', R.length - joined.length ? 'w' : '']]} />
        <div className="card lg s8"><div className="h"><b>Your invites</b></div>
          <div className="need">{R.map(r => <div key={r.id} className="r"><span className="av" style={{ background: r.g }} /><div><b>{r.n}</b><small>{r.s}</small></div><div className="do"><span className={'st ' + r.st}>{r.l}</span>{r.st === 'grey' && <button onClick={() => remind(r)}>Remind</button>}</div></div>)}{!R.length && <div className="tempty">Nobody invited yet.</div>}</div>
        </div>
        <div className="s4 side">
          <div className="card lg"><div className="h"><b>Share</b></div><div className="lnkrow" style={{ margin: '0 0 10px' }}><Icon name="globe" size={14} /><span>{link}</span><button onClick={copy}>Copy</button></div><div className="ctas" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><button className="btn g sm" onClick={() => share('email')}>Email</button><button className="btn g sm" onClick={() => share('sms')}>Message</button><button className="btn g sm" onClick={() => share('post')}>Post</button></div></div>
          {R.some(r => r.n.startsWith('Beck')) && <div className="tlumi"><span className="lm" /><div>Beck has been on Basic for six weeks and takes wedding overflow from you. A note about the three free months on Pro would land well.<div className="acts"><button className="y" onClick={() => { const b = R.find(r => r.n.startsWith('Beck')); F.upd('referrals', b.id, { s: 'Nudged about Pro · ' + nice(TODAY) }); toast('Sent to Beck, in your words.') }}>Send it</button><button onClick={() => toast('Left it.')}>Leave it</button></div></div></div>}
        </div>
      </div>
    </section>
  )
}

/* Founding hub: your code, your locked rate and the hundred. */
export function Founding() {
  const F = useFlows(); const { s, toast } = F; const wall = !!s.settings.wall
  const code = 'FOUND-' + s.profile.n.split(' ')[0].toUpperCase() + '-23'
  return (
    <section className="view">
      <Head h="Founding hub" p="One of the first hundred. Expert free for twelve months, then $49 a month for life."><Link className="btn g" to="/legal/founding">Founding agreement</Link></Head>
      <div className="grid">
        <Tiles t={[['Your number', '#23', 'of 100', ''], ['Founding creatives', '71', '29 places left', 'n'], ['Your rate', '$49 / mo', 'locked for life, from 1 Jun 2027', ''], ['Free until', '1 Jun 2027', '8 months to go', 'n']]} />
        <div className="card lg s8"><div className="h"><b>What founding gets you</b></div>
          <div className="chk set">{[['Expert free for twelve months', 1], ['$49 a month for life after that, ever', 1], ['Founding badge on your card and profile', 1], ['A say in what gets built · Upcoming features', 1], ['First look at Elite features before they ship', 1], ['Your name on the founding wall', wall ? 1 : 0]].map(([t, v]) => <label key={t} className={v ? 'on' : ''}><input type="checkbox" checked={!!v} readOnly /><i><Icon name="check" size={11} /></i><span>{t}</span></label>)}</div>
          <p className="tempty" style={{ textAlign: 'left', padding: '12px 2px 0', fontSize: 12 }}>The wall is opt-in. <button className="lnk" onClick={() => { F.patch('settings', { wall: !wall }); toast(wall ? 'Taken off the founding wall.' : 'Added to the founding wall.') }}>{wall ? 'Take your name off' : 'Add your name'}</button></p>
        </div>
        <div className="s4 side">
          <div className="card lg"><div className="h"><b>Your code</b></div><div className="lnkrow" style={{ margin: 0 }}><Icon name="star" size={14} /><span>{code}</span><button onClick={() => { try { navigator.clipboard?.writeText(code)?.catch(() => {}) } catch {} toast('Copied') }}>Copy</button></div><p className="note2" style={{ marginTop: 10 }}>Redeemed 1 Jun 2026. Codes are one per creative and can't be passed on.</p></div>
          <div className="card lg"><div className="h"><b>Have a say</b></div><p className="note2">Founding creatives vote on what gets built next. Three things are up this month.</p><Link className="btn g sm" to="/upcoming" style={{ marginTop: 10 }}>Upcoming features <Icon name="arrow" size={13} /></Link></div>
        </div>
      </div>
    </section>
  )
}

/* Settings: account, notifications, calendar sync and integrations. */
export function Settings() {
  const F = useFlows(); const { s, toast } = F; const S = s.settings
  const auth = useAuth(); const nav = useNavigate(); const email = LIVE ? (auth.user?.email || '') : S.email
  const [acc, setAcc] = useState({ email: S.email, phone: S.phone, biz: S.biz, abn: S.abn }), [dirty, setDirty] = useState(false)
  const [delOpen, setDelOpen] = useState(false), [news, setNews] = useState(null)
  useEffect(() => { let on = true; newsletterStatus().then(d => on && setNews(!!d.subscribed)).catch(() => on && setNews(false)); return () => { on = false } }, [])
  const toggleNews = async () => { const next = !news; setNews(next); const r = await setNewsletter(next); if (r.error) { setNews(!next); toast(r.error) } else toast(next ? "You're on The Trybe Edit." : 'Unsubscribed. Emails about your own account still arrive.') }
  const changeEmailSheet = () => F.open({ title: 'Change email', sub: 'A link goes to both addresses. The change lands once both are clicked.', cta: 'Send the links', center: true, fields: [{ k: 'cur', l: 'Current email', type: 'email', required: true, placeholder: email }, { k: 'next', l: 'New email', type: 'email', required: true }], submit: async v => { const r = await changeEmail(v.cur, v.next, email); if (r.error) { toast(r.error); return false } toast('Links sent to ' + v.cur + ' and ' + v.next + '. Click both to finish.') } })
  const [dark, setDark] = useState(() => read('lt-dark', true)), [dock, setDock] = useState(() => read('lt-dock', true))
  const set = k => v => { setAcc(a => ({ ...a, [k]: v })); setDirty(true) }
  const save = () => { F.patch('settings', acc); setDirty(false); toast('Saved.') }
  const theme = () => { const d = !dark; setDark(d); try { localStorage.setItem('lt-dark', d ? '1' : '0') } catch {} dispatchEvent(new CustomEvent('lt-theme', { detail: { dark: d } })) }
  const dockT = () => { const d = !dock; setDock(d); try { localStorage.setItem('lt-dock', d ? '1' : '0') } catch {} dispatchEvent(new CustomEvent('lt-dock', { detail: { dock: d } })) }
  const DESC = { 'Google Calendar': 'Synced · ' + S.email, Xero: 'Synced nightly', Stripe: 'Card payments · payouts daily', Instagram: 'Connected', TikTok: 'Not connected', Dropbox: 'Not connected' }
  const connect = a => F.open({ title: 'Connect ' + a, sub: a + ' opens in a new tab to sign in. Come back here when it is done.', cta: 'Connect', body: <>{a === 'TikTok' ? 'Posts from the content calendar go to TikTok too.' : a === 'Dropbox' ? 'Galleries back up to a Dropbox folder as they upload.' : 'Two-way sync.'}</>, submit: () => { F.patch('settings', { ints: { ...S.ints, [a]: 1 } }); toast(a + ' connected.') } })
  const manage = a => F.open({ title: a, cta: 'Save', fields: [{ k: 'on', l: 'Connected', type: 'toggle', value: true, hint: 'Off disconnects it' }, ...(a === 'Google Calendar' ? [{ k: 'twoway', l: 'Two-way sync', type: 'toggle', value: true, hint: 'Busy time in Google blocks your LensTrybe calendar' }] : a === 'Xero' ? [{ k: 'nightly', l: 'Sync nightly', type: 'toggle', value: true }] : [])], submit: v => { if (!v.on) { F.patch('settings', { ints: { ...S.ints, [a]: 0 } }); toast(a + ' disconnected.') } else toast('Saved.') } })
  const password = () => F.confirm({ title: 'Change password', body: <>A reset link goes to <b>{email}</b>. It works for one hour, once.</>, cta: 'Send the link', onYes: async () => { const r = await sendPasswordReset(email); toast(r.error || 'Reset link sent to ' + email + '.') } })
  const twofa = () => F.open({ title: 'Two-factor', sub: 'On, with an authenticator app.', cta: 'Save', fields: [{ k: 'on', l: 'Two-factor on', type: 'toggle', value: S.twofa !== false }, { k: 'codes', l: 'Show backup codes', type: 'toggle', value: false }], submit: v => { F.patch('settings', { twofa: v.on }); toast(v.on ? 'Two-factor on.' : 'Two-factor off. We recommend keeping it on.') } })
  const exportAll = async () => { try { await downloadMyData(s); toast(LIVE ? 'Your download has started: a ZIP of everything in the account.' : 'Exported everything as JSON.') } catch (e) { toast(e.message) } }
  const del = () => setDelOpen(true)
  return (
    <section className="view">
      <Head h="Settings" p="Account, notifications, calendar sync and what's connected."><button className="btn g" onClick={F.resetAll}>Reset demo data</button><button className={'btn w' + (dirty ? '' : ' quiet')} onClick={save}>{dirty ? 'Save' : 'Saved'}</button></Head>
      <div className="grid">
        <div className="s6 side">
          <div className="card lg"><div className="h"><b>Account</b></div>
            <div className="fields two">{LIVE ? <Fld l="Email" v={email} set={() => {}} type="email" readOnly /> : <Fld l="Email" v={acc.email} set={set('email')} type="email" />}<Fld l="Phone" v={acc.phone} set={set('phone')} type="tel" /></div>
            <div className="fields two"><Fld l="Business name" v={acc.biz} set={set('biz')} /><Fld l="ABN" v={acc.abn} set={set('abn')} /></div>
            <div className="ctas" style={{ display: 'flex', gap: 6, marginTop: 12 }}><button className="btn g sm" onClick={changeEmailSheet}>Change email</button><button className="btn g sm" onClick={password}>Change password</button><button className="btn g sm" onClick={twofa}>Two-factor · {S.twofa === false ? 'off' : 'on'}</button></div>
          </div>
          <div className="card lg"><div className="h"><b>Notifications</b></div>
            <div className="brows one">{[['enq', 'New enquiry', 'Push and email, straight away'], ['pay', 'Payment received', 'Push'], ['lumi', 'Lumi needs a yes', 'Push, batched at 7 am and 5 pm'], ['week', 'Weekly summary', 'Email, Monday 7 am'], ['mkt', 'The Trybe Edit', 'The newsletter and occasional LensTrybe news']].map(([k, a, b]) => <label key={k} className="brow"><span>{a}<small>{b}</small></span>{k === 'mkt' ? <Sw on={!!news} set={toggleNews} /> : <Sw on={S.notif[k]} set={() => F.patch('settings', { notif: { ...S.notif, [k]: S.notif[k] ? 0 : 1 } })} />}</label>)}</div>
          </div>
        </div>
        <div className="s6 side">
          <div className="card lg"><div className="h"><b>Connected</b></div>
            <div className="need">{Object.entries(S.ints).map(([a, on]) => <div key={a} className="r" style={{ cursor: 'default' }}><span className="av" style={{ background: on ? 'linear-gradient(135deg,#1c452f,#7fd0aa)' : 'var(--hov)' }} /><div><b>{a}</b><small>{on ? DESC[a] || 'Connected' : 'Not connected'}</small></div><div className="do">{on ? <button onClick={() => manage(a)}>Manage</button> : <button className="y" onClick={() => connect(a)}>Connect</button>}</div></div>)}</div>
          </div>
          <div className="card lg"><div className="h"><b>Workspace</b></div>
            <div className="brows one">
              <label className="brow"><span>Dark by default<small>Also from the sun and moon by your name</small></span><Sw on={dark} set={theme} /></label>
              <label className="brow"><span>Lumi docked<small>Open on wide screens, away on laptops</small></span><Sw on={dock} set={dockT} /></label>
              <label className="brow"><span>Draft the deposit invoice when a quote is accepted<small>It waits in Invoicing; nothing is sent until you say</small></span><Sw on={S.autoDep !== false} set={() => F.patch('settings', { autoDep: S.autoDep === false })} /></label>
            </div>
          </div>
          <div className="card lg"><div className="h"><b>Your data</b></div><p className="note2">Export everything: clients, threads, invoices, galleries. Or delete the account; data is gone in 30 days.</p><div className="ctas" style={{ display: 'flex', gap: 6, marginTop: 10 }}><button className="btn g sm" onClick={exportAll}>Download my data</button><button className="lnk" onClick={del}>Delete account</button></div></div>
          {delOpen && <DeleteAccount kind="creative" demoStore={s} onClose={() => setDelOpen(false)} onDeleted={async () => { setDelOpen(false); if (LIVE) { await signOut(); nav('/login', { replace: true, state: { note: 'Your account is scheduled for deletion. Log in any time before the date to reactivate it.' } }) } else toast('Demo: the account would now be scheduled for deletion.') }} />}
        </div>
      </div>
    </section>
  )
}

/* Help and support: answers first, a person when you need one. */
export function Support() {
  const F = useFlows(); const { s, toast } = F; const [q, setQ] = useState(''), [open, setOpen] = useState(0), [about, setAbout] = useState('Billing'), [msg, setMsg] = useState('')
  const FAQ = [['How do I get paid?', 'Clients pay by card or transfer on the invoice. Card payouts land daily via Stripe; transfers go straight to you.'], ['Can Lumi send things without asking?', 'Only what you switch on in Availability and Lumi. Everything else waits for your yes, and everything is undoable for 24 hours.'], ['What happens if a client cancels?', 'Your contract terms apply. The deposit stays yours by default; Lumi handles the message and the calendar.'], ['How do I move to Elite?', 'Subscription, then Move up. Your founding discount carries over as a credit.'], ['Where do gallery files live?', 'Australian servers, encrypted. 50 GB on Expert, 200 GB on Elite, and galleries expire when you say.']]
  const send = () => { if (!msg.trim()) return toast('Say what happened first.'); const id = 'LT-' + Date.now().toString(36).toUpperCase().slice(-5); F.add('tickets', { about, msg, st: 'Open' }, 'any'); setMsg(''); toast('Sent · ' + id + '. A person replies to ' + s.settings.email + ' within a business day.') }
  return (
    <section className="view">
      <Head h="Help and support" p="Answers first. A person within a business day when you need one."><a className="btn g" href="mailto:connect@lenstrybe.com">connect@lenstrybe.com</a></Head>
      <div className="grid">
        <div className="s7 side">
          <div className="card lg">
            <label className="tsearch" style={{ margin: 0, height: 44 }}><Icon name="search" size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Ask anything about LensTrybe" aria-label="Search help" /></label>
            <div className="faq2">{FAQ.filter(([a, b]) => !q || (a + b).toLowerCase().includes(q.toLowerCase())).map(([a, b], i) => <div key={a} className={'fq2' + (open === i ? ' on' : '')}><button type="button" onClick={() => setOpen(open === i ? -1 : i)}><span>{a}</span><i>+</i></button><p>{b}</p></div>)}{q && !FAQ.some(([a, b]) => (a + b).toLowerCase().includes(q.toLowerCase())) && <p className="tempty">Nothing on that yet. <button className="lnk" onClick={() => { setMsg(q); document.querySelector('.sup-msg')?.focus() }}>Ask a person</button></p>}</div>
          </div>
          {(s.tickets || []).length > 0 && <div className="card lg"><div className="h"><b>Your messages</b></div><div className="tl">{s.tickets.map(t => <div key={t.id} className="e"><span className="t" style={{ width: 'auto' }}><Icon name="chat" size={14} /></span><div><b>{t.about}</b><small>{t.msg.slice(0, 80)}</small></div><span className="st viewed">{t.st}</span></div>)}</div></div>}
        </div>
        <div className="s5 side">
          <div className="card lg"><div className="h"><b>Message us</b></div>
            <label className="bf"><span>What's it about</span><select value={about} onChange={e => setAbout(e.target.value)}>{['Billing', 'A booking or thread', 'Deliver', 'Lumi', "Something's broken", 'An idea'].map(x => <option key={x}>{x}</option>)}</select></label>
            <label className="bf" style={{ marginTop: 10 }}><span>Message</span><textarea className="ta sup-msg" rows={4} value={msg} onChange={e => setMsg(e.target.value)} placeholder="Say what happened. Screenshots help." /></label>
            <button className="btn w sm" style={{ marginTop: 12 }} onClick={send}>Send <Icon name="arrow" size={13} /></button>
          </div>
          <div className="tlumi"><span className="lm" /><div>Most questions I can answer from your own account. Ask me first; if I can't, I'll send it to a person with the context attached.<div className="acts"><button className="y" onClick={() => F.nav('/app/lumi')}>Ask Lumi</button></div></div></div>
        </div>
      </div>
    </section>
  )
}
