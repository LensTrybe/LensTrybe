import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import PublicProfilePage from '../public/PublicProfilePage'
import Button from '../../components/ui/Button'

export default function ViewProfilePage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
        padding: '16px 20px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-xl)',
      }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
            This is your public profile
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '2px' }}>
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
