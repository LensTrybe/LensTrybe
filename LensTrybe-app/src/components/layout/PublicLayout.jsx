import { useState, useRef, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import Button from '../ui/Button'

export default function PublicLayout() {
  const { user, profile, clientAccount, isCreative, loading } = useAuth()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
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

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  const displayName = profile?.business_name ?? (clientAccount ? `${clientAccount.first_name ?? ''} ${clientAccount.last_name ?? ''}`.trim() : null) ?? user?.email ?? ''
  const shortName = displayName.length > 20 ? displayName.slice(0, 20) + '…' : displayName

  const styles = {
    nav: {
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(8,8,16,0.9)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-subtle)',
      padding: '0 40px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', height: '64px',
    },
    logo: {
      fontFamily: 'var(--font-display)', fontSize: '20px',
      color: 'var(--text-primary)', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: '8px',
    },
    tagline: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', letterSpacing: '0.05em' },
    navLinks: { display: 'flex', alignItems: 'center', gap: '32px' },
    navLink: { fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color var(--transition-fast)', fontFamily: 'var(--font-ui)' },
    actions: { display: 'flex', alignItems: 'center', gap: '12px' },
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

  return (
    <div>
      <nav style={styles.nav}>
        <div style={styles.logo} onClick={() => navigate('/')}>
          <span>LensTrybe</span>
          <span style={styles.tagline}>Connect. Capture. Create.</span>
        </div>

        <div style={styles.navLinks}>
          <NavLink to="/creatives" style={styles.navLink}>Find a Creative</NavLink>
          <NavLink to="/pricing" style={styles.navLink}>Pricing</NavLink>
        </div>

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
                      : (displayName[0] ?? 'U').toUpperCase()
                    }
                  </div>
                  <span>{shortName}</span>
                  <span style={{ ...styles.chevron, transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
                </button>

                {dropdownOpen && (
                  <div style={styles.dropdown}>
                    <div style={styles.dropdownName}>{displayName}</div>
                    <button
                      style={styles.dropdownItem}
                      onClick={() => {
                        setDropdownOpen(false)
                        const p = window.location.pathname
                        if (p.startsWith('/portal/') || p.startsWith('/deliver/')) return
                        navigate(isCreative ? '/dashboard' : '/client-dashboard')
                      }}
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
                <Button variant="secondary" size="sm" onClick={() => navigate('/creatives')}>Find a Creative</Button>
                <Button variant="primary" size="sm" onClick={() => navigate('/join')}>Join as a Creative</Button>
              </>
            )
          )}
        </div>
      </nav>

      <main style={{ minHeight: 'calc(100vh - 64px)', background: 'var(--bg-base)' }}>
        <Outlet />
      </main>
    </div>
  )
}
