import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Still from '../../components/Still'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { LIVE } from '../../lib/mode'
import { useAuth } from '../../backend/AuthContext'
import { getFeatures } from '../../backend/tierFeatures'
import * as live from '../../lib/live'

// Deliver: every gallery behind one branded link. Drop files, it uploads, the client gets a link
// that opens on a phone. Sneak peeks go out from the thread, the full gallery when you say so.
// Galleries live in the store; an upload here is a real file pick that bumps the counts.
const FL = [['all', 'All'], ['live', 'Delivering'], ['done', 'Delivered'], ['wait', 'Waiting on the shoot']]
const CAP = 50

export default function Deliver() {
  const F = useFlows(); const { s, toast, upd } = F; const GALS = s.galleries; const auth = useAuth()
  const [f, setF] = useState('all'), [sel, setSel] = useState(GALS[0]?.id), [busy, setBusy] = useState(''); const file = useRef()
  const list = useMemo(() => GALS.filter(g => f === 'all' || g.k === f), [GALS, f])
  const g = GALS.find(x => x.id === sel) || list[0]
  const capLive = LIVE ? (getFeatures(auth.profile?.subscription_tier || 'basic').deliverGb || 0) : CAP
  const used = LIVE ? Math.round(GALS.reduce((t, x) => t + (x.gb || 0), 0) * 100) / 100 : Math.round(GALS.reduce((t, x) => t + (x.gb || 0), 0) * 10) / 10 + 4.8
  // live actions: the real rows, then a refresh
  const run = async (key, fn, msg) => { if (busy) return; setBusy(key); try { await fn(); await F.refreshLive(); if (msg) toast(msg) } catch (e) { toast(e.message) } finally { setBusy('') } }
  const livePick = target => { const gg = GALS.find(x => x.id === target) || g; if (!gg) return; file.current.onchange = e => { const fs = [...e.target.files]; e.target.value = ''; if (!fs.length) return; run('up', async () => { const n = await live.addDeliveryFiles(auth.user.id, gg.live, fs, (i, t) => setBusy('up:' + i + '/' + t)); if (n < fs.length) throw new Error((fs.length - n) + ' file(s) did not upload. Try them again.') }, fs.length + (fs.length === 1 ? ' file' : ' files') + ' added to ' + gg.d + '.') }; file.current.click() }
  const pick = target => { if (LIVE) return livePick(target); file.current.onchange = e => { const fs = [...e.target.files]; if (!fs.length) return; const gb = Math.round(fs.reduce((t, x) => t + x.size, 0) / 1e9 * 10) / 10; const films = fs.filter(x => /video/.test(x.type)).length; const id = target || g?.id; if (!id) return; upd('galleries', id, x => ({ k: 'live', files: x.files + fs.length - films, films: x.films + films, gb: Math.round((x.gb + gb) * 10) / 10, p: x.k === 'wait' ? 8 : Math.max(8, Math.min(99, x.p)), log: [['Just now', 'Upload started · ' + fs.length + (fs.length === 1 ? ' file' : ' files')], ...x.log.filter(l => l[0] !== 'Ready')] })); toast(fs.length + (fs.length === 1 ? ' file' : ' files') + ' uploading. Keeps going if you close the tab.'); setTimeout(() => upd('galleries', id, x => ({ p: 100, k: 'done', log: [['Just now', 'Upload finished · ' + x.files + ' photos' + (x.films ? ', ' + x.films + (x.films > 1 ? ' films' : ' film') : '')], ...x.log] })), 4000); e.target.value = '' }; file.current.click() }
  const sendLink = () => LIVE ? run('send', () => live.sendDeliveryLive(g.live.id), 'Link emailed to ' + g.n + '.') : sendLinkDemo()
  const sendLinkDemo = () => { F.say(g.t, 'doc', 'Gallery · ' + g.n, { d: g.link + ' · ' + g.files + ' photos', st: 'ok', stt: 'Sent' }); upd('galleries', g.id, x => ({ log: [['Just now', 'Gallery link sent to the thread'], ...x.log] })); F.upd('threads', g.t, t => ({ stage: Math.max(t.stage, 6), next: 'Delivered' })); toast('Gallery link sent to ' + g.n + '. It is in the thread.') }
  const extend = () => LIVE ? run('ext', () => live.extendDelivery(g.live.id, 30), 'Link open for 30 more days.') : extendDemo()
  const extendDemo = () => { upd('galleries', g.id, x => ({ exp: x.exp + 30, log: [['Just now', 'Extended 30 days'], ...x.log] })); toast('Extended 30 days.') }
  const settings = () => F.open({ title: 'Gallery settings', sub: 'Defaults for every new gallery. Change one gallery from its card.', cta: 'Save', fields: [{ k: 'exp', l: 'Links live for', type: 'select', value: String(s.settings.galExp || 90), options: [['30', '30 days'], ['90', '90 days'], ['365', 'A year'], ['0', 'Forever']] }, { k: 'dl', l: 'Downloads', type: 'select', value: s.settings.galDl || 'full', options: [['full', 'Full resolution'], ['web', 'Web size'], ['none', 'View only']] }, { k: 'wm', l: 'Watermark previews', type: 'toggle', value: !!s.brand.wm }, { k: 'pin', l: 'PIN by default', type: 'toggle', value: !!s.settings.galPin }], submit: v => { F.patch('settings', { galExp: +v.exp, galDl: v.dl, galPin: v.pin }); F.patch('brand', { wm: v.wm ? 1 : 0 }); toast('Saved. New galleries use these.') } })
  const editLive = () => F.open({ title: g.d, sub: 'For ' + g.n, cta: 'Save', fields: [{ k: 'title', l: 'Gallery title', required: true, value: g.d }, { k: 'message', l: 'Message', type: 'textarea', rows: 3, value: g.msg }, { k: 'pw', l: 'Password protect it', type: 'toggle', value: !!g.pw }, { k: 'pwv', l: 'Password', value: g.pw || '', when: v => v.pw }], alt: { l: 'Delete gallery', on: () => { F.confirm({ title: 'Delete ' + g.d + '?', body: 'The files are removed from storage and the client link stops working. This cannot be undone.', cta: 'Delete', danger: true, onYes: () => { run('del', () => live.deleteDelivery(g.live), 'Gallery deleted.'); setSel(null) } }); return false } }, submit: async v => { try { await live.updateDelivery(g.live.id, { title: v.title, message: v.message, password: v.pw ? v.pwv : '' }); await F.refreshLive(); toast('Saved.') } catch (e) { toast(e.message); return false } } })
  const editGal = () => LIVE ? editLive() : F.open({ title: g.n, cta: 'Save', fields: [{ k: 'n', l: 'Name', required: true, value: g.n }, { k: 'd', l: 'What', value: g.d }, { k: 'exp', l: 'Days left', type: 'number', half: true, value: g.exp, min: 0 }, { k: 'link', l: 'Link', half: true, value: g.link }], alt: { l: 'Delete gallery', on: () => { F.confirm({ title: 'Delete ' + g.n + '?', body: 'The link stops working for the client and the files go in 30 days. This cannot be undone.', cta: 'Delete', danger: true, onYes: () => { F.del('galleries', g.id); setSel(null); toast('Gallery deleted. Files are kept for 30 days.') } }); return false } }, submit: v => { upd('galleries', g.id, v); toast('Saved.') } })
  return (
    <section className="view">
      <input ref={file} type="file" multiple  accept={LIVE ? undefined : 'image/*,video/*,.cr3,.arw,.nef,.dng'} style={{ display: 'none' }} aria-hidden="true" />
      <div className="vh">
        <div><h1>Deliver</h1><p>Branded galleries behind one link. Drop files anywhere on this screen to start one.</p></div>
        <div className="acts">{!LIVE && <button className="btn g" onClick={settings}><Icon name="settings" size={15} />Settings</button>}<button className="btn w" onClick={() => F.newGallery({ then: id => { setSel(id); setF('all') } })}><Icon name="plus" size={15} />New gallery</button></div>
      </div>
      <div className="grid">
        <div className="s12"><div className="kp">
          <div className="k lg stor"><small>Storage</small><b>{used} <span>of {LIVE ? capLive : CAP} GB</span></b><div className="bar"><i style={{ width: Math.min(100, (LIVE ? (capLive ? used / capLive : 1) : used / CAP) * 100) + '%' }} /></div><em className="n">{s.plan.name} plan · <Link to="/app/subscription" className="lnk">{LIVE && !capLive ? 'Deliver starts on Pro' : 'more on Elite'}</Link></em></div>
          {(LIVE ? [['Galleries', String(GALS.length), GALS.filter(x => x.exp < 7 && x.k !== 'done').length ? GALS.filter(x => x.exp < 7 && x.k !== 'done').length + ' expiring this week' : 'all links open', ''], ['Opened', String(GALS.filter(x => x.opened).length), 'galleries the client has opened', ''], ['Downloads', String(GALS.reduce((t, x) => t + (x.dl || 0), 0)), 'across every gallery', '']] : [['Delivering', String(GALS.filter(x => x.k === 'live').length), GALS.filter(x => x.k === 'live').map(x => x.n + ', ' + x.p + '%').join(' · ') || 'nothing uploading', ''], ['Opened this week', '17', 'across 3 galleries', 'n'], ['Downloads', String(GALS.reduce((t, x) => t + x.dl, 0)), 'this month', 'n']]).map(([l, v, e, w]) => <div key={l} className="k lg"><small>{l}</small><b>{v}</b><em className={w}>{e}</em></div>)}
        </div></div>

        <div className="card lg s8">
          <div className="h"><div className="tfilt" style={{ padding: 0 }}>{FL.map(([k, l]) => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{l}<i>{GALS.filter(x => k === 'all' || x.k === k).length}</i></button>)}</div></div>
          <button type="button" className="drop" onClick={() => g ? pick(g.id) : F.newGallery({ then: id => { setSel(id); pick(id) } })} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (LIVE) { const fs = [...e.dataTransfer.files]; if (!fs.length) return; if (!g) return F.newGallery(); return run('up', async () => { const n = await live.addDeliveryFiles(auth.user.id, g.live, fs, (i, t) => setBusy('up:' + i + '/' + t)); if (n < fs.length) throw new Error((fs.length - n) + ' file(s) did not upload.') }, fs.length + ' files added to ' + g.d + '.') } const n = e.dataTransfer.files.length; if (!n || !g) return; upd('galleries', g.id, x => ({ k: 'live', files: x.files + n, p: Math.max(8, Math.min(99, x.p)), log: [['Just now', 'Upload started · ' + n + ' files'], ...x.log.filter(l => l[0] !== 'Ready')] })); toast(n + ' files uploading to ' + g.n + '.'); setTimeout(() => upd('galleries', g.id, x => ({ p: 100, k: 'done' })), 4000) }}><Icon name="deliver" size={18} /><span>{busy.startsWith('up') ? 'Uploading' + (busy.includes(':') ? ' ' + busy.split(':')[1].replace('/', ' of ') : '') + '. Keep this tab open.' : 'Drop photos or films here' + (g ? ' for ' + (LIVE ? g.d : g.n) : ' to start a gallery')}</span><small>{LIVE ? 'JPG, PNG, MP4, MOV, ZIP · stays private, the client opens it with their link' : 'RAW, JPG, MP4, MOV · uploads keep going if you close the tab'}</small></button>
          <div className="gals">
            {list.map(x => (
              <button key={x.id} type="button" className={'gal lg' + (g?.id === x.id ? ' on' : '') + (x.k === 'wait' ? ' wait' : '')} onClick={() => setSel(x.id)}>
                {x.cover ? <img className="cv" src={x.cover} alt="" /> : <Still seed={x.s} mood={x.m} />}
                {!LIVE && x.k !== 'wait' && <div className="ring"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="4" /><circle cx="22" cy="22" r="18" fill="none" stroke="var(--neon)" strokeWidth="4" strokeLinecap="round" strokeDasharray="113" strokeDashoffset={113 - 113 * x.p / 100} transform="rotate(-90 22 22)" /></svg><b>{x.p === 100 ? <Icon name="check" size={12} /> : x.p + '%'}</b></div>}
                <div className="in"><b>{x.n}</b><small>{x.d}</small><small className="x">{LIVE ? (x.k === 'wait' ? 'No files yet' : `${x.files} ${x.files === 1 ? 'file' : 'files'}${x.films ? ' · ' + x.films + (x.films > 1 ? ' films' : ' film') : ''} · ${x.dl ? 'downloaded' : x.opened ? 'opened' : 'not opened yet'} · ${x.exp} days left`) : x.k === 'live' ? `Uploading · ${Math.round(x.files * x.p / 100)} of ${x.files}` : x.k === 'done' ? `${x.files} photos${x.films ? ' · ' + x.films + (x.films > 1 ? ' films' : ' film') : ''} · opened ${x.opened}×` : 'Link reserved'}</small></div>
              </button>
            ))}
            {!list.length && <div className="tempty" style={{ gridColumn: '1/-1' }}>Nothing here. <button className="lnk" onClick={() => F.newGallery({ then: id => setSel(id) })}>New gallery</button></div>}
          </div>
        </div>

        {g && <div className="s4 side">
          <div className="card lg gsel">
            <div className="cover">{g.cover ? <img src={g.cover} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : <Still seed={g.s + 40} mood={g.m} />}<div className="in"><b>{g.n}</b><small>{g.d}</small></div><button className="ic2 edit" aria-label="Edit gallery" title="Edit" onClick={editGal}><Icon name="edit" size={14} /></button></div>
            {g.pw && <div className="lnkrow pw"><Icon name="shield" size={14} /><span>Password · <code>{g.pw}</code></span><button onClick={() => { try { navigator.clipboard?.writeText(g.pw)?.catch(() => {}) } catch {} toast('Password copied') }}>Copy</button></div>}
            <div className="lnkrow"><Icon name="globe" size={14} /><span>{g.link}</span><button onClick={() => { try { navigator.clipboard?.writeText(g.url || 'https://' + g.link)?.catch(() => {}) } catch {} toast('Link copied') }}>Copy</button>{LIVE && g.url && <a href={g.url} target="_blank" rel="noreferrer">Open</a>}</div>
            {g.k !== 'wait' && <div className="gstats"><div><b>{LIVE ? (g.opened ? 'Yes' : 'No') : g.opened}</b><small>opened</small></div><div><b>{g.dl}</b><small>downloads</small></div><div><b>{g.exp}</b><small>days left</small></div><div><b>{g.gb}</b><small>GB</small></div></div>}
            <div className="ctas">
              {g.k === 'wait' ? <button className="btn w sm" onClick={() => pick(g.id)}><Icon name="deliver" size={13} />Upload</button>
                : <><button className="btn w sm" onClick={sendLink} disabled={!!busy}>{busy === 'send' ? 'Sending' : 'Send link'} <Icon name="arrow" size={13} /></button><button className="btn g sm" onClick={() => pick(g.id)} disabled={!!busy}>{busy.startsWith('up') ? 'Uploading' : 'Add files'}</button><button className="btn g sm" onClick={extend} disabled={!!busy}>Extend 30 days</button>{!LIVE && g.k === 'done' && <button className="btn g sm" onClick={() => F.askReview(g.t)}>Ask for a review</button>}</>}
              {(!LIVE || s.threads.some(t => t.id === g.t)) && <Link className="btn g sm" to={'/app/thread/' + g.t}>Thread</Link>}
            </div>
          </div>
          <div className="card lg"><div className="h"><b>Activity</b></div>
            <div className="glog">{g.log.map(([w, x], i) => <div key={w + x + i}><small>{w}</small><span>{x}</span></div>)}</div>
          </div>
          {!LIVE && g.id === 'harper' && g.k === 'live' && <div className="tlumi"><span className="lm" /><div>The sneak peek has been opened fourteen times and shared twice. The full gallery finishes uploading in about forty minutes. Want me to send the link the moment it lands?<div className="acts"><button className="y" onClick={() => { upd('galleries', g.id, x => ({ auto: 1, log: [['Just now', 'Lumi will send the link when the upload finishes'], ...x.log] })); toast('Will do. Link goes out when the upload finishes.') }}>Yes, send it</button><button onClick={() => toast("I'll wait for you.")}>I'll do it</button></div></div></div>}
          {!LIVE && g.id === 'coastline' && g.exp < 30 && <div className="tlumi"><span className="lm" /><div>This gallery expires in {g.exp} days. Coastline downloaded web size only. Extend it, or remind them to grab full resolution?<div className="acts"><button className="y" onClick={extend}>Extend</button><button onClick={() => F.reply(g.t, 'Hi Dean, the August gallery closes in ' + g.exp + ' days. Grab the full resolution files from ' + g.link + ' before then, and shout if you want it kept open.', { title: 'Remind Coastline', cta: 'Send' })}>Remind them</button></div></div></div>}
        </div>}
      </div>
    </section>
  )
}
