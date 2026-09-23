import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import Logo from '../../components/Logo'
import { useStore } from '../../lib/store'
import { paperOf, fam, loadFont, onColour } from '../../lib/brand'
import '../../styles/public.css'

// The public brand page: one link a creative sends to a second shooter, a venue or a printer so they pull
// the right logo, colours and fonts. Reads the saved kit; nothing here is editable.
export default function BrandPage() {
  const { slug } = useParams(); const { s } = useStore(); const b = s.brand; const P = paperOf(b.paper)
  useEffect(() => { loadFont(b.head); loadFont(b.body); document.title = b.name + ' · brand' }, [b])
  const dl = (src, name) => { const a = document.createElement('a'); a.href = src; a.download = name; a.click() }
  if (!b.brandPublic) return <div className="bp off"><div><Logo height={18} /><h1>Not shared yet</h1><p>{slug} hasn't switched their brand page on. If that's you, it's under Brand kit → Share.</p><Link to="/" className="bp-btn">LensTrybe</Link></div></div>
  const sw = [['Accent', b.accent, onColour(b.accent)], ['Paper', P[2], P[3]], ['Ink', P[3], P[2]]]
  return (
    <div className="bp" style={{ background: P[2], color: P[3], fontFamily: fam(b.body), '--acc': b.accent }}>
      <header className="bp-h"><div className="bp-logo">{b.logo ? <img src={b.paper === 'dark' && b.logoLight ? b.logoLight : b.logo} alt="" /> : b.mark ? <img src={b.mark} alt="" className="sq" /> : <span className="mark" style={{ background: b.accent }} />}<div><b style={{ fontFamily: fam(b.head) }}>{b.name}</b><small>{b.tag}</small></div></div><span className="bp-eb">Brand kit</span></header>
      <main className="bp-m">
        <section><h2>Logo</h2><div className="bp-logos">
          {b.logo && <div className="bp-lv light"><img src={b.logo} alt="" /><button onClick={() => dl(b.logo, 'logo.png')}>Download</button></div>}
          {(b.logoLight || b.logo) && <div className="bp-lv dark"><img src={b.logoLight || b.logo} alt="" style={b.logoLight ? undefined : { opacity: .5 }} /><button onClick={() => dl(b.logoLight || b.logo, 'logo-white.png')}>Download</button></div>}
          {b.mark && <div className="bp-lv light sq"><img src={b.mark} alt="" /><button onClick={() => dl(b.mark, 'mark.png')}>Download</button></div>}
          {!b.logo && !b.mark && <p className="bp-note">No logo file yet. The name is set in {b.head}.</p>}
        </div></section>
        <section><h2>Colour</h2><div className="bp-sw">{sw.map(([n, c, on]) => <div key={n} className="bp-s" style={{ background: c, color: on }}><b>{n}</b><code>{c.toUpperCase()}</code></div>)}</div></section>
        <section><h2>Type</h2><p className="bp-spec" style={{ fontFamily: fam(b.head) }}>{b.head}</p><p className="bp-body">{b.body} for body text. Both are on Google Fonts. Headings sit tight, body at 13 to 15px, corners at {b.radius ?? 12}px.</p></section>
        {b.voice?.tone?.length > 0 && <section><h2>Voice</h2><p className="bp-tones">{b.voice.tone.map(t => <span key={t}>{t}</span>)}</p><p className="bp-body">Opens with “{b.voice.greet || 'Hi'}”, signs off “{b.voice.signoff || s.profile.n}”.{b.voice.banned ? ' Never: ' + b.voice.banned + '.' : ''}</p></section>}
        <section><h2>On documents</h2><p className="bp-body">{b.foot}<br />{b.terms}<br />{b.lic}</p></section>
      </main>
      <footer className="bp-f"><span>{b.name}</span><Link to="/"><Logo height={12} /></Link></footer>
    </div>
  )
}
