import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PublicNavbar from '../components/public/PublicNavbar.jsx'
import useAuthUser from '../hooks/useAuthUser.js'
import { useSubscription, emitProfileUpdated } from '../hooks/useSubscription.js'
import { normalizeSubscriptionTier } from '../lib/tierFeatures.js'
import { supabase } from '../lib/supabaseClient.js'

const MODAL_OVERLAY = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(8,8,16,0.88)',
  zIndex: 200,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  boxSizing: 'border-box',
}

const MODAL_CARD = {
  background: '#111118',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 16,
  padding: 22,
  boxSizing: 'border-box',
  maxWidth: 440,
  width: '100%',
}

async function callDeleteAccountEdge(session, body = {}) {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!baseUrl) throw new Error('Missing VITE_SUPABASE_URL.')
  const response = await fetch(`${baseUrl}/functions/v1/delete-account`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...(anonKey ? { apikey: anonKey } : {}),
    },
    body: JSON.stringify(body),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const msg = result?.error || result?.message || `Request failed (${response.status})`
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  if (result?.error) {
    throw new Error(typeof result.error === 'string' ? result.error : JSON.stringify(result.error))
  }
  return result
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user } = useAuthUser()
  const { tier: subTier } = useSubscription()

  const BRAND = useMemo(
    () => ({
      bg: '#080810',
      card: '#0f0f18',
      border: '#1a1a2e',
      muted: '#888',
      text: '#fff',
      green: '#4ADE80',
      red: '#ef4444',
    }),
    [],
  )

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState(null)

  const [country, setCountry] = useState('Australia')
  const [currency, setCurrency] = useState('AUD (A$)')
  const [stateRegion, setStateRegion] = useState('')
  const [city, setCity] = useState('')
  const [phoneCode, setPhoneCode] = useState('+61 (AU)')
  const [phoneNumber, setPhoneNumber] = useState('')

  /** 'closed' | 'downgrade_offer' | 'final_confirm' */
  const [deleteModalPhase, setDeleteModalPhase] = useState('closed')
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [downgradeLoading, setDowngradeLoading] = useState(false)
  const [downgradeSuccess, setDowngradeSuccess] = useState(null)

  useEffect(() => {
    let mounted = true
    const run = async () => {
      if (!supabase || !user?.id) {
        if (mounted) setLoading(false)
        return
      }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      if (!mounted) return
      setProfile(data || null)
      setCountry(String(data?.country || 'Australia'))
      setStateRegion(String(data?.state || ''))
      setCity(String(data?.city || ''))
      setCurrency(String(data?.currency || 'AUD (A$)'))
      setPhoneCode(String(data?.phone_code || '+61 (AU)'))
      setPhoneNumber(String(data?.phone_number || ''))
      setLoading(false)
    }
    run()
    return () => {
      mounted = false
    }
  }, [user?.id])

  const page = {
    background: BRAND.bg,
    minHeight: '100vh',
    color: BRAND.text,
    fontFamily: 'Inter, sans-serif',
  }

  const wrap = {
    padding: '96px 24px 80px',
    boxSizing: 'border-box',
  }

  const inner = {
    maxWidth: 560,
    margin: '0 auto',
    width: '100%',
  }

  const card = {
    background: BRAND.card,
    border: `1px solid rgba(255,255,255,0.10)`,
    borderRadius: 16,
    padding: 18,
    boxSizing: 'border-box',
  }

  const input = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 10,
    padding: '10px 12px',
    color: '#fff',
    fontSize: 13,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'Inter, sans-serif',
    height: 40,
  }

  const label = {
    color: '#9aa0aa',
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 8,
  }

  const planRow = (tierName, price, actionLabel) => {
    const current = normalizeSubscriptionTier(tierName) === subTier
    return (
      <div
        style={{
          background: current ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.03)',
          border: current ? `1px solid rgba(74,222,128,0.25)` : '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          padding: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{tierName}</div>
            {current ? (
              <span
                style={{
                  background: 'rgba(74,222,128,0.15)',
                  border: `1px solid ${BRAND.green}`,
                  color: BRAND.green,
                  borderRadius: 999,
                  padding: '3px 10px',
                  fontSize: 11,
                  fontWeight: 900,
                }}
              >
                Current plan
              </span>
            ) : null}
          </div>
          <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 4 }}>{price}</div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/pricing')}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: '#eaeaea',
            borderRadius: 10,
            padding: '10px 12px',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            height: 36,
          }}
        >
          {actionLabel}
        </button>
      </div>
    )
  }

  const handleSave = async () => {
    if (!supabase || !user?.id) return
    setSaving(true)
    try {
      const payload = {
        country,
        state: stateRegion,
        city,
        currency,
        phone_code: phoneCode,
        phone_number: phoneNumber,
      }
      const { error } = await supabase.from('profiles').update(payload).eq('id', user.id)
      if (error) throw error
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      setProfile(data || null)
      emitProfileUpdated()
    } catch (e) {
      alert(e?.message || 'Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut()
    navigate('/')
  }

  const closeDeleteModal = () => {
    if (deletingAccount || downgradeLoading) return
    setDeleteModalPhase('closed')
    setDeleteConfirmInput('')
    setDeleteError(null)
  }

  const openDeleteFlow = () => {
    setDeleteError(null)
    setDeleteConfirmInput('')
    setDeleteModalPhase('downgrade_offer')
  }

  const pickDeletionDateFromResult = (result) =>
    result?.deletion_date ||
    result?.deletionDate ||
    result?.deletion_scheduled_at ||
    result?.scheduled_deletion_at ||
    null

  const handleDowngradeToBasic = async () => {
    if (!supabase || !user?.id) {
      setDeleteError('Supabase is not configured.')
      return
    }
    setDowngradeLoading(true)
    setDeleteError(null)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setDeleteError('Not signed in.')
        setDowngradeLoading(false)
        return
      }
      const { error: upErr } = await supabase.from('profiles').update({ subscription_tier: 'basic' }).eq('id', user.id)
      if (upErr) throw upErr
      try {
        await callDeleteAccountEdge(session, { cancel_subscription_only: true })
      } catch {
        /* Profile downgraded; Stripe cancel may fail if no subscription — still show success for tier change */
      }
      const { data: refreshed } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      setProfile(refreshed || null)
      emitProfileUpdated()
      setDowngradeSuccess("You've been moved to the Basic plan. Your profile is still live.")
      setDeleteModalPhase('closed')
    } catch (e) {
      setDeleteError(e?.message || 'Could not downgrade.')
    } finally {
      setDowngradeLoading(false)
    }
  }

  const handleConfirmDeleteAccount = async () => {
    if (deleteConfirmInput.trim() !== 'DELETE') {
      setDeleteError('Type DELETE to confirm.')
      return
    }
    if (!supabase) {
      setDeleteError('Supabase is not configured.')
      return
    }
    setDeletingAccount(true)
    setDeleteError(null)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setDeleteError('Not signed in.')
        setDeletingAccount(false)
        return
      }
      const result = await callDeleteAccountEdge(session, {})
      const deletionDate =
        pickDeletionDateFromResult(result) ||
        (() => {
          const d = new Date()
          d.setDate(d.getDate() + 30)
          return d.toISOString()
        })()
      try {
        localStorage.removeItem('deletion_notice_shown')
      } catch {
        /* ignore */
      }
      try {
        localStorage.setItem('lt_deletion_notice_date', deletionDate)
      } catch {
        /* ignore */
      }
      await supabase.auth.signOut()
      const q = `deletion_date=${encodeURIComponent(deletionDate)}`
      navigate(`/?${q}`, { replace: true })
    } catch (e) {
      setDeleteError(e?.message || 'Something went wrong.')
      setDeletingAccount(false)
    }
  }

  if (loading) {
    return (
      <div style={page}>
        <PublicNavbar />
        <div style={wrap}>
          <div style={inner}>
            <div style={{ color: BRAND.muted, fontSize: 13, paddingTop: 24 }}>Loading settings…</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={page}>
      <PublicNavbar />
      <div style={wrap}>
        <div style={inner}>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              color: BRAND.green,
              textDecoration: 'none',
              fontSize: 12,
              fontWeight: 800,
              marginBottom: 14,
            }}
          >
            ← Back
          </Link>

          <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>Settings</div>
          <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 6, marginBottom: 18 }}>Manage your account and preferences.</div>

          {downgradeSuccess ? (
            <div
              style={{
                ...card,
                marginBottom: 14,
                border: `1px solid rgba(74,222,128,0.35)`,
                background: 'rgba(74,222,128,0.08)',
                color: BRAND.green,
                fontSize: 13,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <span>{downgradeSuccess}</span>
              <button
                type="button"
                onClick={() => setDowngradeSuccess(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: BRAND.green,
                  cursor: 'pointer',
                  fontWeight: 900,
                  fontSize: 12,
                  flexShrink: 0,
                }}
              >
                Dismiss
              </button>
            </div>
          ) : null}

          <div style={{ ...card, padding: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  color: '#fff',
                }}
                aria-hidden
              >
                {(profile?.business_name || user?.email || 'U').slice(0, 1).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {profile?.business_name || user?.email || 'Account'}
                </div>
                <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 2 }}>{user?.email}</div>
              </div>
            </div>
          </div>

          <div style={{ ...card, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ color: BRAND.green, fontWeight: 900, fontSize: 14 }}></div>
              <div style={{ color: '#fff', fontWeight: 900, fontSize: 13 }}>Region &amp; Currency</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={label}>Country</div>
                <select value={country} onChange={(e) => setCountry(e.target.value)} style={{ ...input, cursor: 'pointer' }}>
                  <option>Australia</option>
                  <option>New Zealand</option>
                  <option>United States</option>
                  <option>United Kingdom</option>
                </select>
              </div>
              <div>
                <div style={label}>Currency</div>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ ...input, cursor: 'pointer' }}>
                  <option>AUD (A$)</option>
                  <option>NZD (NZ$)</option>
                  <option>USD ($)</option>
                  <option>GBP (£)</option>
                </select>
              </div>
              <div>
                <div style={label}>State / Region</div>
                <input value={stateRegion} onChange={(e) => setStateRegion(e.target.value)} style={input} placeholder="Queensland" />
              </div>
              <div>
                <div style={label}>City</div>
                <input value={city} onChange={(e) => setCity(e.target.value)} style={input} placeholder="Brisbane" />
              </div>
              <div>
                <div style={label}>Phone Code</div>
                <input value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)} style={input} placeholder="+61 (AU)" />
              </div>
              <div>
                <div style={label}>Phone Number</div>
                <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} style={input} placeholder="Phone number" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{
                  flex: 1,
                  height: 40,
                  background: BRAND.green,
                  border: 'none',
                  borderRadius: 10,
                  color: '#000',
                  fontWeight: 900,
                  fontSize: 13,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Saving…' : 'Save Settings'}
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                style={{
                  width: 120,
                  height: 40,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  color: '#eaeaea',
                  fontWeight: 900,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Sign Out
              </button>
            </div>
          </div>

          <div style={{ ...card, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ color: BRAND.green, fontWeight: 900, fontSize: 14 }}></div>
              <div style={{ color: '#fff', fontWeight: 900, fontSize: 13 }}>Change Plan</div>
            </div>
            <div style={{ color: BRAND.muted, fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>
              Upgrades take effect immediately (you&apos;ll be charged the prorated difference). Downgrades start at the end of your current billing period.
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {planRow('Pro', 'A$24.99/mo', 'Downgrade')}
              {planRow('Expert', 'A$74.99/mo', 'Downgrade')}
              {planRow('Elite', 'A$149.99/mo', 'Downgrade')}
            </div>
          </div>

          <div style={{ ...card, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.05)' }}>
            <div style={{ color: '#ffb4b4', fontSize: 12, fontWeight: 900, marginBottom: 10 }}>Danger Zone</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 900, marginBottom: 4 }}>Delete My Account</div>
                <div style={{ color: '#caa', fontSize: 12 }}>
                  Permanently delete your account and all associated data.
                </div>
              </div>
              <button
                type="button"
                onClick={openDeleteFlow}
                style={{
                  background: BRAND.red,
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 14px',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: 12,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {deleteModalPhase === 'downgrade_offer' ? (
        <div
          role="presentation"
          style={MODAL_OVERLAY}
          onClick={closeDeleteModal}
          onKeyDown={(e) => e.key === 'Escape' && closeDeleteModal()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="before-you-go-title"
            style={{ ...MODAL_CARD, fontFamily: 'Inter, sans-serif' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div id="before-you-go-title" style={{ color: '#fff', fontSize: 17, fontWeight: 900, marginBottom: 12 }}>
              Before you go...
            </div>
            <div style={{ color: BRAND.muted, fontSize: 13, lineHeight: 1.55, marginBottom: 20 }}>
              Would you like to keep your profile on LensTrybe for free instead of deleting your account? You will lose your
              paid features but keep your profile, portfolio and reviews.
            </div>
            {deleteError ? (
              <div style={{ color: BRAND.red, fontSize: 12, fontWeight: 700, marginBottom: 12 }}>{deleteError}</div>
            ) : null}
            <div style={{ display: 'grid', gap: 10 }}>
              <button
                type="button"
                onClick={handleDowngradeToBasic}
                disabled={downgradeLoading}
                style={{
                  width: '100%',
                  background: '#4ADE80',
                  border: 'none',
                  borderRadius: 10,
                  padding: '12px 16px',
                  color: '#000',
                  fontWeight: 900,
                  fontSize: 13,
                  cursor: downgradeLoading ? 'not-allowed' : 'pointer',
                  opacity: downgradeLoading ? 0.75 : 1,
                }}
              >
                {downgradeLoading ? 'Working…' : 'Downgrade to Basic — keep my account'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null)
                  setDeleteModalPhase('final_confirm')
                }}
                disabled={downgradeLoading}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: 10,
                  padding: '12px 16px',
                  color: BRAND.muted,
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: downgradeLoading ? 'not-allowed' : 'pointer',
                }}
              >
                No thanks, delete my account
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteModalPhase === 'final_confirm' ? (
        <div
          role="presentation"
          style={MODAL_OVERLAY}
          onClick={closeDeleteModal}
          onKeyDown={(e) => e.key === 'Escape' && closeDeleteModal()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="final-delete-title"
            style={{ ...MODAL_CARD, border: '1px solid rgba(239,68,68,0.35)', fontFamily: 'Inter, sans-serif' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div id="final-delete-title" style={{ color: '#fff', fontSize: 17, fontWeight: 900, marginBottom: 12 }}>
              Delete your account
            </div>
            <div style={{ color: BRAND.muted, fontSize: 13, lineHeight: 1.55, marginBottom: 16 }}>
              This cannot be undone. Type DELETE below to confirm.
            </div>
            <input
              value={deleteConfirmInput}
              onChange={(e) => {
                setDeleteConfirmInput(e.target.value)
                if (deleteError) setDeleteError(null)
              }}
              placeholder="DELETE"
              disabled={deletingAccount}
              autoComplete="off"
              style={{ ...input, marginBottom: 10 }}
            />
            {deleteError ? (
              <div style={{ color: BRAND.red, fontSize: 12, fontWeight: 700, marginBottom: 12 }}>{deleteError}</div>
            ) : null}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setDeleteModalPhase('downgrade_offer')
                  setDeleteConfirmInput('')
                  setDeleteError(null)
                }}
                disabled={deletingAccount}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: 10,
                  padding: '10px 16px',
                  color: BRAND.muted,
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: deletingAccount ? 'not-allowed' : 'pointer',
                }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAccount}
                disabled={deletingAccount || deleteConfirmInput.trim() !== 'DELETE'}
                style={{
                  background: BRAND.red,
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 16px',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: 12,
                  cursor: deletingAccount || deleteConfirmInput.trim() !== 'DELETE' ? 'not-allowed' : 'pointer',
                  opacity: deletingAccount || deleteConfirmInput.trim() !== 'DELETE' ? 0.5 : 1,
                }}
              >
                {deletingAccount ? 'Working…' : 'Permanently Delete Account'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

