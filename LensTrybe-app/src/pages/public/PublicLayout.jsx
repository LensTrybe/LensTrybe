import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import Logo from '../../components/Logo'
import Aurora from '../../components/Aurora'
import Icon from '../../components/Icon'
import { useSpecular } from '../../lib/useSpecular'
import { useReveal } from '../../lib/useReveal'
import { outside, regionCookie, regionName, waitlistTo } from '../../lib/region'
import { useAuth } from '../../backend/AuthContext'
import { LIVE } from '../../lib/mode'
import '../../styles/public.css'
import '../../styles/pages.css'

// The public shell. The header is dark over the home hero and turns light past it,
// and is light everywhere else. Everything sits on the aurora field.
export default function PublicLayout() {
  const { pathname } = useLocation()
  const { user, isClient } = useAuth()
  const signedIn = LIVE && !!user
  const home = pathname === '/'
  // outside the launch area: read anything, but every action points at the waitlist for the area
  const away = outside(), wl = pathname === '/waitlist'
  const darkTop = home || ['/how-it-works', '/pricing', '/creatives', '/login', '/join', '/join/creative', '/join/client', '/forgot-password', '/reset-password', '/check-email', '/booking-unavailable', '/auth/confirm', '/waitlist', '/support', '/upcoming', '/founding', '/unsubscribe'].includes(pathname) || pathname.startsWith('/unsubscribe/') || pathname.startsWith('/edit') || pathname.startsWith('/blog') || pathname.startsWith('/jobs')
  // Blog and The Trybe Edit sit side by side in the header, so only one lights up at a time
  const editOn = pathname === '/blog/edit' || pathname.startsWith('/edit')
  const blogOn = pathname.startsWith('/blog') && !editOn
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
  if (LIVE && /^\/creatives\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pathname)) return <Outlet />
  return (
    <div className={'pub' + (darkTop ? '' : ' pub-light')}>
      {!darkTop && <Aurora />}
      <header className={'top' + (lite ? ' lite' : '')}>
        <Link className="logo" to="/" aria-label="LensTrybe home"><span className="lw"><Logo onDark height={26} /></span><span className="li"><Logo height={26} /></span><span className="tagline">Connect. Capture. Create.</span></Link>
        <div className="r lg" ref={nav} onPointerOver={e => glide(e.target.closest("a"))} onPointerLeave={() => glide(null)}>
          <i className="glide" aria-hidden="true" />
          <NavLink to="/how-it-works" className="hide-m hide-t">How it works</NavLink>
          {!away && <NavLink to="/creatives" className="hide-m hide-s">Find a creative</NavLink>}
          {!away && <NavLink to="/jobs" className="hide-m hide-s">Post a job</NavLink>}
          <NavLink to="/pricing" className="hide-m hide-s">Pricing</NavLink>
          <Link to="/blog" className="hide-m hide-t" aria-current={blogOn ? 'page' : undefined}>Blog</Link>
          <Link to="/blog/edit" className="hide-m" aria-current={editOn ? 'page' : undefined}>The Trybe Edit</Link>
          {away && <NavLink to="/founding" className="hide-m hide-s">Founding</NavLink>}
          {signedIn ? <Link to={isClient ? '/portal' : '/app'} className="cta">{isClient ? 'My portal' : 'My workspace'}</Link> : <>
          <NavLink to="/login">Log in</NavLink>
          {away ? <Link to={waitlistTo()} className="cta">Join the waitlist</Link> : <Link to="/join" className="cta">Join as a creative</Link>}</>}
          <button className="mb" aria-label="Menu" onClick={() => setMenu(m => !m)}><Icon name="menu" /></button>
        </div>
      </header>
      {menu && <nav className="mnav lg" aria-label="Menu"><NavLink to="/how-it-works">How it works</NavLink>{away ? <NavLink to={waitlistTo()}>Join the waitlist</NavLink> : <><NavLink to="/creatives">Find a creative</NavLink><NavLink to="/jobs">Post a job</NavLink></>}<NavLink to="/pricing">Pricing</NavLink><NavLink to="/founding">Founding programme</NavLink><NavLink to="/blog">Blog</NavLink><NavLink to="/blog/edit">The Trybe Edit</NavLink><NavLink to="/upcoming">Upcoming features</NavLink><NavLink to="/support">Support</NavLink><a href="/app/today?preview">Workspace preview</a></nav>}
      {away && !wl && <div className="areabar"><span>LensTrybe hasn't opened {regionCookie() === 'INTL' ? 'outside Australia' : 'in ' + regionName(regionCookie())} yet. Have a look around; joining, posting a job and the ask open with your area.</span><Link to={waitlistTo()}>Join the waitlist</Link></div>}
      <Outlet />
      <footer className="foot">
        <div className="wrap"><div className="g">
          <span className="logo"><Logo height={20} /></span>
          <nav><Link to="/support">Support</Link><Link to="/legal/terms">Terms</Link><Link to="/legal/privacy">Privacy</Link><Link to="/legal/cookies">Cookies</Link><Link to="/legal/refunds">Refunds</Link><Link to="/blog">Blog</Link><Link to="/blog/edit">The Trybe Edit</Link><Link to="/upcoming">Upcoming features</Link><a href="/app/today?preview">Workspace preview</a><a href="/portal/harper-leo?preview">Client portal preview</a></nav>
          <span>© 2026 LensTrybe · connect@lenstrybe.com · Photographers and videographers at launch, six more disciplines after.</span>
        </div></div>
      </footer>
    </div>
  )
}
