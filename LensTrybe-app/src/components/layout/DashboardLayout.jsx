import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

const PAGE_BG =
  'linear-gradient(135deg, #060610 0%, #0a0a1a 30%, #060d06 70%, #0a060d 100%)'

const GLASS_HAMBURGER = {
  backdropFilter: 'blur(40px) saturate(180%)',
  WebkitBackdropFilter: 'blur(40px) saturate(180%)',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))',
  border: '1px solid rgba(255,255,255,0.1)',
  borderTop: '1px solid rgba(255,255,255,0.16)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
}

export default function DashboardLayout() {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

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
            color: '#ffffff',
            cursor: 'pointer',
            fontSize: '20px',
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
          ☰
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
            background: 'rgba(0,0,0,0.55)',
            zIndex: 999,
          }}
        />
      )}
      <div style={{ display: isMobile ? 'block' : 'flex', minHeight: '100vh', background: PAGE_BG, width: '100%', position: 'relative', zIndex: 1 }}>
        {!isMobile && <Sidebar isMobile={false} mobileOpen={false} onCloseMobile={() => setMobileSidebarOpen(false)} />}
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
            <Outlet />
          </div>
        </main>
      </div>
      {isMobile && (
        <Sidebar isMobile mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />
      )}
    </>
  )
}
