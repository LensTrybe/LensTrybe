import { useState } from 'react'
import { Link } from 'react-router-dom'
import Still from '../../components/Still'
import SiteRender from '../../components/SiteRender'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'

// Website: your site, built from your profile and brand kit. Five pages on Expert, your own domain on Elite.
// Pages on the left, the site on the right, publish when it looks right.
const LIMIT = { Basic: 0, Pro: 0, Expert: 5, Elite: 99 }
const SITE_PLANS = ['Expert', 'Elite']

export default function Website() {
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
