import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Still from '../../components/Still'
import SiteRender from '../../components/SiteRender'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { LIVE } from '../../lib/mode'
import { useAuth } from '../../backend/AuthContext'
import * as live from '../../lib/live'

// Website: your site, built from your profile and brand kit. Five pages on Expert, your own domain on Elite.
// Pages on the left, the site on the right, publish when it looks right.
const LIMIT = { Basic: 0, Pro: 0, Expert: 5, Elite: 99 }
const SITE_PLANS = ['Expert', 'Elite']

export default function Website() { return LIVE ? <WebsiteLive /> : <WebsiteDemo /> }

function WebsiteDemo() {
  const F = useFlows(); const { s, toast } = F; const pages = s.pages, live = s.site.live
  const PLAN = { name: s.plan.name, pages: LIMIT[s.plan.name] ?? 5, domain: s.plan.name === 'Elite', site: SITE_PLANS.includes(s.plan.name) }
  const profileUrl = '/creatives/mara'
  const [sel, setSel] = useState('home'), [dirty, setDirty] = useState(!!s.site.dirty)
  const pg = pages.find(p => p.id === sel) || pages[0]
  const upd = (k, v) => { F.upd('pages', pg.id, { [k]: v }); setDirty(true) }
  const on = pages.filter(p => p.on).length
  const publish = () => { F.patch('site', { live: true, dirty: false, published: Date.now() }); setDirty(false); toast('Published. Live in about a minute.') }
  const addPage = () => { if (on >= PLAN.pages) return F.confirm({ title: PLAN.pages + ' pages is the ' + PLAN.name + ' limit', body: 'Elite has no page limit and your own domain.', cta: 'See Elite', onYes: () => F.nav('/app/subscription') }); F.newPage(); setDirty(true) }
  const removePage = p => F.confirm({ title: 'Remove ' + p.n + '?', body: 'It comes off the site on the next publish.', cta: 'Remove', danger: true, onYes: () => { F.del('pages', p.id); if (sel === p.id) setSel('home'); setDirty(true) } })
  const domain = () => F.open({ title: 'Connect your domain', sub: 'Point a CNAME at sites.lenstrybe.com and it is live in an hour.', cta: 'Connect', fields: [{ k: 'd', l: 'Domain', required: true, placeholder: 'maraokafor.com', value: s.site.custom || '' }], submit: v => { F.patch('site', { custom: v.d }); toast(v.d + ' connecting. CNAME → sites.lenstrybe.com.') } })
  const view = () => { window.open(PLAN.site ? profileUrl : profileUrl, '_blank', 'noopener') }
  return (
    <section className="view">
      <div className="vh">
        <div><h1>Website</h1><p>{PLAN.site ? 'This is your public profile. Built from your pages and brand kit, ' + (PLAN.pages > 20 ? 'unlimited pages' : PLAN.pages + ' pages') + ' on ' + PLAN.name + (PLAN.domain ? ', on your own domain' : '') + '.' : 'On ' + PLAN.name + ' your public profile is the standard LensTrybe page. Expert turns it into a full website.'}</p></div>
        <div className="acts">
          {PLAN.site ? <>
            <span className={'syncb' + (live ? '' : ' off')}><i />{live ? 'Live · ' + (s.site.custom || s.site.domain) : 'Unpublished'}</span>
            <button className="btn g" onClick={view}>View site <Icon name="arrow" size={14} /></button>
            <button className={'btn w' + (dirty ? '' : ' quiet')} onClick={publish}>{dirty ? 'Publish changes' : 'Published'}</button>
          </> : <>
            <button className="btn g" onClick={view}>View profile <Icon name="arrow" size={14} /></button>
            <Link className="btn w" to="/app/subscription">Get the website on Expert</Link>
          </>}
        </div>
      </div>
      {!PLAN.site ? <StandardProfile s={s} F={F} /> : <div className="grid">
        <div className="s5 side">
          <div className="card lg">
            <div className="h"><b>Pages</b><small className="lumi-by">{on} of {PLAN.pages}</small></div>
            <div className="pglist">
              {pages.map(p => <div key={p.id} className={'pgrow' + (sel === p.id ? ' on' : '') + (p.on ? '' : ' off')}>
                <button type="button" className="pgn" onClick={() => setSel(p.id)}><Icon name={p.id === 'home' ? 'globe' : p.id === 'work' ? 'image' : p.id === 'about' ? 'user' : p.id === 'pricing' ? 'dollar' : 'chat'} size={15} /><span>{p.n}</span><small>/{p.id === 'home' ? '' : p.id}</small></button>
                <span className={'sw2' + (p.on ? ' on' : '')} role="switch" aria-checked={!!p.on} onClick={() => { F.upd('pages', p.id, { on: p.on ? 0 : 1 }); setDirty(true) }}><i /></span>
              </div>)}
            </div>
            <button className="lnk" style={{ marginTop: 10 }} onClick={addPage}>Add a page</button>{pg && pg.id !== 'home' && <button className="lnk" style={{ marginTop: 10, marginLeft: 14, opacity: .6 }} onClick={() => removePage(pg)}>Remove {pg.n}</button>}
          </div>
          {pg && <div className="card lg">
            <div className="h"><b>{pg.n}</b><small className="lumi-by">Edits show on the right</small></div>
            <label className="bf"><span>Headline</span><input value={pg.h} onChange={e => upd('h', e.target.value)} /></label>
            <label className="bf"><span>Under it</span><textarea className="ta" rows={2} value={pg.p} onChange={e => upd('p', e.target.value)} /></label>
            <div className="h" style={{ margin: '14px 0 6px' }}><b style={{ fontSize: 12.5 }}>Sections</b></div>
            <div className="brows one">{pg.secs.map(([s, v], i) => <label key={s} className="brow"><span>{s}</span><span className={'sw2' + (v ? ' on' : '')} role="switch" aria-checked={!!v} onClick={() => upd('secs', pg.secs.map((x, j) => j === i ? [x[0], x[1] ? 0 : 1] : x))}><i /></span></label>)}</div>
          </div>}
          <div className="card lg">
            <div className="h"><b>Domain</b></div>
            <div className="kv"><span>Now</span><b>{s.site.domain}</b></div>
            <div className="kv"><span>Your own</span><b>{PLAN.domain ? (s.site.custom || 'Not connected') : 'Elite plan'}</b></div>
            <div className="ctas" style={{ display: 'flex', gap: 6, marginTop: 12 }}>{PLAN.domain ? <button className="btn g sm" onClick={domain}>{s.site.custom ? 'Change domain' : 'Connect a domain'}</button> : <Link className="btn g sm" to="/app/subscription">Move to Elite for your own domain</Link>}</div>
          </div>
        </div>

        <div className="s7 side sticky">
          <div className="card lg sitep">
            <div className="chrome"><span /><span /><span /><i>{s.site.custom || s.site.domain}{pg && pg.id !== 'home' ? '/' + pg.id : ''}</i></div>
            <SiteRender s={s} page={sel} onPage={setSel} compact onEnquire={m => toast('On the live site this starts a thread: ' + (m || 'blank ask'))} />
          </div>
          {!s.site.heroSwap && <div className="tlumi"><span className="lm" /><div>Your site had 218 visits last week, 41 through the ask bar. "Three things clients say" pulls your newest reviews on its own. Want me to swap the hero photo for the Harper sneak peek when it's delivered?<div className="acts"><button className="y" onClick={() => { F.patch('site', { heroSwap: 'harper' }); toast('Will do, once the gallery is delivered.') }}>Yes</button><button onClick={() => { F.patch('site', { heroSwap: '' }); toast('Keeping the current one.') }}>Keep this one</button></div></div></div>}
        </div>
      </div>}
    </section>
  )
}

// Basic and Pro: the standard public profile, with a look at what Expert turns it into.
function StandardProfile({ s, F }) {
  const c = s.profile
  return (
    <div className="grid">
      <div className="s5 side">
        <div className="card lg"><div className="h"><b>Your public profile</b><small className="lumi-by">Standard on {s.plan.name}</small></div>
          <p className="note2">Clients find you in the directory and see this page: cover photo, your work, packages, reviews and the enquiry form. It updates from your profile and brand kit on its own.</p>
          <div className="brows one" style={{ marginTop: 8 }}>{[['Cover, name, tagline', 1], ['Portfolio grid', 1], ['Packages and prices', 1], ['Reviews', 1], ['Enquiry form and calendar', 1], ['Your own pages', 0], ['Brand kit fonts and colours', 0], ['Ask bar in one sentence', 0], ['Your own domain', 0]].map(([l, on]) => <label key={l} className="brow"><span>{l}</span><span className={'st ' + (on ? 'ok' : 'grey')}>{on ? 'Included' : 'Expert'}</span></label>)}</div>
          <div className="acts" style={{ marginTop: 14 }}><Link className="btn w" to="/app/subscription">Move to Expert</Link><Link className="btn g" to="/app/profile">Edit profile</Link></div>
        </div>
        <div className="tlumi"><span className="lm" /><div>On Expert this page becomes a five-page site in your brand kit, with an ask bar that starts a thread from one sentence. Creatives on the website get about 40% more enquiries from the same profile views.</div></div>
      </div>
      <div className="s7 side sticky">
        <div className="card lg sitep">
          <div className="chrome"><span /><span /><span /><i>lenstrybe.com/creatives/mara</i></div>
          <div className="stdprof">
            <div className="cover"><Still seed={3} mood="golden" /><div className="in"><div className="avx" /><div><b>{c.n}</b><small>{c.h} · {c.city}</small></div></div></div>
            <div className="tabs3">{['Work', 'Packages', 'Reviews', 'About'].map((t, i) => <span key={t} className={i === 0 ? 'on' : ''}>{t}</span>)}</div>
            <div className="fol">{[5, 9, 13, 17, 21, 23].map(i => <span key={i}><Still seed={i} mood={['dusk', 'golden', 'rose'][i % 3]} /></span>)}</div>
          </div>
        </div>
        <p className="note2" style={{ marginTop: 10 }}>The standard profile, exactly as clients see it. <Link className="lnk" to="/creatives/mara" target="_blank">Open it</Link>.</p>
      </div>
    </div>
  )
}

// ── Live: pages in site_pages, published by the button. Drafts are kept with the workspace so an
// unpublished edit survives a reload. Pro gets Home and Contact, Expert and Elite all five.
const PIC = { home: 'globe', gallery: 'image', about: 'user', services: 'dollar', contact: 'chat' }
const pub = pages => JSON.stringify(pages.map(p => [p.id, p.on ? 1 : 0, p.h || '', p.p || '', p.img || '', p.secs]))
function WebsiteLive() {
  const F = useFlows(); const { s, toast } = F; const { profile: P } = useAuth()
  const plan = s.plan.name, allowed = live.sitePagesFor(plan)
  const [rows, setRows] = useState(null), [c, setC] = useState(null), [sel, setSel] = useState('home'), [busy, setBusy] = useState(false), [upBusy, setUpBusy] = useState(false), [addr, setAddr] = useState(P?.custom_domain || '')
  const file = useRef()
  const load = async () => { const [r, cr] = await Promise.all([live.loadSitePages(P.id), live.loadCreative(P.id)]); setRows(r); setC(cr); return r }
  useEffect(() => { if (!P?.id) return; load().then(r => { const draft = s.pages.length && s.pages.every(p => 'saved' in p) ? s.pages : null; F.set('pages', draft || live.shapeSitePages(r, P)) }).catch(() => { setRows([]); toast('Could not load your website. Reload to try again.') }) }, [P?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setAddr(P?.custom_domain || '') }, [P?.custom_domain])
  const pages = s.pages.filter(p => allowed.includes(p.id)), pg = pages.find(p => p.id === sel) || pages[0]
  const published = rows ? live.shapeSitePages(rows, P || {}).filter(p => allowed.includes(p.id)) : []
  const dirty = rows && (pub(pages) !== pub(published) || !rows.length)
  const upd = (k, v) => F.upd('pages', pg.id, { [k]: v })
  const slug = addr || P?.id, siteUrl = '/site/' + slug
  const publish = async () => { if (busy) return; setBusy(true); try { await live.publishSitePages(P.id, pages, rows, allowed); const r = await load(); F.set('pages', live.shapeSitePages(r, P)); toast('Published. Your site is up to date.') } catch (e) { toast(e.message) } finally { setBusy(false) } }
  const discard = () => F.confirm({ title: 'Undo your changes?', body: 'The pages go back to what is published now.', cta: 'Undo changes', danger: true, onYes: () => F.set('pages', live.shapeSitePages(rows, P)) })
  const pickImg = async e => { const fl = e.target.files?.[0]; e.target.value = ''; if (!fl) return; if (!/^image\//.test(fl.type)) return toast('Pick a photo.'); if (fl.size > 20e6) return toast('That photo is over 20 MB.'); setUpBusy(true); try { const url = await live.uploadSiteImage(P.id, fl); upd('img', url); toast('Photo added. Publish to put it live.') } catch (x) { toast(x.message) } finally { setUpBusy(false) } }
  const changeAddr = () => F.open({ title: 'Your website address', sub: 'Letters, numbers and dashes. Old links to the previous address stop working.', cta: 'Save address', working: 'Saving', fields: [{ k: 'a', l: 'Address', required: true, value: addr || '', placeholder: 'your-name', hint: 'lenstrybe.com/site/your-name' }], submit: async v => { try { const a = await live.setSiteAddress(P.id, v.a); setAddr(a); toast('Your site is now at lenstrybe.com/site/' + a) } catch (e) { toast(e.message); return false } } })
  const copy = () => { const u = window.location.origin + siteUrl; try { navigator.clipboard?.writeText(u)?.catch(() => {}) } catch {} toast('Copied: ' + u) }
  if (!allowed.length) return (
    <section className="view">
      <div className="vh"><div><h1>Website</h1><p>On {plan} your public profile is the standard LensTrybe page. Pro adds a two page website, Expert a five page one.</p></div>
        <div className="acts"><a className="btn g" href={'/creatives/' + P?.id} target="_blank" rel="noopener noreferrer">View profile <Icon name="arrow" size={14} /></a><Link className="btn w" to="/app/subscription">See plans</Link></div></div>
      <div className="grid"><div className="card lg s7"><div className="h"><b>Your public profile</b></div><p className="note2">Clients find you in the directory and see your profile: cover photo, work, packages, reviews and the enquiry form. It updates from your profile on its own.</p><div className="acts" style={{ marginTop: 12 }}><Link className="btn g" to="/app/profile">Edit profile</Link></div></div></div>
    </section>)
  return (
    <section className="view">
      <div className="vh">
        <div><h1>Website</h1><p>{allowed.length > 2 ? 'Five pages' : 'Home and Contact'} on {plan}, built from your profile, photos, packages and reviews. Edit on the left, publish when it looks right.</p></div>
        <div className="acts">
          <span className={'syncb' + (rows && rows.length ? '' : ' off')}><i />{rows && rows.length ? 'Live · lenstrybe.com/site/' + slug : 'Not published yet'}</span>
          <a className="btn g" href={siteUrl} target="_blank" rel="noopener noreferrer">View site <Icon name="arrow" size={14} /></a>
          <button className={'btn w' + (dirty ? '' : ' quiet')} onClick={publish} disabled={busy || !rows}>{busy ? <><span className="spin" />Publishing</> : dirty ? 'Publish changes' : 'Published'}</button>
        </div>
      </div>
      <div className="grid">
        <div className="s5 side">
          <div className="card lg">
            <div className="h"><b>Pages</b><small className="lumi-by">{pages.filter(p => p.on).length} of {allowed.length} on</small></div>
            <div className="pglist">
              {pages.map(p => <div key={p.id} className={'pgrow' + (pg?.id === p.id ? ' on' : '') + (p.on ? '' : ' off')}>
                <button type="button" className="pgn" onClick={() => setSel(p.id)}><Icon name={PIC[p.id] || 'globe'} size={15} /><span>{p.n}</span><small>{p.id === 'home' ? 'first page' : ''}</small></button>
                {p.id !== 'home' && <span className={'sw2' + (p.on ? ' on' : '')} role="switch" aria-checked={!!p.on} title={p.on ? 'Showing' : 'Hidden'} onClick={() => F.upd('pages', p.id, { on: p.on ? 0 : 1 })}><i /></span>}
              </div>)}
            </div>
            {dirty && rows?.length > 0 && <button className="lnk" style={{ marginTop: 10, opacity: .7 }} onClick={discard}>Undo unpublished changes</button>}
            {allowed.length < 5 && <p className="note2" style={{ marginTop: 10 }}>Work, About and Pricing pages come with Expert. <Link className="lnk" to="/app/subscription">See plans</Link></p>}
          </div>
          {pg && <div className="card lg">
            <div className="h"><b>{pg.n}</b><small className="lumi-by">Changes show on the right</small></div>
            <label className="bf"><span>Headline</span><input value={pg.h} maxLength={200} onChange={e => upd('h', e.target.value)} /></label>
            <label className="bf"><span>{pg.id === 'about' ? 'Your story' : 'Under it'}</span><textarea className="ta" rows={pg.id === 'about' ? 6 : 3} maxLength={4000} value={pg.p} onChange={e => upd('p', e.target.value)} /></label>
            {pg.id === 'about' && <p className="note2" style={{ marginTop: 4 }}>The About section also shows the bio from your profile.</p>}
            <div className="h" style={{ margin: '14px 0 6px' }}><b style={{ fontSize: 12.5 }}>{pg.id === 'about' ? 'Portrait' : 'Big photo at the top'}</b></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {pg.img && <img src={pg.img} alt="" style={{ width: 64, height: 44, objectFit: 'cover', borderRadius: 8 }} />}
              <input ref={file} type="file" accept="image/*" hidden onChange={pickImg} />
              <button className="btn g sm" onClick={() => file.current?.click()} disabled={upBusy}>{upBusy ? <><span className="spin" />Uploading</> : pg.img ? 'Change photo' : 'Choose a photo'}</button>
              {pg.img && <button className="lnk" onClick={() => upd('img', '')}>Use a portfolio photo instead</button>}
            </div>
            {!pg.img && <p className="note2" style={{ marginTop: 6 }}>Without one, a photo from your portfolio is used.</p>}
            <div className="h" style={{ margin: '14px 0 6px' }}><b style={{ fontSize: 12.5 }}>Sections</b></div>
            <div className="brows one">{pg.secs.filter(([n]) => n !== 'Hero').map(([n, v]) => <label key={n} className="brow"><span>{n}</span><span className={'sw2' + (v ? ' on' : '')} role="switch" aria-checked={!!v} onClick={() => upd('secs', pg.secs.map(x => x[0] === n ? [x[0], x[1] ? 0 : 1] : x))}><i /></span></label>)}</div>
            <p className="note2" style={{ marginTop: 8 }}>Photos come from your <Link className="lnk" to="/app/profile">profile portfolio</Link>, packages from your profile packages, reviews from <Link className="lnk" to="/app/reviews">Reviews</Link>.</p>
          </div>}
          <div className="card lg">
            <div className="h"><b>Address</b></div>
            <div className="kv"><span>Your site</span><b>lenstrybe.com/site/{slug.length > 24 ? slug.slice(0, 8) + '…' : slug}</b></div>
            <div className="ctas" style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}><button className="btn g sm" onClick={changeAddr}>{addr ? 'Change address' : 'Choose an address'}</button><button className="btn g sm" onClick={copy}>Copy link</button></div>
            {/elite/i.test(plan) ? <p className="note2" style={{ marginTop: 10 }}>Want your own domain name, like yourname.com? <Link className="lnk" to="/app/support">Ask us</Link> and we will connect it.</p> : <p className="note2" style={{ marginTop: 10 }}>Your own domain name comes with Elite.</p>}
          </div>
        </div>
        <div className="s7 side sticky">
          <div className="card lg sitep">
            <div className="chrome"><span /><span /><span /><i>lenstrybe.com/site/{slug}{pg && pg.id !== 'home' ? ' · ' + pg.n : ''}</i></div>
            {c ? <SiteRender s={{ brand: live.siteBrand(P || {}), pages }} page={pg?.id} onPage={setSel} compact live={{ c }} /> : <div className="tempty" style={{ padding: 40 }}>Loading your site.</div>}
          </div>
        </div>
      </div>
    </section>
  )
}
