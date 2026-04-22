import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import useAccountKind from '../../hooks/useAccountKind'

export default function PublicNavbar() {
  const [isAuthed, setIsAuthed] = useState(false)
  const [userLabel, setUserLabel] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()
  const { kind: accountKind, loading: kindLoading } = useAccountKind()

  useEffect(() => {
    let mounted = true
    const run = async () => {
      if (!supabase) return
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      const u = data?.session?.user ?? null
      setIsAuthed(Boolean(u))
      setUserLabel(
        String(
          u?.user_metadata?.first_name ||
            u?.user_metadata?.full_name ||
            u?.email ||
            '',
        ).trim(),
      )
    }
    run()

    if (!supabase) return () => { mounted = false }
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!mounted) return
      const u = session?.user ?? null
      setIsAuthed(Boolean(u))
      setUserLabel(
        String(
          u?.user_metadata?.first_name ||
            u?.user_metadata?.full_name ||
            u?.email ||
            '',
        ).trim(),
      )
    })
    return () => {
      mounted = false
      sub?.subscription?.unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    const onDown = (e) => {
      if (!menuOpen) return
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    const onEsc = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setMobileNavOpen(false)
      }
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onEsc)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onEsc)
    }
  }, [menuOpen])

  const BRAND = {
    bg: '#080810',
    pink: '#D946EF',
    green: '#4ADE80',
    border: '#1a1a2e',
    text: '#ffffff',
  }

  const initials = useMemo(() => {
    const txt = String(userLabel || '').trim()
    if (!txt) return 'U'
    if (txt.includes('@')) return txt.slice(0, 2).toUpperCase()
    const parts = txt.split(/\s+/).filter(Boolean)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
  }, [userLabel])

  const navStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: 64,
    zIndex: 100,
    background: BRAND.bg,
    borderBottom: `1px solid ${BRAND.border}`,
    padding: '0 40px',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    fontFamily: 'Inter, sans-serif',
  }

  const navLink = {
    color: BRAND.text,
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 600,
    opacity: 0.9,
  }

  const joinCreativeBtn = {
    background: BRAND.green,
    color: '#080810',
    border: 'none',
    borderRadius: 8,
    padding: '8px 18px',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const loginBtn = {
    background: 'transparent',
    color: BRAND.pink,
    border: `1px solid ${BRAND.pink}`,
    borderRadius: 8,
    padding: '8px 18px',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const dashboardPath = accountKind === 'client' ? '/client-dashboard' : '/dashboard'
  const dashboardLabel = accountKind === 'client' ? 'Client home' : 'Dashboard'

  const closeMobile = () => setMobileNavOpen(false)

  return (
    <div style={navStyle}>
      <Link to="/" style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0, textDecoration: 'none' }}>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 900, letterSpacing: '-0.02em' }}>LensTrybe</div>
        <div style={{ color: BRAND.pink, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }} className="lt-nav-tagline">
          Connect. Capture. Create.
        </div>
      </Link>

      {!isAuthed ? (
        <div
          className="lt-desktop-nav lt-nav-middle"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            justifyContent: 'center',
            flex: 1,
            minWidth: 0,
          }}
        >
          <Link to="/newsletter" style={navLink}>The Trybe Edit</Link>
          <Link to="/creator-partners" style={navLink}>Creator Partner Program</Link>
          <Link to="/pricing" style={navLink}>Pricing For Creatives</Link>
        </div>
      ) : null}

      <div
        className="lt-desktop-nav"
        style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'flex-end' }}
      >
        {isAuthed ? (
          <>
            <Link to={dashboardPath} style={navLink}>
              {kindLoading ? 'Dashboard' : dashboardLabel}
            </Link>
            <Link to="/find-a-creative" style={navLink}>Find a Creative</Link>
            <Link to="/job-board" style={navLink}>Job Board</Link>
            <Link to="/pricing" style={navLink}>Pricing</Link>

            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.16)',
                  color: '#fff',
                  borderRadius: 999,
                  padding: '6px 10px 6px 8px',
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: 'rgba(74,222,128,0.18)',
                    border: `1px solid rgba(74,222,128,0.35)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: BRAND.green,
                    fontWeight: 900,
                    fontSize: 12,
                    letterSpacing: '0.02em',
                  }}
                  aria-hidden
                >
                  {initials}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {userLabel || 'Account'}
                </div>
                <div style={{ color: '#bbb', fontSize: 12 }} aria-hidden>▾</div>
              </button>

              {menuOpen ? (
                <div
                  style={{
                    position: 'absolute',
                    top: 42,
                    right: 0,
                    width: 190,
                    background: '#0f0f18',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 12,
                    padding: 8,
                    boxShadow: '0 16px 50px rgba(0,0,0,0.45)',
                    zIndex: 200,
                  }}
                >
                  {[
                    { label: kindLoading ? 'Dashboard' : dashboardLabel, onClick: () => navigate(dashboardPath) },
                    { label: 'Settings', onClick: () => navigate('/settings') },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => { setMenuOpen(false); item.onClick() }}
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        color: '#eaeaea',
                        padding: '10px 10px',
                        borderRadius: 10,
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: 'Inter, sans-serif',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    >
                      {item.label}
                    </button>
                  ))}
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '6px 0' }} />
                  <button
                    type="button"
                    onClick={async () => {
                      setMenuOpen(false)
                      if (supabase) await supabase.auth.signOut()
                      navigate('/')
                    }}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      color: '#ffb4b4',
                      padding: '10px 10px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: 13,
                      fontWeight: 800,
                      fontFamily: 'Inter, sans-serif',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,0,0,0.08)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    Sign Out
                  </button>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <Link to="/login" style={loginBtn}>Log In</Link>
            <Link to="/join" style={joinCreativeBtn}>Join as a Creative</Link>
          </>
        )}
      </div>

      <button
        type="button"
        className="lt-mobile-nav-toggle"
        aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
        onClick={() => setMobileNavOpen((o) => !o)}
        style={{
          display: 'none',
          background: 'rgba(255,255,255,0.06)',
          border: `1px solid ${BRAND.border}`,
          color: '#fff',
          borderRadius: 10,
          padding: 10,
          cursor: 'pointer',
        }}
      >
        {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      <style>{`
        @media (max-width: 960px) {
          .lt-desktop-nav { display: none !important; }
          .lt-mobile-nav-toggle { display: flex !important; align-items: center; justify-content: center; }
          .lt-nav-tagline { display: none; }
        }
      `}</style>

      {mobileNavOpen ? (
        <div
          style={{
            position: 'fixed',
            top: 64,
            left: 0,
            right: 0,
            background: BRAND.bg,
            borderBottom: `1px solid ${BRAND.border}`,
            padding: '16px 24px 20px',
            zIndex: 99,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {isAuthed ? (
            <>
              <Link to={dashboardPath} onClick={closeMobile} style={{ ...navLink, padding: '8px 0' }}>
                {kindLoading ? 'Dashboard' : dashboardLabel}
              </Link>
              <Link to="/find-a-creative" onClick={closeMobile} style={{ ...navLink, padding: '8px 0' }}>Find a Creative</Link>
              <Link to="/job-board" onClick={closeMobile} style={{ ...navLink, padding: '8px 0' }}>Job Board</Link>
              <Link to="/pricing" onClick={closeMobile} style={{ ...navLink, padding: '8px 0' }}>Pricing</Link>
              <Link to="/settings" onClick={closeMobile} style={{ ...navLink, padding: '8px 0' }}>Settings</Link>
              <button
                type="button"
                onClick={async () => {
                  closeMobile()
                  if (supabase) await supabase.auth.signOut()
                  navigate('/')
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ffb4b4',
                  fontWeight: 800,
                  textAlign: 'left',
                  padding: '8px 0',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link to="/newsletter" onClick={closeMobile} style={{ ...navLink, padding: '8px 0' }}>The Trybe Edit</Link>
              <Link to="/creator-partners" onClick={closeMobile} style={{ ...navLink, padding: '8px 0' }}>Creator Partner Program</Link>
              <Link to="/pricing" onClick={closeMobile} style={{ ...navLink, padding: '8px 0' }}>Pricing For Creatives</Link>
              <Link to="/login" onClick={closeMobile} style={{ ...loginBtn, justifyContent: 'center' }}>Log In</Link>
              <Link to="/join" onClick={closeMobile} style={{ ...joinCreativeBtn, justifyContent: 'center' }}>Join as a Creative</Link>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
