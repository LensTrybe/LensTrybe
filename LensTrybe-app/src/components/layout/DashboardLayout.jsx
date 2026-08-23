import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

// Dark base + drifting pastel "northern lights" wash behind the whole dashboard.
const AURORA_WRAP = {
  position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none',
  background: 'radial-gradient(1200px 900px at 15% -12%, #100f20 0%, transparent 55%), radial-gradient(1000px 820px at 100% 116%, #0a1622 0%, transparent 55%), #07060c',
}
const auroraBlob = (c, o) => ({ position: 'absolute', borderRadius: '50%', background: c, filter: 'blur(100px)', mixBlendMode: 'screen', opacity: o })

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
      <div aria-hidden style={AURORA_WRAP}>
        <div style={{ ...auroraBlob('#22e39a', 0.5), width: 720, height: 480, top: '-14%', left: '-6%', animation: 'auroraA 22s ease-in-out infinite alternate' }} />
        <div style={{ ...auroraBlob('#38bdf8', 0.5), width: 640, height: 540, top: '-10%', right: '-2%', animation: 'auroraB 26s ease-in-out infinite alternate' }} />
        <div style={{ ...auroraBlob('#7c5cff', 0.5), width: 780, height: 560, bottom: '-18%', right: '-8%', animation: 'auroraC 24s ease-in-out infinite alternate' }} />
        <div style={{ ...auroraBlob('#e0559a', 0.38), width: 560, height: 460, bottom: '-16%', left: '4%', animation: 'auroraD 28s ease-in-out infinite alternate' }} />
      </div>
      <style>{`
        @keyframes auroraA { from { transform: translate(0,0) scale(1) } to { transform: translate(46px,34px) scale(1.12) } }
        @keyframes auroraB { from { transform: translate(0,0) scale(1) } to { transform: translate(-44px,42px) scale(1.08) } }
        @keyframes auroraC { from { transform: translate(0,0) scale(1) } to { transform: translate(-34px,-44px) scale(1.14) } }
        @keyframes auroraD { from { transform: translate(0,0) scale(1) } to { transform: translate(44px,-32px) scale(1.06) } }
      `}</style>
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
      <div style={{ display: isMobile ? 'block' : 'flex', minHeight: '100vh', background: 'transparent', colorScheme: dark ? 'dark' : 'light', width: '100%', position: 'relative', zIndex: 1 }}>
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
