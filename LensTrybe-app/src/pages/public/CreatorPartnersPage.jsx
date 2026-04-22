import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'LinkedIn', 'Podcast', 'Blog / Website', 'Other']
const FOLLOWING_SIZES = ['Under 1,000', '1,000 - 5,000', '5,000 - 10,000', '10,000 - 50,000', '50,000 - 100,000', '100,000+']

export default function CreatorPartnersPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', platform: '', handle: '', following_size: '', why: '' })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.platform || !form.handle || !form.following_size || !form.why) {
      setError('Please fill in all fields.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('https://lqafxisymvrazipaozfk.supabase.co/functions/v1/creator-partner-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed')
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again or email connect@lenstrybe.com.')
    } finally {
      setLoading(false)
    }
  }

  const s = {
    page: { background: '#0a0a0f', minHeight: '100vh', color: '#fff', fontFamily: 'Inter, sans-serif' },
    hero: { textAlign: 'center', padding: '80px 24px 64px', maxWidth: 760, margin: '0 auto' },
    eyebrow: { fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', color: '#1DB954', fontWeight: 600, marginBottom: 20 },
    h1: { fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 700, lineHeight: 1.1, margin: '0 0 24px', fontFamily: 'Georgia, serif' },
    pink: { color: '#FF2D78' },
    green: { color: '#1DB954' },
    subtitle: { fontSize: 17, color: '#8b8a9a', lineHeight: 1.7, maxWidth: 580, margin: '0 auto 40px' },
    ctaBtn: { background: '#1DB954', color: '#000', border: 'none', borderRadius: 100, padding: '14px 32px', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
    section: { maxWidth: 900, margin: '0 auto', padding: '0 24px 80px' },
    sectionTitle: { fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 700, fontFamily: 'Georgia, serif', color: '#FF2D78', marginBottom: 12, textAlign: 'center' },
    sectionSubtitle: { fontSize: 15, color: '#8b8a9a', textAlign: 'center', marginBottom: 48, lineHeight: 1.6 },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 },
    card: { background: '#12111a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 28 },
    cardIcon: { fontSize: 28, marginBottom: 14 },
    cardTitle: { fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 8 },
    cardDesc: { fontSize: 14, color: '#8b8a9a', lineHeight: 1.6 },
    divider: { height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 24px 80px' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
    th: { textAlign: 'left', padding: '12px 16px', color: '#8b8a9a', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
    td: { padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#fff' },
    highlight: { color: '#1DB954', fontWeight: 700 },
    formWrap: { maxWidth: 620, margin: '0 auto', background: '#12111a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '48px 40px' },
    label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#8b8a9a', marginBottom: 8, letterSpacing: 0.3 },
    input: { width: '100%', background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '13px 16px', color: '#fff', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' },
    select: { width: '100%', background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '13px 16px', color: '#fff', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box', appearance: 'none' },
    textarea: { width: '100%', background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '13px 16px', color: '#fff', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box', resize: 'vertical', minHeight: 120 },
    fieldWrap: { marginBottom: 20 },
    submitBtn: { width: '100%', background: '#1DB954', color: '#000', border: 'none', borderRadius: 100, padding: '16px', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'Inter, sans-serif', marginTop: 8 },
    errorMsg: { color: '#FF2D78', fontSize: 13, marginBottom: 16 },
    successWrap: { textAlign: 'center', padding: '48px 24px' },
    successIcon: { fontSize: 48, marginBottom: 16 },
    successTitle: { fontSize: 28, fontWeight: 700, color: '#1DB954', fontFamily: 'Georgia, serif', marginBottom: 12 },
    successText: { fontSize: 15, color: '#8b8a9a', lineHeight: 1.7 },
  }

  return (
    <div style={s.page}>

      {/* Hero */}
      <div style={s.hero}>
        <p style={s.eyebrow}>Founding Creator Partner Program</p>
        <h1 style={s.h1}>
          Build your business.<br />
          <span style={s.pink}>Shape</span> a platform.<br />
          <span style={s.green}>Get paid</span> to grow.
        </h1>
        <p style={s.subtitle}>
          We are inviting a small group of Australian visual creatives to join LensTrybe as Founding Creator Partners before our full public launch on July 1st. 12 months Elite tier free, a personal coupon code, and commission on every signup you drive.
        </p>
        <button style={s.ctaBtn} onClick={() => document.getElementById('apply').scrollIntoView({ behavior: 'smooth' })}>
          Apply Now
        </button>
      </div>

      <div style={s.divider} />

      {/* What you get */}
      <div style={s.section}>
        <p style={s.sectionTitle}>What You Get</p>
        <p style={s.sectionSubtitle}>Everything you need to build a creative business — and then some.</p>
        <div style={s.grid}>
          {[
            { icon: '🏆', title: '12 Months Elite — Free', desc: 'Full access to our highest tier valued at $149.99/month. No credit card required during your partnership period.' },
            { icon: '🎖️', title: 'Founding Partner Badge', desc: 'A permanent badge on your LensTrybe profile identifying you as one of the original creator partners. It never disappears.' },
            { icon: '📞', title: 'Personal Onboarding Call', desc: 'A one-on-one call with the LensTrybe team to walk you through the platform and get your profile performing at its best.' },
            { icon: '🔖', title: 'Your Own Coupon Code', desc: 'A personalised coupon code tied to your brand. Your audience gets 50% off their first payment. You earn commission on every signup.' },
            { icon: '💰', title: '20% Commission', desc: 'Earn 20% of the first payment for every Pro, Expert or Elite subscriber who signs up using your code. Paid monthly.' },
            { icon: '📣', title: 'Content Resharing', desc: 'Any content you create about LensTrybe gets reshared across our official social channels — growing your own audience in the process.' },
          ].map(item => (
            <div key={item.title} style={s.card}>
              <div style={s.cardIcon}>{item.icon}</div>
              <div style={s.cardTitle}>{item.title}</div>
              <div style={s.cardDesc}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={s.divider} />

      {/* Commission table */}
      <div style={s.section}>
        <p style={s.sectionTitle}>Commission Structure</p>
        <p style={s.sectionSubtitle}>Your audience gets 20% off their first annual payment. You earn 20% of that payment.</p>
        <div style={{ overflowX: 'auto', background: '#12111a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '8px 0' }}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Plan</th>
                <th style={s.th}>Full Price</th>
                <th style={s.th}>Their Price</th>
                <th style={s.th}>Your Commission</th>
                <th style={s.th}>10 Signups</th>
              </tr>
            </thead>
            <tbody>
              {[
                { plan: 'Pro — Monthly', full: '$24.99/mo', their: '$12.50', comm: '$2.50', ten: '$25.00' },
                { plan: 'Pro — Annual', full: '$249.90/yr', their: '$124.95', comm: '$24.99', ten: '$249.90' },
                { plan: 'Expert — Monthly', full: '$74.99/mo', their: '$37.50', comm: '$7.50', ten: '$75.00' },
                { plan: 'Expert — Annual', full: '$749.90/yr', their: '$374.95', comm: '$74.99', ten: '$749.90' },
                { plan: 'Elite — Monthly', full: '$149.99/mo', their: '$75.00', comm: '$15.00', ten: '$150.00' },
                { plan: 'Elite — Annual', full: '$1,499.90/yr', their: '$749.95', comm: '$150.00', ten: '$1,500.00' },
              ].map(row => (
                <tr key={row.plan}>
                  <td style={s.td}>{row.plan}</td>
                  <td style={{ ...s.td, color: '#8b8a9a' }}>{row.full}</td>
                  <td style={s.td}>{row.their}</td>
                  <td style={{ ...s.td, ...s.highlight }}>{row.comm} AUD</td>
                  <td style={{ ...s.td, color: '#1DB954' }}>{row.ten} AUD</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: '#666', marginTop: 16, textAlign: 'center' }}>Commission is paid on the first payment only. Payouts processed monthly via bank transfer.</p>
      </div>

      <div style={s.divider} />

      {/* What we ask */}
      <div style={s.section}>
        <p style={s.sectionTitle}>What We Ask For</p>
        <p style={s.sectionSubtitle}>No scripted posts. No required hashtags. No minimum post count. Just your genuine experience.</p>
        <div style={{ ...s.grid, gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[
            { icon: '🎬', title: 'Profile Setup Reel', desc: 'Walk your audience through setting up your LensTrybe profile — skills, portfolio, credentials. This is the most impactful content you can create.' },
            { icon: '📩', title: 'First Enquiry Post', desc: 'When you receive your first booking or enquiry through LensTrybe, share it. Real results from real usage is the most powerful content.' },
            { icon: '🔍', title: 'Feature Deep Dive', desc: 'Pick one feature you genuinely love — invoicing, the job board, the booking system — and show your audience how it works.' },
            { icon: '🏷️', title: 'Coupon Code Drop', desc: 'Share your personal coupon code with your audience. Keep it natural — explain the offer and why you recommend it.' },
          ].map(item => (
            <div key={item.title} style={s.card}>
              <div style={s.cardIcon}>{item.icon}</div>
              <div style={s.cardTitle}>{item.title}</div>
              <div style={s.cardDesc}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={s.divider} />

      {/* Apply form */}
      <div style={{ ...s.section, paddingBottom: 100 }} id="apply">
        <p style={s.sectionTitle}>Apply to Partner</p>
        <p style={s.sectionSubtitle}>Fill in the form below and we will be in touch within a few days.</p>

        <div style={s.formWrap}>
          {submitted ? (
            <div style={s.successWrap}>
              <div style={s.successIcon}>🎉</div>
              <div style={s.successTitle}>Application received!</div>
              <p style={s.successText}>Thanks for applying! We will review your application and be in touch within a few days. Keep an eye on your inbox.</p>
            </div>
          ) : (
            <>
              {error && <div style={s.errorMsg}>{error}</div>}

              <div style={s.fieldWrap}>
                <label style={s.label}>Full Name</label>
                <input style={s.input} placeholder="Jane Smith" value={form.name} onChange={e => set('name', e.target.value)} />
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>Email Address</label>
                <input style={s.input} type="email" placeholder="jane@example.com" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>Primary Platform</label>
                <select style={s.select} value={form.platform} onChange={e => set('platform', e.target.value)}>
                  <option value="">Select a platform</option>
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>Handle or Profile URL</label>
                <input style={s.input} placeholder="@yourhandle or https://..." value={form.handle} onChange={e => set('handle', e.target.value)} />
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>Approximate Following Size</label>
                <select style={s.select} value={form.following_size} onChange={e => set('following_size', e.target.value)}>
                  <option value="">Select a range</option>
                  {FOLLOWING_SIZES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>Why do you want to be a Creator Partner?</label>
                <textarea style={s.textarea} placeholder="Tell us a bit about yourself and your audience..." value={form.why} onChange={e => set('why', e.target.value)} />
              </div>

              <button style={{ ...s.submitBtn, opacity: loading ? 0.7 : 1 }} onClick={handleSubmit} disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Application'}
              </button>

              <p style={{ fontSize: 12, color: '#555', textAlign: 'center', marginTop: 16 }}>
                We review every application personally and respond within a few days.
              </p>
            </>
          )}
        </div>
      </div>

    </div>
  )
}
