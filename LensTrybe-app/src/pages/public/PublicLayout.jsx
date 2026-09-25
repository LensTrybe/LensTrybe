import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import Logo from '../../components/Logo'
import Aurora from '../../components/Aurora'
import Icon from '../../components/Icon'
import { useSpecular } from '../../lib/useSpecular'
import { useReveal } from '../../lib/useReveal'
import { outside, regionCookie, regionName, waitlistTo } from '../../lib/region'
import '../../styles/public.css'
import '../../styles/pages.css'

// The public shell. The header is dark over the home hero and turns light past it,
// and is light everywhere else. Everything sits on the aurora field.
export default function PublicLayout() {
  const { pathname } = useLocation()
  const home = pathname === '/'
  // outside the launch area: read anything, but every action points at the waitlist for the area
  const away = outside(), wl = pathname === '/waitlist'
  const darkTop = home || ['/how-it-works', '/pricing', '/creatives', '/login', '/join', '/join/creative', '/join/client', '/forgot-password', '/reset-password', '/check-email', '/waitlist', '/support', '/upcoming'].includes(pathname) || pathname.startsWith('/edit') || pathname.startsWith('/jobs')
  const [lite, setLite] = useState(!darkTop)
  const [menu, setMenu] = useState(false)
  useEffect(() => {
    if (!darkTop) { setLite(true); return }
    const on = () => { const h = document.querySelector('.darkhero'); setLite(!h || scrollY > h.offsetHeight - 140) }
    on(); addEventListener('scroll', on, { passive: true }); return () => removeEventListener('scroll', on)
  }, [darkTop])
  useEffect(() => { window.scrollTo(0, 0); setMenu(false) }, [pathname])
  useSpecular([pathname]); useReveal([pathname])
  // a glass capsule glides under whichever link the pointer is over, and rests under the current page
  const nav = useRef(null)
  const glide = (el) => {
    const r = nav.current; if (!r) return
    const t = el && el.matches('a:not(.cta)') ? el : r.querySelector('a[aria-current="page"]:not(.cta)')
    if (!t) { r.style.setProperty('--gl-o', 0); return }
    const a = r.getBoundingClientRect(), b = t.getBoundingClientRect()
    r.style.setProperty('--gl-x', (b.left - a.left) + 'px'); r.style.setProperty('--gl-w', b.width + 'px'); r.style.setProperty('--gl-o', 1)
  }
  useEffect(() => { const t = setTimeout(() => glide(null), 60); addEventListener('resize', () => glide(null)); return () => clearTimeout(t) }, [pathname, lite])
  return (
    <div className={'pub' + (darkTop ? '' : ' pub-light')}>
      {!darkTop && <Aurora />}
      <header className={'top' + (lite ? ' lite' : '')}>
        <Link className="logo" to="/" aria-label="LensTrybe home"><span className="lw"><Logo white /></span><span className="li"><Logo /></span></Link>
        <div className="r lg" ref={nav} onPointerOver={e => glide(e.target.closest("a"))} onPointerLeave={() => glide(null)}>
          <i className="glide" aria-hidden="true" />
          <NavLink to="/how-it-works" className="hide-m">How it works</NavLink>
          {!away && <NavLink to="/creatives" className="hide-m">Find a creative</NavLink>}
          {!away && <NavLink to="/jobs" className="hide-m">Post a job</NavLink>}
          <NavLink to="/pricing" className="hide-m">Pricing</NavLink>
          {away && <NavLink to="/founding" className="hide-m">Founding</NavLink>}
          <NavLink to="/login">Log in</NavLink>
          {away ? <Link to={waitlistTo()} className="cta">Join the waitlist</Link> : <Link to="/join" className="cta">Join as a creative</Link>}
          <button className="mb" aria-label="Menu" onClick={() => setMenu(m => !m)}><Icon name="menu" /></button>
        </div>
      </header>
      {menu && <nav className="mnav lg" aria-label="Menu"><NavLink to="/how-it-works">How it works</NavLink>{away ? <NavLink to={waitlistTo()}>Join the waitlist</NavLink> : <><NavLink to="/creatives">Find a creative</NavLink><NavLink to="/jobs">Post a job</NavLink></>}<NavLink to="/pricing">Pricing</NavLink><NavLink to="/founding">Founding programme</NavLink><NavLink to="/edit">The Trybe Edit</NavLink><NavLink to="/upcoming">Upcoming features</NavLink><NavLink to="/support">Support</NavLink><NavLink to="/app">Workspace preview</NavLink></nav>}
      {away && !wl && <div className="areabar"><span>LensTrybe hasn't opened {regionCookie() === 'INTL' ? 'outside Australia' : 'in ' + regionName(regionCookie())} yet. Have a look around; joining, posting a job and the ask open with your area.</span><Link to={waitlistTo()}>Join the waitlist</Link></div>}
      <Outlet />
      <footer className="foot">
        <div className="wrap"><div className="g">
          <span className="logo"><Logo height={20} /></span>
          <nav><Link to="/support">Support</Link><Link to="/legal/terms">Terms</Link><Link to="/legal/privacy">Privacy</Link><Link to="/legal/refunds">Refunds</Link><Link to="/edit">The Trybe Edit</Link><Link to="/upcoming">Upcoming features</Link><Link to="/app">Workspace preview</Link><Link to="/portal/harper-leo">Client portal preview</Link></nav>
          <span>© 2026 LensTrybe · connect@lenstrybe.com · Photographers and videographers at launch, six more disciplines after.</span>
        </div></div>
      </footer>
    </div>
  )
}
