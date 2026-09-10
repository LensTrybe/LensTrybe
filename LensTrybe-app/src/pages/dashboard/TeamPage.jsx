import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'

const GREEN = '#1DB954'
const GREEN_DARK = '#04120a'
const PINK = '#FF2D78'
const AMBER = '#f59e0b'

function StyleBlock() {
  return (
    <style>{`
      .ltt-page { display: flex; flex-direction: column; gap: 20px; overflow-x: hidden; }
      .ltt-input { width: 100%; box-sizing: border-box; font-family: inherit; font-size: 14px; color: var(--lt-text); background: var(--lt-input-bg); border: 1px solid var(--lt-input-border); border-radius: 9px; padding: 10px 12px; outline: none; transition: border-color .15s ease, box-shadow .15s ease; }
      .ltt-input:focus { border-color: ${GREEN}; box-shadow: 0 0 0 3px rgba(29,185,84,0.16); }
      .ltt-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: 9px; padding: 9px 16px; font-size: 13.5px; font-weight: 700; font-family: inherit; cursor: pointer; border: none; white-space: nowrap; transition: filter .15s ease, background .15s ease, opacity .15s ease; }
      .ltt-btn-primary { background: ${GREEN}; color: ${GREEN_DARK}; }
      .ltt-btn-primary:hover { filter: brightness(1.06); }
      .ltt-btn-ghost { background: var(--lt-input-bg); color: var(--lt-text); border: 1px solid var(--lt-border); }
      .ltt-btn-ghost:hover { background: var(--lt-surface-2); }
      .ltt-btn:disabled { opacity: 0.5; cursor: default; }
      .ltt-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 24px; }
      .ltt-modal { width: 100%; max-width: 440px; background: var(--lt-modal-bg); backdrop-filter: var(--lt-modal-blur); -webkit-backdrop-filter: var(--lt-modal-blur); border: var(--lt-modal-border); border-radius: 18px; box-shadow: var(--lt-modal-shadow); padding: 24px; }
      .ltt-label { font-size: 12px; font-weight: 600; color: var(--lt-faint); display: block; margin-bottom: 5px; }
      @media (max-width: 767px) { .ltt-overlay { padding: 16px; } .ltt-page button { min-height: 40px; } }
    `}</style>
  )
}

