import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { GLASS_CARD } from '../../lib/glassTokens'
import Button from '../../components/ui/Button'

export default function ReferralsPage() {
  const { user } = useAuth()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const [referralCode, setReferralCode] = useState('')
  const [referralCount, setReferralCount] = useState(0)
  const [copied, setCopied] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    function handleResize() { setIsMobile(window.innerWidth < 768) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const shareLink = `https://app.lenstrybe.com/join?ref=${referralCode}`

  return (
    <div style={{ padding: isMobile ? '20px 16px' : '32px 40px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', width: '100%', boxSizing: 'border-box' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? '24px' : '28px', color: 'var(--text-primary)', fontWeight: 400, margin: '0 0 8px' }}>Referrals</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', margin: 0, lineHeight: 1.6 }}>
          Invite other creatives to LensTrybe. They get 10% off their first payment. You get 10% off your next billing cycle for every confirmed referral.
        </p>
      </div>

      <div style={{ ...GLASS_CARD, borderRadius: 'var(--radius-xl)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>Your Referral Code</div>
        {loading ? (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Loading...</div>
        ) : referralCode ? (
          <>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: isMobile ? '18px' : '22px', fontWeight: 700, color: 'var(--green)', letterSpacing: '0.05em', padding: '12px 20px', ...GLASS_CARD, borderRadius: 'var(--radius-lg)', flex: 1, minWidth: 0 }}>
                {referralCode}
              </div>
              <Button variant="secondary" style={{ flexShrink: 0, minHeight: '44px' }} onClick={() => copyToClipboard(referralCode, 'code')}>
                {copied === 'code' ? 'Copied!' : 'Copy Code'}
              </Button>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ ...GLASS_CARD, borderRadius: 'var(--radius-lg)', padding: '12px 20px', flex: 1, minWidth: 0, fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', wordBreak: 'break-all' }}>
                {shareLink}
              </div>
              <Button variant="secondary" style={{ flexShrink: 0, minHeight: '44px' }} onClick={() => copyToClipboard(shareLink, 'link')}>
                {copied === 'link' ? 'Copied!' : 'Copy Link'}
              </Button>
            </div>
          </>
        ) : (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
            Your referral code will appear here once you are on a paid plan.
          </div>
        )}
      </div>

      <div style={{ ...GLASS_CARD, borderRadius: 'var(--radius-xl)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>Your Referrals</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ fontSize: isMobile ? '40px' : '56px', fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--font-ui)', lineHeight: 1 }}>{referralCount}</div>
          <div>
            <div style={{ fontSize: '15px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', fontWeight: 500 }}>
              {referralCount === 1 ? 'successful referral' : 'successful referrals'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px', lineHeight: 1.5 }}>
              Each confirmed referral earns you 10% off your next billing cycle.
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...GLASS_CARD, borderRadius: 'var(--radius-xl)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>How it works</div>
        {[
          { step: '1', text: 'Share your referral code or link with another creative.' },
          { step: '2', text: 'They enter your code at checkout when signing up for a paid plan.' },
          { step: '3', text: 'They receive 10% off their first payment.' },
          { step: '4', text: 'Once their first payment is confirmed, you receive 10% off your next billing cycle.' },
        ].map(({ step, text }) => (
          <div key={step} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(29,185,84,0.15)', border: '1px solid rgba(29,185,84,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--green)', flexShrink: 0, fontFamily: 'var(--font-ui)' }}>{step}</div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.6, paddingTop: '4px' }}>{text}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
