import { useState, useRef, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import BrandLogo from '../ui/BrandLogo'

const FONT = "'Inter', sans-serif"

const PAGE_BG =
  'linear-gradient(135deg, #f7f6f4 0%, #f4f3f1 50%, #f6f5f7 100%)'

const TEXT_PRIMARY = '#14111a'
const TEXT_SECONDARY = '#55545f'
const TEXT_MUTED = '#8a8995'

const GLASS_NAV = {
  backdropFilter: 'blur(24px) saturate(160%)',
  WebkitBackdropFilter: 'blur(24px) saturate(160%)',
  background: 'rgba(255,255,255,0.72)',
  borderBottom: '1px solid rgba(20,17,26,0.06)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
}

const GLASS_CARD = {
  backdropFilter: 'blur(22px) saturate(150%)',
  WebkitBackdropFilter: 'blur(22px) saturate(150%)',
  background: 'linear-gradient(160deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.55) 100%)',
  border: '1px solid rgba(20,17,26,0.07)',
  borderRadius: '20px',
  boxShadow: '0 10px 30px -12px rgba(40,30,60,0.16), inset 0 1px 0 rgba(255,255,255,0.85)',
}

const GLASS_MODAL = {
  backdropFilter: 'blur(30px) saturate(150%)',
  WebkitBackdropFilter: 'blur(30px) saturate(150%)',
  background: 'linear-gradient(160deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.7) 100%)',
  border: '1px solid rgba(20,17,26,0.08)',
  borderRadius: '24px',
  boxShadow: '0 24px 64px -20px rgba(40,30,60,0.35), inset 0 1px 0 rgba(255,255,255,0.9)',
}

const GLASS_GHOST_BTN = {
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  background: 'linear-gradient(160deg, rgba(255,255,255,0.9), rgba(255,255,255,0.6))',
  border: '1px solid rgba(20,17,26,0.1)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
}

const DIVIDER_LINE = 'linear-gradient(90deg, transparent, rgba(20,17,26,0.08), transparent)'

function HamburgerIcon({ open }) {
  const stroke = TEXT_PRIMARY
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
      {open ? (
        <>
          <line x1="4" y1="4" x2="18" y2="18" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          <line x1="18" y1="4" x2="4" y2="18" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <line x1="3" y1="6" x2="19" y2="6" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          <line x1="3" y1="11" x2="19" y2="11" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          <line x1="3" y1="16" x2="19" y2="16" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}

function SolidButton({ onClick, children, style }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? '#2a2733' : '#14111a',
        color: '#fff', border: 'none', borderRadius: '8px',
        padding: '9px 18px', fontWeight: 500, fontSize: '13px',
        fontFamily: FONT, cursor: 'pointer', lineHeight: 1.4,
        boxShadow: '0 1px 2px rgba(20,17,26,0.25), inset 0 1px 0 rgba(255,255,255,0.12)',
        transition: 'background 0.15s ease', whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

function GhostButton({ onClick, children, style }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? 'rgba(20,17,26,0.05)' : 'transparent',
        color: TEXT_PRIMARY, border: '1px solid rgba(20,17,26,0.12)', borderRadius: '8px',
        padding: '9px 16px', fontWeight: 500, fontSize: '13px',
        fontFamily: FONT, cursor: 'pointer', lineHeight: 1.4,
        transition: 'background 0.15s ease', whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

function PublicBgOrbs() {
  const orb = (style) => (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        borderRadius: '50%',
        filter: 'blur(110px)',
        pointerEvents: 'none',
        zIndex: 0,
        ...style,
      }}
    />
  )
  return (
    <>
      {orb({ top: '-10%', left: '-10%', width: 'min(520px, 90vw)', height: 'min(520px, 90vw)', background: '#1DB954', opacity: 0.07 })}
      {orb({ top: '-12%', right: '-8%', width: 'min(480px, 85vw)', height: 'min(480px, 85vw)', background: '#FF2D78', opacity: 0.055 })}
      {orb({ bottom: '-10%', right: '-6%', width: 'min(500px, 88vw)', height: 'min(500px, 88vw)', background: '#1DB954', opacity: 0.05 })}
      {orb({ bottom: '-8%', left: '-8%', width: 'min(460px, 82vw)', height: 'min(460px, 82vw)', background: '#a855f7', opacity: 0.05 })}
    </>
  )
}

export default function PublicLayout() {
  const { user, profile, clientAccount, isCreative } = useAuth()
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
    color: TEXT_SECONDARY,
    fontSize: '13px',
    fontWeight: 500,
    letterSpacing: '-0.1px',
    cursor: 'pointer',
    opacity: 1,
    whiteSpace: 'nowrap',
    fontFamily: FONT,
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
      fontFamily: FONT, fontSize: '19px',
      fontWeight: 700,
      letterSpacing: '-0.03em',
      color: TEXT_PRIMARY, cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: '10px',
      lineHeight: 1.6,
    },
    tagline: {
      fontSize: '10.5px',
      fontWeight: 500,
      letterSpacing: '0.01em',
      color: TEXT_MUTED,
      fontFamily: FONT,
      lineHeight: 1.6,
    },
    actions: { display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-end' },
    mobileMenuButton: {
      width: '44px', height: '44px', borderRadius: '10px',
      ...GLASS_GHOST_BTN,
      color: TEXT_PRIMARY, display: 'flex', alignItems: 'center',
      justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
    },
    mobileMenu: {
      position: 'fixed', inset: 0,
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      background: 'rgba(20,17,26,0.28)',
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
      background: 'rgba(255,255,255,0.6)',
      border: '1px solid rgba(20,17,26,0.08)',
      color: TEXT_PRIMARY, fontSize: '16px', fontFamily: FONT,
      fontWeight: 500,
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
      padding: '6px 12px', borderRadius: '10px',
      ...GLASS_GHOST_BTN,
      color: TEXT_PRIMARY, fontSize: '13px', fontFamily: FONT,
      fontWeight: 500,
      cursor: 'pointer', transition: 'all var(--transition-fast)',
      lineHeight: 1.6,
    },
    avatar: {
      width: '28px', height: '28px', borderRadius: '9999px',
      background: 'rgba(29,185,84,0.14)',
      border: '1px solid rgba(29,185,84,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '11px', color: '#0f7a37', fontWeight: 700, letterSpacing: '-0.5px', flexShrink: 0,
    },
    chevron: { fontSize: '10px', color: TEXT_MUTED, transition: 'transform var(--transition-fast)' },
    dropdown: {
      position: 'absolute', top: '100%', right: 0, marginTop: '8px',
      ...GLASS_CARD,
      borderRadius: '16px',
      minWidth: '180px',
      overflow: 'hidden', zIndex: 200,
    },
    dropdownItem: {
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '12px 16px', fontSize: '13px', fontFamily: FONT,
      fontWeight: 500,
      lineHeight: 1.6,
      color: TEXT_PRIMARY, cursor: 'pointer',
      transition: 'all var(--transition-fast)', border: 'none',
      background: 'transparent', width: '100%', textAlign: 'left',
    },
    dropdownDivider: { height: '1px', background: DIVIDER_LINE, margin: '4px 0' },
    dropdownName: {
      padding: '12px 16px 8px', fontSize: '11px',
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: TEXT_MUTED,
      fontFamily: FONT,
      lineHeight: 1.6,
      borderBottom: '1px solid rgba(20,17,26,0.06)',
    },
  }

  const footerLinkStyle = { color: TEXT_MUTED, fontSize: '13px', textDecoration: 'none', fontWeight: 400, lineHeight: 1.6 }

  if (isMobile) {
    return (
      <div className="lt-public-light" style={{ position: 'relative', minHeight: '100vh', background: PAGE_BG }}>
        <PublicBgOrbs />
        <div style={{ position: 'relative', zIndex: 1 }}>
        <nav style={{ position: 'sticky', top: 0, zIndex: 100, ...GLASS_NAV, padding: '0 16px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={styles.logo} onClick={() => navigate('/')}>
            <BrandLogo markSize={24} fontSize={17} />
          </div>
          <button type="button" style={styles.mobileMenuButton} onClick={() => setMobileMenuOpen(prev => !prev)} aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}>
            <HamburgerIcon open={mobileMenuOpen} />
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
                  <div style={{ fontSize: '14px', color: TEXT_PRIMARY, fontFamily: FONT, fontWeight: 500, lineHeight: 1.6 }}>{shortName}</div>
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
                <button type="button" style={{ ...styles.mobileMenuLink, color: '#c11f5a' }} onClick={() => { setMobileMenuOpen(false); signOut() }}>
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', alignItems: 'center', padding: '24px 16px', fontSize: '13px', color: TEXT_MUTED, fontWeight: 400, lineHeight: 1.6 }}>
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
    <div className="lt-public-light" style={{ position: 'relative', minHeight: '100vh', background: PAGE_BG }}>
      <PublicBgOrbs />
      <div style={{ position: 'relative', zIndex: 1 }}>
      <nav style={styles.nav}>
        {/* Left: Logo */}
        <div style={styles.logo} onClick={() => navigate('/')}>
          <BrandLogo markSize={26} fontSize={18} />
          <span style={styles.tagline}>Connect. Capture. Create.</span>
        </div>

        {/* Centre: Nav links — always visible, no auth gate */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <button style={navLinkStyle} onClick={() => navigate('/the-trybe-edit')}>The Trybe Edit</button>
          <button style={navLinkStyle} onClick={() => navigate('/upcoming-features')}>Upcoming Features</button>
          <button style={navLinkStyle} onClick={() => navigate('/creator-partners')}>Creator Partner Program</button>
          <button style={navLinkStyle} onClick={() => navigate('/pricing')}>Pricing For Creatives</button>
        </div>

        {/* Right: Actions — show Log In/Join immediately; swap to user menu once auth resolves */}
        <div style={styles.actions}>
          {user ? (
              <div style={{ position: 'relative' }} ref={dropdownRef}>
                <button
                  style={styles.userBtn}
                  onClick={() => setDropdownOpen(p => !p)}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(29,185,84,0.45)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(29,185,84,0.08)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(20,17,26,0.1)'; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.9)' }}
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
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(20,17,26,0.04)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      ⊞ Dashboard
                    </button>
                    <button
                      style={styles.dropdownItem}
                      onClick={() => { setDropdownOpen(false); navigate('/dashboard/settings') }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(20,17,26,0.04)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                       Settings
                    </button>
                    <div style={styles.dropdownDivider} />
                    <button
                      style={{ ...styles.dropdownItem, color: '#c11f5a' }}
                      onClick={signOut}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(20,17,26,0.04)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      → Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <GhostButton onClick={() => navigate('/login')}>Log In</GhostButton>
                <SolidButton onClick={() => navigate('/join')}>Join as a Creative</SolidButton>
              </>
            )}
        </div>
      </nav>

      <main style={{ minHeight: 'calc(100vh - 64px)', background: 'transparent' }}>
        <Outlet />
      </main>

      <footer style={{ background: 'transparent', position: 'relative' }}>
        <div style={{ height: '1px', background: DIVIDER_LINE }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', alignItems: 'center', padding: '24px 16px', fontSize: '13px', color: TEXT_MUTED, fontWeight: 400, lineHeight: 1.6 }}>
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
