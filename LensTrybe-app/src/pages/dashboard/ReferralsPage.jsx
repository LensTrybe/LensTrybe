import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'

const GREEN = '#1DB954'
const GREEN_TEXT = '#04120a'

const STEPS = [
  { step: '1', text: 'Share your referral code or link with another creative.' },
  { step: '2', text: 'They enter your code at checkout when signing up for a paid plan.' },
  { step: '3', text: 'They receive 10% off their first payment.' },
  { step: '4', text: 'Once their first payment is confirmed, you receive 10% off your next billing cycle.' },
]

export default function ReferralsPage() {
  const { user } = useAuth()
  const [referralCode, setReferralCode] = useState('')
  const [referralCount, setReferralCount] = useState(0)
  const [copied, setCopied] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    setLoading(true)
    supabase.from('profiles').select('referral_code, referral_count').eq('id', user.id).maybeSingle().then(({ data }) => {
      if (data?.referral_code) {
        setReferralCode(data.referral_code)
        setReferralCount(data.referral_count || 0)
        setLoading(false)
      } else {
        supabase.functions.invoke('generate-referral-code', { body: { userId: user.id } }).then(({ data: fnData }) => {
          if (fnData?.referral_code) setReferralCode(fnData.referral_code)
          setLoading(false)
        }).catch(() => setLoading(false))
      }
    })
  }, [user?.id])

  function copyToClipboard(text, key) {
    try { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000) } catch { /* ignore */ }
  }

  const shareLink = `https://lenstrybe.com/join?ref=${referralCode}`

  return (
    <div className="ltref-page">
      <style>{`
        .ltref-page { display: flex; flex-direction: column; gap: 22px; max-width: 760px; width: 100%; margin: 0 auto; }
        .ltref-card { background: var(--lt-glass-bg); border: var(--lt-glass-border); box-shadow: var(--lt-glass-shadow); backdrop-filter: var(--lt-glass-blur); -webkit-backdrop-filter: var(--lt-glass-blur); border-radius: 18px; padding: 24px; }
        .ltref-h { font-size: 15px; font-weight: 800; color: var(--lt-text); }
        .ltref-btn { display: inline-flex; align-items: center; justify-content: center; padding: 12px 18px; border-radius: 12px; font-size: 13.5px; font-weight: 700; font-family: inherit; cursor: pointer; border: 1px solid var(--lt-border); background: var(--lt-surface); color: var(--lt-text); flex-shrink: 0; transition: transform .12s ease; white-space: nowrap; }
        .ltref-btn:hover { transform: translateY(-1px); }
        .ltref-field { background: var(--lt-surface); border: 1px solid var(--lt-border); border-radius: 12px; flex: 1; min-width: 0; box-sizing: border-box; }
      `}</style>

      <div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: 'var(--lt-text)', letterSpacing: '-0.01em' }}>Referrals</h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--lt-muted)', lineHeight: 1.6 }}>
          Invite other creatives to LensTrybe. They get 10% off their first payment. You get 10% off your next billing cycle for every confirmed referral.
        </p>
      </div>

      <div className="ltref-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="ltref-h">Your referral code</div>
        {loading ? (
          <div style={{ fontSize: 13, color: 'var(--lt-muted)' }}>Loading…</div>
        ) : referralCode ? (
          <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="ltref-field" style={{ fontSize: 22, fontWeight: 800, color: GREEN, letterSpacing: '0.05em', padding: '12px 20px' }}>{referralCode}</div>
              <button type="button" className="ltref-btn" onClick={() => copyToClipboard(referralCode, 'code')}>{copied === 'code' ? 'Copied!' : 'Copy code'}</button>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="ltref-field" style={{ padding: '12px 16px', fontSize: 13, color: 'var(--lt-muted)', wordBreak: 'break-all' }}>{shareLink}</div>
              <button type="button" className="ltref-btn" onClick={() => copyToClipboard(shareLink, 'link')}>{copied === 'link' ? 'Copied!' : 'Copy link'}</button>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--lt-muted)' }}>Your referral code will appear here once you are on a paid plan.</div>
        )}
      </div>

      <div className="ltref-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="ltref-h">Your referrals</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ fontSize: 52, fontWeight: 800, color: GREEN, lineHeight: 1 }}>{referralCount}</div>
          <div>
            <div style={{ fontSize: 15, color: 'var(--lt-text)', fontWeight: 700 }}>{referralCount === 1 ? 'successful referral' : 'successful referrals'}</div>
            <div style={{ fontSize: 13, color: 'var(--lt-muted)', marginTop: 4, lineHeight: 1.5 }}>Each confirmed referral earns you 10% off your next billing cycle.</div>
          </div>
        </div>
      </div>

      <div className="ltref-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="ltref-h">How it works</div>
        {STEPS.map(({ step, text }) => (
          <div key={step} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(29,185,84,0.15)', border: `1px solid ${GREEN}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: GREEN, flexShrink: 0 }}>{step}</div>
            <div style={{ fontSize: 14, color: 'var(--lt-muted)', lineHeight: 1.6, paddingTop: 4 }}>{text}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
