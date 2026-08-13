import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TYPO, LIQUID_GLASS_CARD } from '../../lib/glassTokensLight'
import { LiquidLensFilter, LiquidPill } from '../../components/ui/liquidGlass'
import TileField from '../../components/ui/TileField'

const ISSUE_01 = {
  issueNumber: 1,
  title: 'What LensTrybe Can Actually Do for Your Creative Business',
  monthYear: 'May 2026',
}

export default function TrybeEditPage() {
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  const styles = {
    page: { background: 'transparent', minHeight: 'calc(100vh - 64px)', paddingBottom: '80px' },
    header: {
      padding: isMobile ? '40px 16px 24px' : '80px 24px 48px',
      maxWidth: '1280px',
      margin: '0 auto',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px',
    },
    title: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 600,
      letterSpacing: '-0.02em',
      fontSize: 'clamp(36px, 4.6vw, 64px)',
      color: 'var(--text-primary)',
      margin: 0,
      lineHeight: 1.04,
    },
    subtitle: {
      fontSize: isMobile ? '14px' : '17px',
      color: 'var(--text-secondary)',
      maxWidth: '560px',
      margin: 0,
      ...TYPO.body,
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: '20px',
      maxWidth: '1280px',
      margin: '0 auto',
      padding: isMobile ? '0 16px' : '0 24px',
    },
    card: {
      ...LIQUID_GLASS_CARD,
      padding: isMobile ? '20px' : '26px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      fontFamily: 'var(--font-ui)',
    },
    issueBadge: {
      fontSize: '11px',
      color: 'var(--green)',
      ...TYPO.label,
    },
    cardTitle: {
      fontSize: '18px',
      color: 'var(--text-primary)',
      fontFamily: "'Inter', sans-serif",
      fontWeight: 600,
      letterSpacing: '-0.01em',
      margin: 0,
      lineHeight: 1.3,
    },
    cardMeta: { fontSize: '14px', color: 'var(--text-secondary)', ...TYPO.body },
    glow: {
      position: 'absolute',
      top: '10%',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '500px',
      height: '320px',
      borderRadius: '50%',
      background: 'radial-gradient(ellipse, rgba(29,185,84,0.07) 0%, transparent 70%)',
      pointerEvents: 'none',
    },
  }

  return (
    <div style={{ ...styles.page, position: 'relative', overflow: 'hidden' }} className="trybe-edit-page">
      <LiquidLensFilter />
      {!isMobile && <TileField animated={false} opacity={0.22} />}
      {!isMobile && (
        <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '220px', zIndex: 1, background: 'linear-gradient(180deg, rgba(246,245,243,0.9) 0%, rgba(246,245,243,0.5) 55%, rgba(246,245,243,0) 100%)' }} />
      )}
      <style>{`
        @media (max-width: 767px) {
          .trybe-edit-page button, .trybe-edit-page a { min-height: 44px; }
          .trybe-edit-page * { font-size: max(14px, 0.875rem); }
        }
      `}</style>

      <header style={{ ...styles.header, position: 'relative', zIndex: 2 }}>
        <h1 style={styles.title}>The Trybe Edit</h1>
        <p style={styles.subtitle}>
          Monthly insights, inspiration and updates for Australian visual creatives.
        </p>
      </header>

      <section style={{ position: 'relative', zIndex: 2 }}>
        <div style={styles.grid}>
          <article style={styles.card}>
            <span style={styles.issueBadge}>Issue {ISSUE_01.issueNumber}</span>
            <h2 style={styles.cardTitle}>{ISSUE_01.title}</h2>
            <p style={styles.cardMeta}>{ISSUE_01.monthYear}</p>
            <LiquidPill primary onClick={() => navigate('/the-trybe-edit/issue-01')} style={{ flex: '0 0 auto', width: 'fit-content', marginTop: '8px', padding: '11px 22px', fontSize: '13px' }}>
              Read Issue
            </LiquidPill>
          </article>
        </div>
      </section>
    </div>
  )
}
