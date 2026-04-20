import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

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
            border: '1px solid var(--border-default)',
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Open navigation menu"
        >
          ☰
        </button>
      )}
      {isMobile && mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 999 }}
        />
      )}
      <div style={{ display: isMobile ? 'block' : 'flex', minHeight: '100vh', background: 'var(--bg-base)', width: '100%' }}>
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
