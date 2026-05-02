import { useState, useRef, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import Button from '../ui/Button'

const PAGE_BG =
  'linear-gradient(135deg, #060610 0%, #0a0a1a 30%, #060d06 70%, #0a060d 100%)'

const GLASS_NAV = {
  backdropFilter: 'blur(40px) saturate(180%)',
  WebkitBackdropFilter: 'blur(40px) saturate(180%)',
  background: 'rgba(255,255,255,0.03)',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  boxShadow: '0 1px 0 rgba(255,255,255,0.04)',
}

const GLASS_CARD = {
  backdropFilter: 'blur(40px) saturate(200%) brightness(1.1)',
  WebkitBackdropFilter: 'blur(40px) saturate(200%) brightness(1.1)',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderTop: '1px solid rgba(255,255,255,0.2)',
  borderLeft: '1px solid rgba(255,255,255,0.16)',
  borderRadius: '20px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
}

const GLASS_MODAL = {
  backdropFilter: 'blur(60px) saturate(180%)',
  WebkitBackdropFilter: 'blur(60px) saturate(180%)',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 100%)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderTop: '1px solid rgba(255,255,255,0.25)',
  borderRadius: '24px',
  boxShadow: '0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
}

const GLASS_GHOST_BTN = {
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))',
  border: '1px solid rgba(255,255,255,0.1)',
  borderTop: '1px solid rgba(255,255,255,0.16)',
}

const DIVIDER_LINE = 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)'

function PublicBgOrbs() {
  const orb = (style) => (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        borderRadius: '50%',
        filter: 'blur(100px)',
        pointerEvents: 'none',
        zIndex: 0,
        ...style,
      }}
    />
  )
  return (
    <>
      {orb({ top: '-8%', left: '-10%', width: 'min(520px, 90vw)', height: 'min(520px, 90vw)', background: '#1DB954', opacity: 0.28 })}
      {orb({ top: '-12%', right: '-8%', width: 'min(480px, 85vw)', height: 'min(480px, 85vw)', background: '#FF2D78', opacity: 0.22 })}
      {orb({ bottom: '-10%', right: '-6%', width: 'min(500px, 88vw)', height: 'min(500px, 88vw)', background: '#1DB954', opacity: 0.18 })}
      {orb({ bottom: '-8%', left: '-8%', width: 'min(460px, 82vw)', height: 'min(460px, 82vw)', background: '#a855f7', opacity: 0.2 })}
    </>
  )
}

