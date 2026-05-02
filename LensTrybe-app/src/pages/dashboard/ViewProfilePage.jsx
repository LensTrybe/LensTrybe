import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import PublicProfilePage from '../public/PublicProfilePage'
import Button from '../../components/ui/Button'
import { GLASS_CARD, TYPO } from '../../lib/glassTokens'

export default function ViewProfilePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div style={{ background: 'transparent' }}>
      <div style={{
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? '12px' : '0',
        marginBottom: '24px',
        padding: isMobile ? '16px' : '16px 20px',
        ...GLASS_CARD,
        borderRadius: 'var(--radius-xl)',
      }}>
        <div>
          <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', ...TYPO.heading }}>
            This is your public profile
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '2px', ...TYPO.body }}>
            Exactly what clients see when they find you in search results.
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/dashboard/profile/edit-profile')}>
          Edit Profile
        </Button>
      </div>

      <PublicProfilePage previewMode={true} previewId={user?.id} />
    </div>
  )
}
