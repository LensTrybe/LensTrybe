import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TileField from '../ui/TileField'

// Dark base + drifting pastel "northern lights" wash behind the whole dashboard.
const AURORA_WRAP = {
  position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none',
  background: 'radial-gradient(1200px 900px at 15% -12%, #100f20 0%, transparent 55%), radial-gradient(1000px 820px at 100% 116%, #0a1622 0%, transparent 55%), #07060c',
}
const auroraBlob = (c, o) => ({ position: 'absolute', borderRadius: '50%', background: c, filter: 'blur(100px)', mixBlendMode: 'screen', opacity: o })

// Light mode: the same bright pastel mosaic as the hero, behind everything, with
// a soft white wash on top so text and glass widgets stay readable.
const LIGHT_WRAP = {
  position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none',
  background: '#eef1f6',
}
const LIGHT_SCRIM = 'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.30) 20%, rgba(255,255,255,0.34) 100%)'

const DARK_WRAP = {
  position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none',
  background: '#08070d',
}
const DARK_SCRIM = 'linear-gradient(180deg, rgba(8,7,13,0.42) 0%, rgba(8,7,13,0.55) 45%, rgba(8,7,13,0.66) 100%)'

const GLASS_HAMBURGER = {
  backdropFilter: 'blur(20px) saturate(150%)',
  WebkitBackdropFilter: 'blur(20px) saturate(150%)',
  background: 'linear-gradient(160deg, rgba(255,255,255,0.92), rgba(255,255,255,0.7))',
  border: '1px solid rgba(20,17,26,0.12)',
  borderTop: '1px solid rgba(255,255,255,0.9)',
  boxShadow: '0 4px 16px -6px rgba(40,30,60,0.2)',
}

function HamburgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
      <line x1="3" y1="6" x2="19" y2="6" stroke="#14111a" strokeWidth="2" strokeLinecap="round" />
      <line x1="3" y1="11" x2="19" y2="11" stroke="#14111a" strokeWidth="2" strokeLinecap="round" />
      <line x1="3" y1="16" x2="19" y2="16" stroke="#14111a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export default function DashboardLayout() {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [theme, setTheme] = useState(() => (typeof window !== 'undefined' && localStorage.getItem('lt_dash_theme')) || 'light')
  const dark = theme === 'dark'
  const location = useLocation()
  const isHome = location.pathname === '/dashboard' || location.pathname === '/dashboard/'
  function toggleTheme() {
    setTheme((p) => {
      const n = p === 'dark' ? 'light' : 'dark'
      try { localStorage.setItem('lt_dash_theme', n) } catch { /* ignore */ }
      return n
    })
  }

  useEffect(() => {
    function handleResize() {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) setMobileSidebarOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <>
      <style>{`
        .lt-dash[data-theme="light"] {
          --lt-text: #14111a;
          --lt-muted: #55535f;
          --lt-faint: #86848f;
          --lt-glass-bg: linear-gradient(125deg, rgba(255,255,255,0.66) 0%, rgba(255,255,255,0.34) 42%, rgba(255,255,255,0.2) 100%);
          --lt-glass-border: 1px solid rgba(255,255,255,0.78);
          --lt-glass-shadow: 0 18px 50px -16px rgba(31,38,90,0.26), inset 0 1px 1px rgba(255,255,255,0.95);
          --lt-glass-blur: blur(12px) saturate(180%) brightness(1.05);
          --lt-modal-bg: linear-gradient(125deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.8) 100%);
          --lt-modal-border: 1px solid rgba(255,255,255,0.9);
          --lt-modal-shadow: 0 40px 100px -30px rgba(31,38,90,0.4), inset 0 1px 1px rgba(255,255,255,0.95);
          --lt-modal-blur: blur(30px) saturate(180%) brightness(1.04);
          --lt-sheen: linear-gradient(150deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.14) 26%, rgba(255,255,255,0) 52%);
          --lt-surface: rgba(20,17,26,0.05);
          --lt-surface-2: rgba(20,17,26,0.07);
          --lt-border: rgba(20,17,26,0.12);
          --lt-input-bg: rgba(255,255,255,0.72);
          --lt-input-border: rgba(20,17,26,0.16);
          --lt-hairline: rgba(20,17,26,0.09);
          --lt-track: rgba(20,17,26,0.10);
          --lt-chart-grid: rgba(20,17,26,0.10);
          --lt-chart-axis: rgba(20,17,26,0.5);
        }
        .lt-dash[data-theme="dark"] {
          --lt-text: rgba(255,255,255,0.92);
          --lt-muted: rgba(255,255,255,0.5);
          --lt-faint: rgba(255,255,255,0.42);
          --lt-glass-bg: linear-gradient(160deg, rgba(36,36,46,0.66) 0%, rgba(18,18,26,0.54) 100%);
          --lt-glass-border: 1px solid rgba(255,255,255,0.14);
          --lt-glass-shadow: 0 24px 60px -22px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 2px rgba(255,255,255,0.08), inset 1px 0 3px rgba(255,255,255,0.08), inset -1px 0 3px rgba(255,255,255,0.08);
          --lt-glass-blur: blur(22px) saturate(155%);
          --lt-modal-bg: linear-gradient(160deg, rgba(30,30,40,0.82) 0%, rgba(16,16,24,0.76) 100%);
          --lt-modal-border: 1px solid rgba(255,255,255,0.16);
          --lt-modal-shadow: 0 40px 100px -30px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.22), inset 1px 0 3px rgba(255,255,255,0.08), inset -1px 0 3px rgba(255,255,255,0.08);
          --lt-modal-blur: blur(32px) saturate(155%);
          --lt-sheen: linear-gradient(150deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 26%, rgba(255,255,255,0) 52%);
          --lt-surface: rgba(255,255,255,0.04);
          --lt-surface-2: rgba(255,255,255,0.06);
          --lt-border: rgba(255,255,255,0.10);
          --lt-input-bg: rgba(255,255,255,0.06);
          --lt-input-border: rgba(255,255,255,0.14);
          --lt-hairline: rgba(255,255,255,0.07);
          --lt-track: rgba(255,255,255,0.08);
          --lt-chart-grid: rgba(255,255,255,0.08);
          --lt-chart-axis: rgba(255,255,255,0.45);
        }
      `}</style>
      {dark ? (
        <div aria-hidden style={DARK_WRAP}>
          <TileField dark opacity={isHome ? 0.85 : 0.3} animated={isHome} />
          <div style={{ position: 'absolute', inset: 0, background: DARK_SCRIM }} />
        </div>
      ) : (
        <div aria-hidden style={LIGHT_WRAP}>
          <TileField opacity={isHome ? 1 : 0.22} animated={isHome} />
          <div style={{ position: 'absolute', inset: 0, background: LIGHT_SCRIM }} />
        </div>
      )}
      {isMobile && (
        <button
          type="button"
          className="hamburger-btn"
          onClick={() => setMobileSidebarOpen(true)}
          style={{
            position: 'fixed',
            top: '12px',
            left: '12px',
            zIndex: 1002,
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            ...GLASS_HAMBURGER,
            color: '#14111a',
            cursor: 'pointer',
            fontWeight: 600,
            letterSpacing: '-0.3px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1.6,
            transition: 'all 0.2s',
          }}
          aria-label="Open navigation menu"
        >
          <HamburgerIcon />
        </button>
      )}
      {isMobile && mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            background: 'rgba(20,17,26,0.35)',
            zIndex: 999,
          }}
        />
      )}
      <div className="lt-dash" data-theme={theme} style={{ display: isMobile ? 'block' : 'flex', minHeight: '100vh', background: 'transparent', colorScheme: dark ? 'dark' : 'light', width: '100%', position: 'relative', zIndex: 1 }}>
        {!isMobile && <Sidebar isMobile={false} mobileOpen={false} onCloseMobile={() => setMobileSidebarOpen(false)} theme={theme} />}
        <main style={{
          flex: 1,
          minWidth: 0,
          width: '100%',
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflowX: 'hidden',
          boxSizing: 'border-box',
        }} className="dashboard-main-content">
          <div style={{
            flex: 1,
            padding: isMobile ? '72px 16px 24px' : '32px 40px',
            maxWidth: '1280px',
            width: '100%',
            margin: '0 auto',
            boxSizing: 'border-box',
          }} className="dash-main">
            <Outlet context={{ theme, toggleTheme, dark }} />
          </div>
        </main>
      </div>
      {isMobile && (
        <Sidebar isMobile mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} theme={theme} />
      )}
    </>
  )
}