export default function PublicLayout() {
  const { user, profile, clientAccount, isCreative, loading } = useAuth()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  const displayName = profile?.business_name ?? (clientAccount ? `${clientAccount.first_name ?? ''} ${clientAccount.last_name ?? ''}`.trim() : null) ?? user?.email ?? ''
  const shortName = displayName.length > 20 ? displayName.slice(0, 20) + '…' : displayName

  const navLinkStyle = {
    background: 'none',
    border: 'none',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 600,
    letterSpacing: '-0.3px',
    cursor: 'pointer',
    opacity: 0.95,
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-ui)',
    padding: 0,
    lineHeight: 1.6,
  }

  const styles = {
    nav: {
      position: 'sticky', top: 0, zIndex: 100,
      ...GLASS_NAV,
      padding: '0 40px', height: '64px',
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      gap: '16px',
    },
    logo: {
      fontFamily: 'var(--font-display)', fontSize: '20px',
      fontWeight: 600,
      letterSpacing: '-0.3px',
      color: '#ffffff', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: '8px',
      lineHeight: 1.6,
    },
    tagline: {
      fontSize: '11px',
      fontWeight: 400,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.35)',
      fontFamily: 'var(--font-ui)',
      lineHeight: 1.6,
    },
    actions: { display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-end' },
    mobileMenuButton: {
      width: '44px', height: '44px', borderRadius: '10px',
      ...GLASS_GHOST_BTN,
      color: '#ffffff', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: '20px', cursor: 'pointer', flexShrink: 0,
    },
    mobileMenu: {
      position: 'fixed', inset: 0,
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      background: 'rgba(0,0,0,0.55)',
      zIndex: 300, display: 'flex', justifyContent: 'flex-end',
      flexDirection: 'column', padding: '16px', paddingTop: '80px',
    },
    mobileMenuPanel: {
      ...GLASS_MODAL,
      padding: '16px', display: 'flex',
      flexDirection: 'column', gap: '10px',
      maxHeight: 'calc(100vh - 96px)', overflowY: 'auto',
    },
    mobileMenuLink: {
      width: '100%', minHeight: '52px', borderRadius: '10px',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderTop: '1px solid rgba(255,255,255,0.12)',
      color: '#ffffff', fontSize: '16px', fontFamily: 'var(--font-ui)',
      fontWeight: 600,
      textAlign: 'left', padding: '12px 14px', cursor: 'pointer',
      lineHeight: 1.6,
      transition: 'all 0.2s',
    },
    mobileProfile: {
      display: 'flex', alignItems: 'center', gap: '10px',
      ...GLASS_CARD,
      borderRadius: '16px',
      padding: '10px 12px', marginBottom: '4px',
    },
    userBtn: {
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '6px 12px', borderRadius: 'var(--radius-lg)',
      ...GLASS_GHOST_BTN,
      color: '#ffffff', fontSize: '13px', fontFamily: 'var(--font-ui)',
      fontWeight: 600,
      cursor: 'pointer', transition: 'all var(--transition-fast)',
      lineHeight: 1.6,
    },
    avatar: {
      width: '28px', height: '28px', borderRadius: 'var(--radius-full)',
      background: 'rgba(29,185,84,0.15)',
      border: '1px solid rgba(29,185,84,0.3)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '11px', color: '#1DB954', fontWeight: 700, letterSpacing: '-0.5px', flexShrink: 0,
    },
    chevron: { fontSize: '10px', color: 'rgba(255,255,255,0.45)', transition: 'transform var(--transition-fast)' },
    dropdown: {
      position: 'absolute', top: '100%', right: 0, marginTop: '8px',
      ...GLASS_CARD,
      borderRadius: '20px',
      minWidth: '180px',
      overflow: 'hidden', zIndex: 200,
    },
    dropdownItem: {
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '12px 16px', fontSize: '13px', fontFamily: 'var(--font-ui)',
      fontWeight: 400,
      lineHeight: 1.6,
      color: 'rgba(255,255,255,0.85)', cursor: 'pointer',
      transition: 'all var(--transition-fast)', border: 'none',
      background: 'transparent', width: '100%', textAlign: 'left',
    },
    dropdownDivider: { height: '1px', background: DIVIDER_LINE, margin: '4px 0' },
    dropdownName: {
      padding: '12px 16px 8px', fontSize: '12px',
      fontWeight: 400,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.35)',
      fontFamily: 'var(--font-ui)',
      lineHeight: 1.6,
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    },
  }

  const footerLinkStyle = { color: 'rgba(255,255,255,0.45)', fontSize: '13px', textDecoration: 'none', fontWeight: 400, lineHeight: 1.6 }

  if (isMobile) {
    return (
      <div style={{ position: 'relative', minHeight: '100vh', background: PAGE_BG }}>
        <PublicBgOrbs />
        <div style={{ position: 'relative', zIndex: 1 }}>
        <nav style={{ position: 'sticky', top: 0, zIndex: 100, ...GLASS_NAV, padding: '0 16px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={styles.logo} onClick={() => navigate('/')}>
            <span>LensTrybe</span>
          </div>
          <button type="button" style={styles.mobileMenuButton} onClick={() => setMobileMenuOpen(prev => !prev)} aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}>
            ☰
          </button>
        </nav>

        {mobileMenuOpen && (
          <div style={styles.mobileMenu} onClick={() => setMobileMenuOpen(false)}>
            <div style={styles.mobileMenuPanel} onClick={e => e.stopPropagation()}>
              {user && (
                <div style={styles.mobileProfile}>
                  <div style={styles.avatar}>
                    {profile?.avatar_url
                      ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : (displayName[0] ?? 'U').toUpperCase()}
                  </div>
                  <div style={{ fontSize: '14px', color: '#ffffff', fontFamily: 'var(--font-ui)', fontWeight: 400, lineHeight: 1.6 }}>{shortName}</div>
                </div>
              )}
              {[
                { label: 'Home', path: '/' },
                { label: 'Find Creatives', path: '/creatives' },
                { label: 'The Trybe Edit', path: '/the-trybe-edit' },
                { label: 'Upcoming Features', path: '/upcoming-features' },
                { label: 'Creator Partner Program', path: '/creator-partners' },
                { label: 'Pricing For Creatives', path: '/pricing' },
                ...(user ? [
                  { label: 'Dashboard', path: isCreative ? '/dashboard' : '/client-dashboard' },
                  { label: 'Settings', path: '/dashboard/settings' },
                ] : [
                  { label: 'Log In', path: '/login' },
                  { label: 'Join as a Creative', path: '/join' },
                ]),
              ].map((item) => (
                <button key={item.path + item.label} type="button" style={styles.mobileMenuLink} onClick={() => { setMobileMenuOpen(false); navigate(item.path) }}>
                  {item.label}
                </button>
              ))}
              {user && (
                <button type="button" style={{ ...styles.mobileMenuLink, color: 'var(--error)' }} onClick={() => { setMobileMenuOpen(false); signOut() }}>
                  Sign Out
                </button>
              )}
            </div>
          </div>
        )}

        <main style={{ minHeight: 'calc(100vh - 64px)', background: 'transparent' }}>
          <Outlet />
        </main>

        <footer style={{ background: 'transparent', position: 'relative' }}>
          <div style={{ height: '1px', background: DIVIDER_LINE }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', alignItems: 'center', padding: '24px 16px', fontSize: '13px', color: 'rgba(255,255,255,0.45)', fontWeight: 400, lineHeight: 1.6 }}>
            <div>© 2026 LensTrybe</div>
            <a href="mailto:connect@lenstrybe.com" style={footerLinkStyle}>connect@lenstrybe.com</a>
            <a href="/terms" style={footerLinkStyle}>Terms & Conditions</a>
            <a href="/privacy" style={footerLinkStyle}>Privacy Policy</a>
            <a href="/cookies" style={footerLinkStyle}>Cookies Policy</a>
            <a href="/the-trybe-edit" style={footerLinkStyle}>The Trybe Edit</a>
          </div>
        </footer>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: PAGE_BG }}>
      <PublicBgOrbs />
      <div style={{ position: 'relative', zIndex: 1 }}>
      <nav style={styles.nav}>
        {/* Left: Logo */}
        <div style={styles.logo} onClick={() => navigate('/')}>
          <span>LensTrybe</span>
          <span style={styles.tagline}>Connect. Capture. Create.</span>
        </div>

        {/* Centre: Nav links */}
        {!loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <button style={navLinkStyle} onClick={() => navigate('/the-trybe-edit')}>The Trybe Edit</button>
            <button style={navLinkStyle} onClick={() => navigate('/upcoming-features')}>Upcoming Features</button>
            <button style={navLinkStyle} onClick={() => navigate('/creator-partners')}>Creator Partner Program</button>
            <button style={navLinkStyle} onClick={() => navigate('/pricing')}>Pricing For Creatives</button>
          </div>
        )}

        {/* Right: Actions */}
        <div style={styles.actions}>
          {!loading && (
            user ? (
              <div style={{ position: 'relative' }} ref={dropdownRef}>
                <button
                  style={styles.userBtn}
                  onClick={() => setDropdownOpen(p => !p)}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(29,185,84,0.45)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(29,185,84,0.08)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <div style={styles.avatar}>
                    {profile?.avatar_url
                      ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : (displayName[0] ?? 'U').toUpperCase()}
                  </div>
                  <span>{shortName}</span>
                  <span style={{ ...styles.chevron, transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
                </button>

                {dropdownOpen && (
                  <div style={styles.dropdown}>
                    <div style={styles.dropdownName}>{displayName}</div>
                    <button
                      style={styles.dropdownItem}
                      onClick={() => { setDropdownOpen(false); navigate(isCreative ? '/dashboard' : '/client-dashboard') }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      ⊞ Dashboard
                    </button>
                    <button
                      style={styles.dropdownItem}
                      onClick={() => { setDropdownOpen(false); navigate('/dashboard/settings') }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      ⚙ Settings
                    </button>
                    <div style={styles.dropdownDivider} />
                    <button
                      style={{ ...styles.dropdownItem, color: '#FF2D78' }}
                      onClick={signOut}
                      onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      → Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>Log In</Button>
                <Button variant="primary" size="sm" onClick={() => navigate('/join')}>Join as a Creative</Button>
              </>
            )
          )}
        </div>
      </nav>

      <main style={{ minHeight: 'calc(100vh - 64px)', background: 'transparent' }}>
        <Outlet />
      </main>

      <footer style={{ background: 'transparent', position: 'relative' }}>
        <div style={{ height: '1px', background: DIVIDER_LINE }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', alignItems: 'center', padding: '24px 16px', fontSize: '13px', color: 'rgba(255,255,255,0.45)', fontWeight: 400, lineHeight: 1.6 }}>
          <div>© 2026 LensTrybe</div>
          <a href="mailto:connect@lenstrybe.com" style={footerLinkStyle}>connect@lenstrybe.com</a>
          <a href="/terms" style={footerLinkStyle}>Terms & Conditions</a>
          <a href="/privacy" style={footerLinkStyle}>Privacy Policy</a>
          <a href="/cookies" style={footerLinkStyle}>Cookies Policy</a>
          <a href="/the-trybe-edit" style={footerLinkStyle}>The Trybe Edit</a>
        </div>
      </footer>
      </div>
    </div>
  )
}
