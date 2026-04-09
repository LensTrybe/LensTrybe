import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const PAGE = {
  bg: '#0a0a0f',
  text: 'rgb(242, 242, 242)',
  card: '#13131a',
  border: '#1e1e1e',
  inner: '#1a1a24',
  innerBorder: '#202027',
  muted: '#888',
  dim: '#555',
  green: '#39ff14',
  red: '#f87171',
}

const font = { fontFamily: 'Inter, sans-serif' }

export default function TeamAcceptPage() {
  const navigate = useNavigate()
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [row, setRow] = useState(null)
  const [error, setError] = useState('')
  const [accepting, setAccepting] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!token) {
        setError('Missing invite token.')
        setLoading(false)
        return
      }
      setLoading(true)
      setError('')
      const { data, error: e } = await supabase
        .from('team_members')
        .select('*')
        .eq('invite_token', token)
        .maybeSingle()
      if (!cancelled) {
        if (e) setError(e.message)
        setRow(data || null)
        setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [token])

  const acceptInvite = async () => {
    if (!row?.id) return
    if (!user?.id) {
      setError('Please sign in to accept this invite.')
      return
    }
    setAccepting(true)
    setError('')
    try {
      const { error: e } = await supabase
        .from('team_members')
        .update({ invite_status: 'accepted', invited_user_id: user.id, status: 'active' })
        .eq('id', row.id)
        .eq('invite_token', token)
      if (e) throw e
      navigate('/dashboard/business/team')
    } catch (e) {
      setError(e?.message || 'Could not accept invite.')
    } finally {
      setAccepting(false)
    }
  }

  return (
    <section style={{ background: PAGE.bg, minHeight: '100vh', padding: 32, color: PAGE.text, ...font, boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', color: PAGE.green, fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: 13, ...font }}
        >
          ← Back
        </button>

        <div style={{ marginTop: 16, background: PAGE.card, border: `1px solid ${PAGE.border}`, borderRadius: 12, padding: 24 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff' }}>Team Invitation</h1>
          <p style={{ margin: '10px 0 0', color: PAGE.muted, fontSize: 13 }}>
            Accept the invite to join the team.
          </p>

          <div style={{ height: 1, background: PAGE.border, margin: '18px 0' }} />

          {loading ? (
            <div style={{ color: PAGE.muted, fontSize: 14 }}>Loading invite…</div>
          ) : error ? (
            <div style={{ color: PAGE.red, fontWeight: 700, fontSize: 13 }} role="alert">
              {error}
            </div>
          ) : !row ? (
            <div style={{ color: PAGE.muted, fontSize: 14 }}>Invite not found or expired.</div>
          ) : (
            <>
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ background: PAGE.inner, border: `1px solid ${PAGE.innerBorder}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ color: PAGE.dim, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Invited as
                  </div>
                  <div style={{ color: '#fff', fontWeight: 800, marginTop: 6 }}>{row.role || 'Member'}</div>
                  <div style={{ color: PAGE.muted, fontSize: 13, marginTop: 6 }}>{row.email || '—'}</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  style={{
                    background: 'none',
                    border: `1px solid ${PAGE.innerBorder}`,
                    color: PAGE.muted,
                    borderRadius: 8,
                    padding: '9px 18px',
                    cursor: 'pointer',
                    fontSize: 14,
                    ...font,
                  }}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={acceptInvite}
                  disabled={accepting}
                  style={{
                    background: PAGE.green,
                    border: 'none',
                    color: '#000',
                    fontWeight: 800,
                    borderRadius: 8,
                    padding: '9px 20px',
                    cursor: accepting ? 'not-allowed' : 'pointer',
                    opacity: accepting ? 0.7 : 1,
                    fontSize: 14,
                    ...font,
                  }}
                >
                  {accepting ? 'Accepting…' : 'Accept Invite'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

