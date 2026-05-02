import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PublicNavbar from '../components/public/PublicNavbar.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { fetchPublicPortfolioItems } from '../lib/publicPortfolioItems.js'

function isVideoUrl(url) {
  if (!url || typeof url !== 'string') return false
  return /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(url.trim())
}

export default function PortfolioPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const BRAND = useMemo(
    () => ({
      bg: '#080810',
      pink: '#D946EF',
      green: '#4ADE80',
      text: '#ffffff',
      card: '#0f0f18',
      border: '#1a1a2e',
      muted: '#888',
    }),
    [],
  )

  const [profile, setProfile] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [portfolioError, setPortfolioError] = useState('')
  const [lightbox, setLightbox] = useState({ open: false, src: '', isVideo: false })

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!supabase) {
        setError('Supabase is not configured.')
        setLoading(false)
        return
      }
      if (!id) {
        setError('Missing profile.')
        setLoading(false)
        return
      }
      setLoading(true)
      setError('')
      setPortfolioError('')

      const { data: p, error: pErr } = await supabase.from('profiles').select('*').eq('id', id).eq('is_admin', false).maybeSingle()
      const {
        data: port,
        error: portErr,
        rpcAttemptError,
      } = await fetchPublicPortfolioItems(supabase, id)

      if (cancelled) return
      if (pErr) {
        setError(pErr.message)
        setProfile(null)
      } else if (!p) {
        setError('Profile not found.')
        setProfile(null)
      } else {
        setError('')
        setProfile(p)
      }
      if (portErr) {
        const hint = rpcAttemptError ? ` (${rpcAttemptError})` : ''
        setPortfolioError(`${portErr.message || 'Could not load portfolio'}${hint}`)
        setItems([])
      } else {
        setPortfolioError('')
        setItems(Array.isArray(port) ? port : [])
      }
      setLoading(false)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [id])

  const maxWrap = { maxWidth: 1100, margin: '0 auto', width: '100%' }
  const shell = { background: BRAND.bg, minHeight: '100vh', color: BRAND.text, fontFamily: 'Inter, sans-serif' }

  if (loading) {
    return (
      <div style={shell}>
        <PublicNavbar />
        <div style={{ ...maxWrap, padding: '100px 24px 40px', boxSizing: 'border-box' }}>
          <div style={{ color: BRAND.muted }}>Loading portfolio…</div>
        </div>
      </div>
    )
  }

  if (error && !profile) {
    return (
      <div style={shell}>
        <PublicNavbar />
        <div style={{ ...maxWrap, padding: '100px 24px 40px', boxSizing: 'border-box' }}>
          <div style={{ color: '#f87171', fontWeight: 800 }}>{error || 'Profile not found.'}</div>
          <Link to="/explore" style={{ display: 'inline-block', marginTop: 16, color: BRAND.pink, fontWeight: 700 }}>
            ← Back to explore
          </Link>
        </div>
      </div>
    )
  }

  const businessName = profile?.business_name || 'Creative'

  return (
    <div style={shell}>
      <PublicNavbar />

      <div style={{ ...maxWrap, padding: '88px 24px 48px', boxSizing: 'border-box' }}>
        <button
          type="button"
          onClick={() => navigate(`/profile/${id}`)}
          style={{
            background: 'none',
            border: 'none',
            color: BRAND.muted,
            fontSize: 13,
            cursor: 'pointer',
            marginBottom: 20,
            padding: 0,
            fontWeight: 600,
          }}
        >
          ← Back to profile
        </button>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', color: '#fff' }}>Portfolio</h1>
            <p style={{ margin: '10px 0 0', color: BRAND.muted, fontSize: 15 }}>{businessName}</p>
          </div>
        </div>

        {!items.filter((it) => it?.image_url || it?.media_url || it?.url).length ? (
          <div
            style={{
              background: BRAND.card,
              border: `1px solid ${BRAND.border}`,
              borderRadius: 12,
              padding: 40,
              textAlign: 'center',
              color: BRAND.muted,
              fontSize: 15,
            }}
          >
            {portfolioError ? (
              <>
                <div style={{ color: '#f87171', fontWeight: 800, marginBottom: 12 }}>Could not load portfolio</div>
                <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>{portfolioError}</div>
                <div style={{ fontSize: 12, lineHeight: 1.55, color: BRAND.muted }}>
                  In Supabase, apply migrations for <code style={{ color: '#ccc' }}>get_public_portfolio_items</code> and{' '}
                  <code style={{ color: '#ccc' }}>portfolio_items</code> public read, and ensure the{' '}
                  <code style={{ color: '#ccc' }}>portfolio</code> storage bucket allows public access for images.
                </div>
              </>
            ) : (
              'No portfolio pieces yet.'
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: 12 }}>
            {items.filter((it) => it?.image_url || it?.media_url || it?.url).map((it) => {
              const src = it?.image_url || it?.media_url || it?.url
              const video = isVideoUrl(src)
              const biz = String(businessName || 'Creative').trim() || 'Creative'
              const altFromSeo = String(it?.alt_text || it?.headline || '').trim()
              const imgAlt = altFromSeo || `${biz} portfolio`
              const headlineTrim = String(it?.headline || '').trim()

              return (
                <div
                  key={it.id}
                  style={{
                    borderRadius: 10,
                    overflow: 'hidden',
                    border: `1px solid ${BRAND.border}`,
                    background: BRAND.card,
                  }}
                >
                  {video ? (
                    <div style={{ position: 'relative', aspectRatio: '1 / 1', background: '#111' }}>
                      <video
                        src={src}
                        muted
                        playsInline
                        controls
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setLightbox({ open: true, src, isVideo: false })}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: 0,
                        border: 'none',
                        cursor: 'pointer',
                        lineHeight: 0,
                      }}
                    >
                      <img
                        src={src}
                        alt={imgAlt}
                        title={headlineTrim || undefined}
                        style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }}
                      />
                    </button>
                  )}
                  {(it.headline || it.title) && (
                    <div style={{ padding: '10px 12px', fontSize: 13, color: '#ccc', fontWeight: 600 }}>
                      {it.headline || it.title}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {lightbox.open && lightbox.src && !lightbox.isVideo ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background: 'rgba(0,0,0,0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            boxSizing: 'border-box',
          }}
          onClick={() => setLightbox({ open: false, src: '', isVideo: false })}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setLightbox({ open: false, src: '', isVideo: false })}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              borderRadius: 8,
              padding: '8px 14px',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Close
          </button>
          <img
            src={lightbox.src}
            alt=""
            style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  )
}
