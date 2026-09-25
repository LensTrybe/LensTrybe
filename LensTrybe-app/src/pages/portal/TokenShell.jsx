import { Link } from 'react-router-dom'
import Aurora from '../../components/Aurora'
import Logo from '../../components/Logo'
import { useSpecular } from '../../lib/useSpecular'
import { imageUrl } from '../../backend/imageUrl'
import '../../styles/public.css'
import '../../styles/pages.css'
import './portal.css'
import './token.css'

// The frame every token page shares: the sticky pill header with the creative, the light aurora, one
// card. Sign, meeting, gallery and review all sit inside it so a client moving between the emails
// in their inbox sees one place, not four.
const av = url => { try { return imageUrl(url, 120) || url } catch { return url } }

export function TokenShell({ creative, sub, wide, children }) {
  useSpecular([])
  const name = creative?.business_name || 'Your creative'
  return (
    <div className="pub pub-light portal tok">
      <Aurora />
      <header className="phdr lg"><Link to="/" className="plogo"><Logo height={18} /></Link><span className="who"><span className="pav" style={creative?.avatar_url ? { backgroundImage: 'url(' + av(creative.avatar_url) + ')', backgroundSize: 'cover', borderRadius: '50%' } : { background: 'linear-gradient(135deg,#283047,#9ac4c5)' }} /><div><b>{name}</b><small>{sub || creative?.tagline || [creative?.skill_types?.join(' and '), creative?.city].filter(Boolean).join(' · ') || 'On LensTrybe'}</small></div></span></header>
      <main className={'pwrap' + (wide ? ' wide' : '')}>{children}</main>
    </div>
  )
}

export function TokenState({ kicker, title, children }) {
  return <div className="pjob lg tstate"><p className="eb p">{kicker}</p><h1>{title}</h1>{children}</div>
}

export function Loading({ text = 'One moment.' }) {
  return <TokenShell><p className="fine" style={{ textAlign: 'center', paddingTop: 120 }}>{text}</p></TokenShell>
}

export function NotOurs({ what = 'link' }) {
  return <TokenShell><TokenState kicker="Link not recognised" title={'That ' + what + ' is not one of ours.'}><p className="sub">It may have been trimmed by your email app, or it has been replaced. Open the newest email from your creative and tap the button in it, or ask them to send it again.</p><Link className="btn p" to="/" style={{ marginTop: 14, alignSelf: 'flex-start' }}>LensTrybe home</Link></TokenState></TokenShell>
}