export default function TeamPage() {
  const { user } = useAuth()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const { tier } = useSubscription()
  const [members, setMembers] = useState([])
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [saving, setSaving] = useState(false)
  const [email, setEmail] = useState('')
  const isElite = tier === 'elite'
  const maxMembers = 4

  useEffect(() => { loadTeam() }, [user])
  useEffect(() => {
    function handleResize() { setIsMobile(window.innerWidth < 768) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  async function loadTeam() {
    if (!user) return
    const [mem, inv] = await Promise.all([
      supabase.from('team_members').select('*').eq('owner_id', user.id),
      supabase.from('team_invitations').select('*').eq('owner_id', user.id).eq('status', 'pending'),
    ])
    setMembers(mem.data ?? [])
    setInvitations(inv.data ?? [])
    setLoading(false)
  }

  async function sendInvite() {
    if (!email.trim()) return
    setSaving(true)
    await supabase.functions.invoke('invite-team-member', { body: { email, ownerId: user.id } })
    await loadTeam()
    setShowInvite(false)
    setEmail('')
    setSaving(false)
  }

  async function cancelInvitation(id) {
    await supabase.from('team_invitations').update({ status: 'cancelled' }).eq('id', id)
    await loadTeam()
  }

  async function removeMember(id) {
    await supabase.from('team_members').delete().eq('id', id)
    await loadTeam()
  }

  const totalSlots = maxMembers
  const usedSlots = members.length + invitations.length
  const availableSlots = totalSlots - usedSlots

  const GLASS = { background: 'var(--lt-glass-bg)', border: 'var(--lt-glass-border)', boxShadow: 'var(--lt-glass-shadow)', backdropFilter: 'var(--lt-glass-blur)', WebkitBackdropFilter: 'var(--lt-glass-blur)' }
  const card = { ...GLASS, borderRadius: 18 }

  const title = { margin: '0 0 4px', fontSize: isMobile ? 24 : 27, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--lt-text)' }
  const subtitle = { margin: 0, fontSize: 14, color: 'var(--lt-muted)' }

  const avatar = (letter, muted) => ({
    width: 40, height: 40, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700,
    background: muted ? 'var(--lt-surface-2)' : 'rgba(29,185,84,0.16)', color: muted ? 'var(--lt-muted)' : GREEN, border: `1px solid ${muted ? 'var(--lt-border)' : 'rgba(29,185,84,0.35)'}`,
  })
  const memberRow = { ...card, padding: '14px 16px', display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 14, flexDirection: isMobile ? 'column' : 'row' }
  const pill = (color, bg) => ({ padding: '4px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, color, background: bg })

  if (!isElite) {
    return (
      <>
        <StyleBlock />
        <div className="ltt-page">
          <div>
            <h1 style={title}>Team</h1>
            <p style={subtitle}>Invite team members to your studio.</p>
          </div>
          <div style={{ ...card, padding: isMobile ? 24 : 40, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--lt-text)' }}>Team management is an Elite feature</div>
            <div style={{ fontSize: 14, color: 'var(--lt-muted)', maxWidth: 420, lineHeight: 1.7 }}>
              Upgrade to Elite to add up to 4 team members, create a Studio Profile, and manage your team from one dashboard.
            </div>
            <button type="button" className="ltt-btn ltt-btn-primary" onClick={() => window.location.href = '/pricing'}>Upgrade to Elite</button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <StyleBlock />
      <div className="ltt-page">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={title}>Team</h1>
            <p style={subtitle}>Manage your studio team. Up to 4 additional members on Elite.</p>
          </div>
          {availableSlots > 0 && (
            <button type="button" className="ltt-btn ltt-btn-primary" onClick={() => setShowInvite(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Invite member
            </button>
          )}
        </div>

        {/* Slots */}
        <div style={{ ...card, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexDirection: isMobile ? 'column' : 'row' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--lt-text)' }}>{usedSlots} of {totalSlots} slots used</div>
            <div style={{ fontSize: 13, color: 'var(--lt-muted)', marginTop: 2 }}>{availableSlots} slot{availableSlots !== 1 ? 's' : ''} remaining</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {Array.from({ length: totalSlots }).map((_, i) => (
              <div key={i} style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, background: i < usedSlots ? 'rgba(29,185,84,0.16)' : 'var(--lt-surface-2)', border: `1px solid ${i < usedSlots ? 'rgba(29,185,84,0.35)' : 'var(--lt-border)'}`, color: GREEN }}>{i < usedSlots ? '✓' : ''}</div>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ ...card, padding: 32, textAlign: 'center', color: 'var(--lt-muted)', fontSize: 14 }}>Loading team…</div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--lt-text)' }}>Active members ({members.length})</div>
              {members.length === 0 ? (
                <div style={{ ...card, padding: 28, textAlign: 'center', color: 'var(--lt-muted)', fontSize: 14 }}>No active members yet. Invite your first team member.</div>
              ) : members.map(member => (
                <div key={member.id} style={memberRow}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={avatar((member.name ?? member.email ?? 'M')[0].toUpperCase(), false)}>{(member.name ?? member.email ?? 'M')[0].toUpperCase()}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--lt-text)' }}>{member.name ?? member.email}</div>
                      <div style={{ fontSize: 12, color: 'var(--lt-faint)', marginTop: 2 }}>{member.email}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={pill(GREEN, 'rgba(29,185,84,0.14)')}>Active</span>
                    <button type="button" className="ltt-btn ltt-btn-ghost" style={{ color: PINK, borderColor: 'rgba(255,45,120,0.4)', padding: '7px 14px' }} onClick={() => removeMember(member.id)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>

            {invitations.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--lt-text)' }}>Pending invitations ({invitations.length})</div>
                {invitations.map(inv => (
                  <div key={inv.id} style={memberRow}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={avatar((inv.email ?? 'M')[0].toUpperCase(), true)}>{(inv.email ?? 'M')[0].toUpperCase()}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--lt-text)' }}>{inv.email}</div>
                        <div style={{ fontSize: 12, color: 'var(--lt-faint)', marginTop: 2 }}>Invitation sent {new Date(inv.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={pill(AMBER, 'rgba(245,158,11,0.16)')}>Pending</span>
                      <button type="button" className="ltt-btn ltt-btn-ghost" style={{ padding: '7px 14px' }} onClick={() => cancelInvitation(inv.id)}>Cancel</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showInvite && (
        <div className="ltt-overlay">
          <div className="ltt-modal">
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--lt-text)', marginBottom: 16 }}>Invite team member</div>
            <label className="ltt-label">Email address</label>
            <input className="ltt-input" type="email" placeholder="teammate@example.com" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
            <div style={{ fontSize: 13, color: 'var(--lt-muted)', lineHeight: 1.6, margin: '12px 0 18px' }}>
              They&apos;ll receive an email with a link to join your team. Once accepted, their profile is linked to your studio.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="ltt-btn ltt-btn-ghost" onClick={() => { setShowInvite(false); setEmail('') }}>Cancel</button>
              <button type="button" className="ltt-btn ltt-btn-primary" disabled={saving || !email.trim()} onClick={sendInvite}>{saving ? 'Sending…' : 'Send invitation'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
