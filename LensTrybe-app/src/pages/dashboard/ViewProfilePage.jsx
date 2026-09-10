import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import PublicProfilePage from '../public/PublicProfilePage'

const GREEN = '#1DB954'
const GREEN_DARK = '#04120a'

export default function ViewProfilePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)

  useEffect(() => {
    function handleResize() { setIsMobile(window.innerWidth < 768) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const GLASS = { background: 'var(--lt-glass-bg)', border: 'var(--lt-glass-border)', boxShadow: 'var(--lt-glass-shadow)', backdropFilter: 'var(--lt-glass-blur)', WebkitBackdropFilter: 'var(--lt-glass-blur)' }

  return (
    <div>
      <style>{`
        .ltvp-edit { display: inline-flex; align-items: center; justify-content: center; border-radius: 9px; padding: 9px 18px; font-size: 13.5px; font-weight: 700; font-family: inherit; cursor: pointer; border: none; white-space: nowrap; background: ${GREEN}; color: ${GREEN_DARK}; transition: filter .15s ease; }
        .ltvp-edit:hover { filter: brightness(1.06); }
      `}</style>
      <div style={{
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 12 : 16,
        marginBottom: 24,
        padding: isMobile ? 16 : '16px 20px',
        borderRadius: 18,
        ...GLASS,
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--lt-text)' }}>This is your public profile</div>
          <div style={{ fontSize: 12.5, color: 'var(--lt-muted)', marginTop: 3 }}>Exactly what clients see when they find you in search results.</div>
        </div>
        <button type="button" className="ltvp-edit" onClick={() => navigate('/dashboard/profile/edit-profile')}>Edit profile</button>
      </div>

      <PublicProfilePage previewMode={true} previewId={user?.id} />
    </div>
  )
}
