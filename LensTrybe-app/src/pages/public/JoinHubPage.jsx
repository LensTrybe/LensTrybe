import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { LT_JOIN_FLASH_KEY } from '../../context/AuthContext'
import { LIQUID_GLASS } from '../../lib/glassTokensLight'
import { LiquidLensFilter, LiquidPill } from '../../components/ui/liquidGlass'
import TileField from '../../components/ui/TileField'

export default function JoinHubPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const emailHint = typeof location.state?.email === 'string' ? location.state.email.trim() : ''
  const [flash, setFlash] = useState('')

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(LT_JOIN_FLASH_KEY)
      if (!raw) return
      sessionStorage.removeItem(LT_JOIN_FLASH_KEY)
      const parsed = JSON.parse(raw)
      if (parsed?.message) setFlash(String(parsed.message))
    } catch {
      /* ignore */
    }
  }, [])

  function goCreative() {
    navigate('/join/creative', { state: emailHint ? { email: emailHint } : undefined })
  }

  function goClient() {
    navigate('/join/client', { state: emailHint ? { email: emailHint } : undefined })
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'transparent',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      fontFamily: 'var(--font-ui)',
    }}
    >
      <LiquidLensFilter />
      <TileField animated={false} opacity={0.22} />
      <div style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '24px', ...LIQUID_GLASS, position: 'relative', zIndex: 2, padding: '36px 32px' }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, letterSpacing: '-0.02em', fontSize: '20px', color: 'var(--text-primary)', marginBottom: '8px', cursor: 'pointer' }}
            onClick={() => navigate('/')}
            role="presentation"
          >
            LensTrybe
          </div>
          <h1 style={{ fontFamily: "'Inter', sans-serif", fontSize: '30px', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--text-primary)', margin: '0 0 8px' }}>
            Create an account
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            Choose how you will use LensTrybe: as a creative (photographer, videographer, and so on) or as a client hiring creatives.
          </p>
        </div>

        {flash && (
          <div style={{
            background: 'rgba(29,185,84,0.1)',
            border: '1px solid rgba(29,185,84,0.35)',
            borderRadius: 'var(--radius-lg)',
            padding: '12px 16px',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}
          >
            {flash}
          </div>
        )}

        {emailHint && (
          <div style={{
            fontSize: '13px',
            color: 'var(--text-muted)',
            textAlign: 'center',
            padding: '8px 12px',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-default)',
          }}
          >
            Email we will use: <strong style={{ color: 'var(--text-primary)' }}>{emailHint}</strong>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <LiquidPill primary style={{ width: '100%', display: 'inline-flex', padding: '15px 22px' }} onClick={goCreative}>
            Join as a Creative
          </LiquidPill>
          <LiquidPill style={{ width: '100%', display: 'inline-flex', padding: '15px 22px' }} onClick={goClient}>
            Join as a Client
          </LiquidPill>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--green)', fontWeight: 600, textDecoration: 'none' }}>Log in</Link>
        </p>
      </div>
    </div>
  )
}
