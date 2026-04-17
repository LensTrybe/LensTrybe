import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function DeliverDownloadPage() {
  const { token } = useParams()
  const [delivery, setDelivery] = useState(null)
  const [creative, setCreative] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => { fetchDelivery() }, [token])

  async function fetchDelivery() {
    const { data, error } = await supabase
      .from('deliveries')
      .select('*')
      .eq('download_token', token)
      .single()
    if (error || !data) { setNotFound(true); setLoading(false); return }
    setDelivery(data)
    if (!data.password) setUnlocked(true)
    if (data.creative_id) {
      const { data: prof } = await supabase.from('profiles').select('business_name, avatar_url').eq('id', data.creative_id).single()
      setCreative(prof)
    }
    setLoading(false)
  }

  function checkPassword() {
    if (password === delivery.password) {
      setUnlocked(true)
      setPasswordError(false)
    } else {
      setPasswordError(true)
    }
  }

  const accent = '#39ff14'

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '32px', height: '32px', border: `2px solid ${accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔗</div>
        <div style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>Gallery not found</div>
        <div style={{ fontSize: '14px', color: '#666' }}>This link may have expired or been removed.</div>
      </div>
    </div>
  )

  if (delivery?.password && !unlocked) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', padding: '24px' }}>
      <div style={{ background: '#13131f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        {creative?.avatar_url && <img src={creative.avatar_url} alt="" style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', margin: '0 auto 16px' }} />}
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>{creative?.business_name ?? 'Your Gallery'}</div>
        <div style={{ fontSize: '14px', color: '#666', marginBottom: '32px' }}>This gallery is password protected</div>
        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && checkPassword()}
          style={{ width: '100%', padding: '12px 16px', background: '#0a0a0f', border: `1px solid ${passwordError ? '#ef4444' : 'rgba(255,255,255,0.1)'}`, borderRadius: '8px', color: '#fff', fontSize: '15px', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', outline: 'none', marginBottom: '8px' }}
        />
        {passwordError && <div style={{ fontSize: '13px', color: '#ef4444', marginBottom: '12px' }}>Incorrect password</div>}
        <button type="button" onClick={checkPassword} style={{ width: '100%', padding: '12px', background: accent, border: 'none', borderRadius: '8px', color: '#000', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif', marginTop: '8px' }}>
          Unlock Gallery
        </button>
      </div>
    </div>
  )

  const files = delivery?.files ?? []
  const photos = files.filter(f => f.type?.startsWith('image') || f.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i))
  const videos = files.filter(f => f.type?.startsWith('video') || f.url?.match(/\.(mp4|mov|avi|webm)$/i))
  const others = files.filter(f => !photos.includes(f) && !videos.includes(f))

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#13131f', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '20px 32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        {creative?.avatar_url && <img src={creative.avatar_url} alt="" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }} />}
        <div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{creative?.business_name ?? 'Your Gallery'}</div>
          <div style={{ fontSize: '12px', color: '#555' }}>via LensTrybe</div>
        </div>
        <div style={{ marginLeft: 'auto', padding: '6px 14px', background: `${accent}22`, border: `1px solid ${accent}44`, borderRadius: '999px', fontSize: '12px', fontWeight: 700, color: accent }}>
          FILES READY
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>{delivery.title ?? 'Your Files'}</h1>
        <div style={{ fontSize: '14px', color: '#555', marginBottom: '8px' }}>{files.length} file{files.length !== 1 ? 's' : ''} · for {delivery.client_name}</div>
        {delivery.expires_at && <div style={{ fontSize: '13px', color: '#444', marginBottom: '24px' }}>Link expires {new Date(delivery.expires_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>}
        {delivery.message && (
          <div style={{ background: '#13131f', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px 20px', marginBottom: '32px' }}>
            <div style={{ fontSize: '14px', color: '#aaa', lineHeight: 1.6 }}>{delivery.message}</div>
          </div>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <div style={{ marginBottom: '40px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>Photos ({photos.length})</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
              {photos.map((f, i) => (
                <div key={i} style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', background: '#13131f', aspectRatio: '4/3' }}>
                  <img src={f.url} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <a href={f.url} download={f.name} target="_blank" rel="noreferrer" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'all 0.15s', textDecoration: 'none' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.6)'; e.currentTarget.style.opacity = '1' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0)'; e.currentTarget.style.opacity = '0' }}
                  >
                    <span style={{ background: accent, color: '#000', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>Download</span>
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Videos */}
        {videos.length > 0 && (
          <div style={{ marginBottom: '40px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>Videos ({videos.length})</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
              {videos.map((f, i) => (
                <div key={i} style={{ borderRadius: '10px', overflow: 'hidden', background: '#13131f' }}>
                  <video src={f.url} controls style={{ width: '100%', display: 'block' }} />
                  <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                    <a href={f.url} download={f.name} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: accent, fontWeight: 600, textDecoration: 'none', flexShrink: 0, marginLeft: '8px' }}>Download</a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Other files */}
        {others.length > 0 && (
          <div style={{ marginBottom: '40px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>Files ({others.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {others.map((f, i) => (
                <div key={i} style={{ background: '#13131f', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', color: '#ccc' }}>{f.name}</span>
                  <a href={f.url} download={f.name} target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: accent, fontWeight: 600, textDecoration: 'none' }}>Download</a>
                </div>
              ))}
            </div>
          </div>
        )}

        {files.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px', color: '#444', fontSize: '14px' }}>No files in this delivery yet.</div>
        )}

        <div style={{ textAlign: 'center', marginTop: '48px', fontSize: '12px', color: '#333' }}>
          Delivered via <span style={{ color: accent, fontWeight: 700 }}>LensTrybe</span>
        </div>
      </div>
    </div>
  )
}
