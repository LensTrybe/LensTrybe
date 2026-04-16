import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'

export default function PortfolioWebsitePage() {
  const { user, profile } = useAuth()
  const { tier } = useSubscription()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    subdomain: '',
    headline: '',
    tagline: '',
    show_portfolio: true,
    show_reviews: true,
    show_contact: true,
    show_services: true,
    custom_domain: '',
  })

  const isExpert = tier === 'expert' || tier === 'elite'
  const isElite = tier === 'elite'

  useEffect(() => {
    if (profile) {
      const defaultSubdomain = (profile.business_name ?? '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      setForm(prev => ({
        ...prev,
        subdomain: defaultSubdomain,
        headline: `Welcome to ${profile.business_name ?? 'my portfolio'}`,
        tagline: profile.bio?.slice(0, 100) ?? '',
        custom_domain: profile.custom_domain ?? '',
      }))
      const saved = localStorage.getItem(`website_settings_${profile.id}`)
      if (saved) {
        const parsed = JSON.parse(saved)
        setForm(prev => ({ ...prev, ...parsed }))
      }
    }
  }, [profile])

  async function save() {
    setSaving(true)
    localStorage.setItem(`website_settings_${user.id}`, JSON.stringify({
      subdomain: form.subdomain,
      headline: form.headline,
      tagline: form.tagline,
      show_portfolio: form.show_portfolio,
      show_reviews: form.show_reviews,
      show_contact: form.show_contact,
      show_services: form.show_services,
    }))
    await supabase.from('profiles').update({
      custom_domain: isElite ? form.custom_domain : null,
      portfolio_website_active: true,
    }).eq('id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const previewUrl = `${form.subdomain}.lenstrybe.com`

  const styles = {
    page: { display: 'flex', flexDirection: 'column', gap: '32px' },
    pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' },
    title: { fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--text-primary)', fontWeight: 400 },
    subtitle: { fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px' },
    upgradeBox: { padding: '40px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' },
    layout: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' },
    card: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' },
    sectionTitle: { fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    sectionSub: { fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '-12px' },
    urlPreview: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' },
    urlPrefix: { fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap' },
    urlDomain: { fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap' },
    urlValue: { fontSize: '13px', color: 'var(--green)', fontFamily: 'var(--font-ui)', fontWeight: 500 },
    toggle: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' },
    toggleLabel: { fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' },
    toggleTrack: (on) => ({ width: '40px', height: '22px', borderRadius: 'var(--radius-full)', background: on ? 'var(--green)' : 'var(--border-strong)', position: 'relative', transition: 'background var(--transition-base)', cursor: 'pointer', flexShrink: 0 }),
    toggleThumb: (on) => ({ position: 'absolute', top: '3px', left: on ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left var(--transition-base)' }),
    preview: { background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' },
    previewBar: { background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' },
    previewDot: (color) => ({ width: '10px', height: '10px', borderRadius: '50%', background: color }),
    previewUrl: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', flex: 1, textAlign: 'center' },
    previewBody: { padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center' },
    previewAvatar: { width: '64px', height: '64px', borderRadius: 'var(--radius-full)', background: 'var(--green-dim)', border: '1px solid rgba(29,185,84,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' },
    previewName: { fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--text-primary)', fontWeight: 400 },
    previewTagline: { fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', maxWidth: '280px', lineHeight: 1.6 },
    previewSections: { display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' },
    previewSection: { padding: '4px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-full)', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' },
    textarea: { width: '100%', minHeight: '80px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' },
    eliteBadge: { padding: '14px 16px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 'var(--radius-lg)', fontSize: '13px', color: '#EAB308', fontFamily: 'var(--font-ui)' },
    actions: { display: 'flex', justifyContent: 'flex-end', gap: '12px' },
  }

  if (!isExpert) {
    return (
      <div style={styles.page}>
        <div>
          <h1 style={styles.title}>Portfolio Website</h1>
          <p style={styles.subtitle}>Your own website at name.lenstrybe.com</p>
        </div>
        <div style={styles.upgradeBox}>
          <div style={{ fontSize: '32px' }}>🌐</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--text-primary)', fontWeight: 400 }}>
            Portfolio Website is an Expert feature
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', maxWidth: '400px', lineHeight: 1.7 }}>
            Upgrade to Expert to get your own portfolio website at <strong>yourname.lenstrybe.com</strong> — automatically built from your profile, portfolio and reviews.
          </div>
          <Button variant="primary" onClick={() => window.location.href = '/pricing'}>Upgrade to Expert</Button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Portfolio Website</h1>
          <p style={styles.subtitle}>Your public portfolio site — automatically built from your profile.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button variant="secondary" onClick={() => window.open(`https://${previewUrl}`, '_blank')}>
            View Live Site →
          </Button>
          <Button variant="primary" disabled={saving} onClick={save}>
            {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div style={styles.layout}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={styles.card}>
            <div style={styles.sectionTitle}>Your Website URL</div>
            <div style={styles.urlPreview}>
              <span style={styles.urlValue}>{form.subdomain}</span>
              <span style={styles.urlDomain}>.lenstrybe.com</span>
            </div>
            <Input
              label="Subdomain"
              value={form.subdomain}
              onChange={e => setForm(p => ({ ...p, subdomain: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') }))}
              hint="Only lowercase letters, numbers and hyphens"
            />
          </div>

          <div style={styles.card}>
            <div style={styles.sectionTitle}>Content</div>
            <Input label="Headline" placeholder="Capturing your most important moments" value={form.headline} onChange={e => setForm(p => ({ ...p, headline: e.target.value }))} />
            <div>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', display: 'block', marginBottom: '6px' }}>Tagline</label>
              <textarea style={styles.textarea} placeholder="A short description shown under your headline…" value={form.tagline} onChange={e => setForm(p => ({ ...p, tagline: e.target.value }))} />
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.sectionTitle}>Sections</div>
            <div style={styles.sectionSub}>Choose what appears on your website.</div>
            {[
              { key: 'show_portfolio', label: 'Portfolio gallery' },
              { key: 'show_reviews', label: 'Client reviews' },
              { key: 'show_services', label: 'Services & pricing' },
              { key: 'show_contact', label: 'Contact form' },
            ].map(item => (
              <div key={item.key} style={styles.toggle}>
                <span style={styles.toggleLabel}>{item.label}</span>
                <div style={styles.toggleTrack(form[item.key])} onClick={() => setForm(p => ({ ...p, [item.key]: !p[item.key] }))}>
                  <div style={styles.toggleThumb(form[item.key])} />
                </div>
              </div>
            ))}
          </div>

          {isElite && (
            <div style={styles.card}>
              <div style={styles.sectionTitle}>Custom Domain</div>
              <div style={styles.eliteBadge}>Elite feature — connect your own domain like yourname.com</div>
              <Input
                label="Custom domain"
                placeholder="www.yourwebsite.com"
                value={form.custom_domain}
                onChange={e => setForm(p => ({ ...p, custom_domain: e.target.value }))}
                hint="Add a CNAME record pointing to lenstrybe.com in your DNS settings"
              />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Preview</div>
          <div style={styles.preview}>
            <div style={styles.previewBar}>
              <div style={styles.previewDot('#EF4444')} />
              <div style={styles.previewDot('#EAB308')} />
              <div style={styles.previewDot('#22C55E')} />
              <div style={styles.previewUrl}>{previewUrl}</div>
            </div>
            <div style={styles.previewBody}>
              <div style={styles.previewAvatar}>
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  : '👤'
                }
              </div>
              <div style={styles.previewName}>{form.headline || profile?.business_name}</div>
              <div style={styles.previewTagline}>{form.tagline || 'Your tagline will appear here'}</div>
              <div style={styles.previewSections}>
                {form.show_portfolio && <div style={styles.previewSection}>Portfolio</div>}
                {form.show_reviews && <div style={styles.previewSection}>Reviews</div>}
                {form.show_services && <div style={styles.previewSection}>Services</div>}
                {form.show_contact && <div style={styles.previewSection}>Contact</div>}
              </div>
            </div>
          </div>

          <div style={{ padding: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.7 }}>
            Your website automatically pulls your profile photo, bio, portfolio photos, reviews and contact details. Keep your profile updated and your website stays current.
          </div>
        </div>
      </div>
    </div>
  )
}
