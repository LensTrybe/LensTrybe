import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { GLASS_CARD, GLASS_CARD_GREEN, GLASS_MODAL_PANEL, GLASS_MODAL_OVERLAY_BASE, GLASS_NATIVE_FIELD, DIVIDER_GRADIENT_STYLE, TYPO, glassCardAccentBorder } from '../../lib/glassTokens'

export default function TeamPage() {
  const { user, profile } = useAuth()
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
    function handleResize() {
      setIsMobile(window.innerWidth < 768)
    }
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
    await supabase.functions.invoke('invite-team-member', {
      body: { email, ownerId: user.id }
    })
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

  const styles = {
    page: { background: 'transparent', display: 'flex', flexDirection: 'column', gap: '32px', overflowX: 'hidden' },
    title: { ...TYPO.heading, fontFamily: 'var(--font-display)', fontSize: isMobile ? '24px' : '28px', color: 'var(--text-primary)', fontWeight: 400 },
    subtitle: { ...TYPO.body, fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px' },
    pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexDirection: isMobile ? 'column' : 'row' },
    upgradeBox: {
      ...GLASS_CARD,
      padding: isMobile ? '16px' : '32px',
      borderRadius: 'var(--radius-xl)',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px',
    },
    upgradeTitle: { fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--text-primary)', fontWeight: 400 },
    upgradeText: { fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', maxWidth: '400px', lineHeight: 1.7 },
    slotsBar: {
      ...GLASS_CARD,
      borderRadius: 'var(--radius-xl)',
      padding: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '24px',
      flexDirection: isMobile ? 'column' : 'row',
    },
    slotsInfo: { display: 'flex', flexDirection: 'column', gap: '4px' },
    slotsTitle: { fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    slotsSubtitle: { fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' },
    slotDots: { display: 'flex', gap: '8px' },
    slotDot: (filled) => ({
      width: '32px',
      height: '32px',
      borderRadius: 'var(--radius-full)',
      background: filled ? 'var(--green-dim)' : 'var(--bg-subtle)',
      border: `1px solid ${filled ? 'rgba(29,185,84,0.3)' : 'var(--border-default)'}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '14px',
    }),
    section: { display: 'flex', flexDirection: 'column', gap: '16px' },
    sectionTitle: { ...TYPO.heading, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    memberCard: {
      ...GLASS_CARD,
      borderRadius: 'var(--radius-xl)',
      padding: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'flex-start' : 'center',
    },
    memberLeft: { display: 'flex', alignItems: 'center', gap: '14px' },
    avatar: {
      width: '40px',
      height: '40px',
      borderRadius: 'var(--radius-full)',
      ...GLASS_CARD_GREEN,
      border: '1px solid rgba(29,185,84,0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '14px',
      color: 'var(--green)',
      fontWeight: 600,
      fontFamily: 'var(--font-ui)',
      flexShrink: 0,
    },
    memberName: { fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    memberEmail: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '2px' },
    emptyState: {
      ...GLASS_CARD,
      padding: '32px 24px',
      textAlign: 'center',
      color: 'var(--text-muted)',
      fontSize: '14px',
      fontFamily: 'var(--font-ui)',
      borderRadius: 'var(--radius-xl)',
    },
    modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' },
  }

  if (!isElite) {
    return (
      <div style={styles.page}>
        <div>
          <h1 style={styles.title}>Team</h1>
          <p style={styles.subtitle}>Invite team members to your studio.</p>
        </div>
        <div style={styles.upgradeBox}>
          <div style={{ fontSize: '32px' }}>👥</div>
          <div style={styles.upgradeTitle}>Team management is an Elite feature</div>
          <div style={styles.upgradeText}>
            Upgrade to Elite to add up to 4 team members, create a Studio Profile, and manage your team's performance from one dashboard.
          </div>
          <Button variant="primary" onClick={() => window.location.href = '/pricing'}>
            Upgrade to Elite
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page} className="team-page">
      <style>{`
        @media (max-width: 767px) {
          .team-page button { min-height: 44px; }
          .team-page input, .team-page textarea, .team-page select { width: 100% !important; font-size: 14px !important; }
        }
      `}</style>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Team</h1>
          <p style={styles.subtitle}>Manage your studio team. Up to 4 additional members on your Elite subscription.</p>
        </div>
        {availableSlots > 0 && (
          <Button variant="primary" onClick={() => setShowInvite(true)}>+ Invite Member</Button>
        )}
      </div>

      <div style={styles.slotsBar}>
        <div style={styles.slotsInfo}>
          <div style={styles.slotsTitle}>{usedSlots} of {totalSlots} slots used</div>
          <div style={styles.slotsSubtitle}>{availableSlots} slot{availableSlots !== 1 ? 's' : ''} remaining</div>
        </div>
        <div style={styles.slotDots}>
          {Array.from({ length: totalSlots }).map((_, i) => (
            <div key={i} style={styles.slotDot(i < usedSlots)}>
              {i < usedSlots ? '✓' : ''}
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={styles.emptyState}>Loading team…</div>
      ) : (
        <>
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Active Members ({members.length})</div>
            {members.length === 0 ? (
              <div style={styles.emptyState}>No active members yet. Invite your first team member.</div>
            ) : members.map(member => (
              <div key={member.id} style={styles.memberCard}>
                <div style={styles.memberLeft}>
                  <div style={styles.avatar}>
                    {(member.name ?? member.email ?? 'M')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={styles.memberName}>{member.name ?? member.email}</div>
                    <div style={styles.memberEmail}>{member.email}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Badge variant="green" size="sm">Active</Badge>
                  <Button variant="danger" size="sm" onClick={() => removeMember(member.id)}>Remove</Button>
                </div>
              </div>
            ))}
          </div>

          {invitations.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Pending Invitations ({invitations.length})</div>
              {invitations.map(inv => (
                <div key={inv.id} style={styles.memberCard}>
                  <div style={styles.memberLeft}>
                    <div style={{ ...styles.avatar, background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
                      {(inv.email ?? 'M')[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={styles.memberName}>{inv.email}</div>
                      <div style={styles.memberEmail}>Invitation sent {new Date(inv.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Badge variant="warning" size="sm">Pending</Badge>
                    <Button variant="ghost" size="sm" onClick={() => cancelInvitation(inv.id)}>Cancel</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Modal isOpen={showInvite} onClose={() => { setShowInvite(false); setEmail('') }} title="Invite Team Member" size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="Email address"
            type="email"
            placeholder="teammate@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', lineHeight: 1.6 }}>
            They'll receive an email with a link to join your team. Once accepted, their profile will be linked to your studio.
          </div>
          <div style={styles.modalActions}>
            <Button variant="ghost" onClick={() => { setShowInvite(false); setEmail('') }}>Cancel</Button>
            <Button variant="primary" disabled={saving || !email.trim()} onClick={sendInvite}>
              {saving ? 'Sending…' : 'Send Invitation'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
