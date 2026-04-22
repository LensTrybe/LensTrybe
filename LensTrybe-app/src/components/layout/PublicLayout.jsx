import { useState, useRef, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import Button from '../ui/Button'

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
    color: 'var(--text-primary)',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    opacity: 0.9,
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-ui)',
    padding: 0,
  }

  const styles = {
    nav: {
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(8,8,16,0.9)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-subtle)',
      padding: '0 40px', height: '64px',
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      gap: '16px',
    },
    logo: {
      fontFamily: 'var(--font-display)', fontSize: '20px',
      color: 'var(--text-primary)', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: '8px',
    },
    tagline: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', letterSpacing: '0.05em' },
    actions: { display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-end' },
    mobileMenuButton: {
      width: '44px', height: '44px', borderRadius: '10px',
      border: '1px solid var(--border-default)', background: 'transparent',
      color: 'var(--text-primary)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: '20px', cursor: 'pointer', flexShrink: 0,
    },
    mobileMenu: {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
      zIndex: 300, display: 'flex', justifyContent: 'flex-end',
      flexDirection: 'column', padding: '16px', paddingTop: '80px',
    },
    mobileMenuPanel: {
      background: 'var(--bg-overlay)', border: '1px solid var(--border-default)',
      borderRadius: '16px', padding: '16px', display: 'flex',
      flexDirection: 'column', gap: '10px',
      maxHeight: 'calc(100vh - 96px)', overflowY: 'auto',
    },
    mobileMenuLink: {
      width: '100%', minHeight: '52px', borderRadius: '10px',
      border: '1px solid var(--border-default)', background: 'var(--bg-elevated)',
      color: 'var(--text-primary)', fontSize: '16px', fontFamily: 'var(--font-ui)',
      textAlign: 'left', padding: '12px 14px', cursor: 'pointer',
    },
    mobileProfile: {
      display: 'flex', alignItems: 'center', gap: '10px',
      border: '1px solid var(--border-default)', background: 'var(--bg-elevated)',
      borderRadius: '12px', padding: '10px 12px', marginBottom: '4px',
    },
    userBtn: {
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '6px 12px', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-default)', background: 'transparent',
      color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-ui)',
      cursor: 'pointer', transition: 'all var(--transition-fast)',
    },
    avatar: {
      width: '28px', height: '28px', borderRadius: 'var(--radius-full)',
      background: 'var(--green-dim)', border: '1px solid rgba(29,185,84,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '11px', color: 'var(--green)', fontWeight: 700, flexShrink: 0,
    },
    chevron: { fontSize: '10px', color: 'var(--text-muted)', transition: 'transform var(--transition-fast)' },
    dropdown: {
      position: 'absolute', top: '100%', right: 0, marginTop: '8px',
      background: 'var(--bg-overlay)', border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-xl)', minWidth: '180px',
      boxShadow: 'var(--shadow-lg)', overflow: 'hidden', zIndex: 200,
    },
    dropdownItem: {
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '12px 16px', fontSize: '13px', fontFamily: 'var(--font-ui)',
      color: 'var(--text-secondary)', cursor: 'pointer',
      transition: 'all var(--transition-fast)', border: 'none',
      background: 'transparent', width: '100%', textAlign: 'left',
    },
    dropdownDivider: { height: '1px', background: 'var(--border-subtle)', margin: '4px 0' },
    dropdownName: {
      padding: '12px 16px 8px', fontSize: '12px', color: 'var(--text-muted)',
      fontFamily: 'var(--font-ui)', borderBottom: '1px solid var(--border-subtle)',
    },
  }

  if (isMobile) {
    return (
      <div>
        <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(8,8,16,0.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-subtle)', padding: '0 16px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                  <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>{shortName}</div>
                </div>
              )}
              {[
                { label: 'Home', path: '/' },
                { label: 'Find Creatives', path: '/creatives' },
                { label: 'The Trybe Edit', path: '/the-trybe-edit' },
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

        <main style={{ minHeight: 'calc(100vh - 64px)', background: 'var(--bg-base)' }}>
          <Outlet />
        </main>

        <footer style={{ background: '#0a0a0f' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', alignItems: 'center', padding: '24px 16px', borderTop: '1px solid var(--border-default)', fontSize: '13px', color: 'var(--text-muted)' }}>
            <div>© 2026 LensTrybe</div>
            <a href="mailto:connect@lenstrybe.com" style={{ color: '#666', fontSize: '13px', textDecoration: 'none' }}>connect@lenstrybe.com</a>
            <a href="/terms" style={{ color: '#666', fontSize: '13px', textDecoration: 'none' }}>Terms & Conditions</a>
            <a href="/privacy" style={{ color: '#666', fontSize: '13px', textDecoration: 'none' }}>Privacy Policy</a>
            <a href="/cookies" style={{ color: '#666', fontSize: '13px', textDecoration: 'none' }}>Cookies Policy</a>
            <a href="/the-trybe-edit" style={{ color: '#666', fontSize: '13px', textDecoration: 'none' }}>The Trybe Edit</a>
          </div>
        </footer>
      </div>
    )
  }

  return (
    <div>
      <nav style={styles.nav}>
        {/* Left: Logo */}
        <div style={styles.logo} onClick={() => navigate('/')}>
          <span>LensTrybe</span>
          <span style={styles.tagline}>Connect. Capture. Create.</span>
        </div>

        {/* Centre: Nav links (logged out only) */}
        {!loading && !user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <button style={navLinkStyle} onClick={() => navigate('/the-trybe-edit')}>The Trybe Edit</button>
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
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--green)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
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
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      ⊞ Dashboard
                    </button>
                    <button
                      style={styles.dropdownItem}
                      onClick={() => { setDropdownOpen(false); navigate('/dashboard/settings') }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      ⚙ Settings
                    </button>
                    <div style={styles.dropdownDivider} />
                    <button
                      style={{ ...styles.dropdownItem, color: 'var(--error)' }}
                      onClick={signOut}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
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

      <main style={{ minHeight: 'calc(100vh - 64px)', background: 'var(--bg-base)' }}>
        <Outlet />
      </main>

      <footer style={{ background: '#0a0a0f' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', alignItems: 'center', padding: '24px 16px', borderTop: '1px solid var(--border-default)', fontSize: '13px', color: 'var(--text-muted)' }}>
          <div>© 2026 LensTrybe</div>
          <a href="mailto:connect@lenstrybe.com" style={{ color: '#666', fontSize: '13px', textDecoration: 'none' }}>connect@lenstrybe.com</a>
          <a href="/terms" style={{ color: '#666', fontSize: '13px', textDecoration: 'none' }}>Terms & Conditions</a>
          <a href="/privacy" style={{ color: '#666', fontSize: '13px', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="/cookies" style={{ color: '#666', fontSize: '13px', textDecoration: 'none' }}>Cookies Policy</a>
          <a href="/the-trybe-edit" style={{ color: '#666', fontSize: '13px', textDecoration: 'none' }}>The Trybe Edit</a>
        </div>
      </footer>
    </div>
  )
}
