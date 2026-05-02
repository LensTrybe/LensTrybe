import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import {
  moderateText,
  moderateImage,
  PORTFOLIO_PHOTO_MODERATION_BLOCKED_MESSAGE,
  partitionFilesByPortfolioImageModeration,
} from '../../lib/moderateContent'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { GLASS_CARD, GLASS_CARD_GREEN, GLASS_MODAL_PANEL, GLASS_MODAL_OVERLAY_BASE, GLASS_NATIVE_FIELD, DIVIDER_GRADIENT_STYLE, TYPO, glassCardAccentBorder } from '../../lib/glassTokens'
import { LT_DASHBOARD_SELECT_CLASS, LT_DASHBOARD_SELECT_STYLE, LtDashboardSelectDarkStyles } from '../../lib/dashboardSelectDark'

const SKILL_TYPES = [
  'Photographer', 'Videographer', 'Drone Pilot', 'Video Editor',
  'Photo Editor', 'Social Media Manager', 'Hair & Makeup Artist', 'UGC Creator'
]

const SPECIALTIES_MAP = {
  Photographer: [
    'Wedding', 'Portrait', 'Commercial', 'Real Estate', 'Events', 'Fashion',
    'Product', 'Sports', 'Street', 'Architecture', 'Food', 'Newborn & Family',
    'Maternity', 'Boudoir', 'Pet', 'School', 'Headshots', 'Documentary',
    'Travel', 'Fine Art', 'Aerial', 'Night & Astro', 'Corporate',
  ],
  Videographer: [
    'Wedding', 'Brand Film', 'Documentary', 'Events', 'Music Video',
    'Social Media', 'Corporate', 'Sport', 'Real Estate', 'Travel',
    'Short Film', 'Commercial', 'Aerial', 'News & Journalism',
  ],
  'Drone Pilot': [
    'Real Estate', 'Cinematic', 'Surveying', 'Events', 'Agriculture',
    'Construction', 'Infrastructure', 'Mapping', 'Search & Rescue',
    'Film & TV', 'Sport', 'Inspection',
  ],
  'Video Editor': [
    'Colour Grading', 'Short-form / Reels', 'Wedding Films', 'VFX',
    'Motion Graphics', 'Corporate', 'Music Video', 'Documentary',
    'Social Media', 'Podcast', 'YouTube', 'Commercial',
  ],
  'Photo Editor': [
    'Retouching', 'Culling', 'Compositing', 'Product Editing',
    'Restoration', 'Fashion', 'Real Estate', 'Wedding', 'Colour Correction',
    'Background Removal', 'Skin Retouching',
  ],
  'Social Media Manager': [
    'Instagram & TikTok', 'Reels & Short-form', 'Brand Content',
    'Content Strategy', 'Content Scheduling', 'Visual Storytelling',
    'YouTube Management', 'LinkedIn Visual Content', 'Facebook & Meta Content',
    'Community Management', 'Influencer Outreach', 'Analytics & Reporting',
  ],
  'Hair & Makeup Artist': [
    'Bridal & Wedding', 'Editorial & Fashion', 'Commercial & Advertising',
    'Film & TV', 'Portrait & Headshots', 'Special Effects (SFX)',
    'Hair Styling', 'Airbrush', 'Natural & Lifestyle', 'Events & Occasions',
    'Theatre & Performance', "Men's Grooming",
  ],
  'UGC Creator': [
    'E-commerce & Product', 'App & Software Demos', 'Food & Beverage',
    'Beauty & Skincare', 'Health & Fitness', 'Travel & Lifestyle',
    'Fashion & Apparel', 'Home & Interiors', 'Pet Products',
    'Unboxing & Reviews', 'Paid Ad Creative', 'Testimonial Style',
    'Tech & Gadgets', 'Gaming', 'Finance & Fintech',
  ],
}

const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']

function profileWantsFoundingBadgeVisible(p) {
  if (!p || p.show_founding_badge == null) return true
  const v = p.show_founding_badge
  if (v === false || v === 'false' || v === 0 || v === '0') return false
  return true
}

function profileIsFoundingMember(p) {
  if (!p) return false
  const v = p.founding_member
  return v === true || v === 'true' || v === 1 || v === '1' || v === 't'
}

export default function EditProfilePage() {
  const { user, profile, fetchUserData, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState('basics')
  const [portfolioItems, setPortfolioItems] = useState([])
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false)
  /** 'checking' | 'uploading' | null — while uploadingPortfolio is true */
  const [portfolioUploadPhase, setPortfolioUploadPhase] = useState(null)
  const [otherCredentialName, setOtherCredentialName] = useState('')
  const [showFoundingBadge, setShowFoundingBadge] = useState(true)
  const [savingFoundingBadge, setSavingFoundingBadge] = useState(false)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const [toast, setToast] = useState(null)
  const [profileTextModerationError, setProfileTextModerationError] = useState('')

  const [credentials, setCredentials] = useState({
    abn: '',
    has_insurance: false,
    has_blue_card: false,
    has_police_check: false,
    has_wwvp: false,
    has_drone_licence: false,
    has_other: false,
    insurance_url: null,
    blue_card_url: null,
    police_check_url: null,
    wwvp_url: null,
    drone_licence_url: null,
    other_url: null,
  })

  const [form, setForm] = useState({
    business_name: '',
    bio: '',
    tagline: '',
    phone: '',
    website: '',
    instagram: '',
    tiktok: '',
    linkedin: '',
    facebook: '',
    twitter: '',
    city: '',
    state: '',
    country: 'Australia',
    skill_types: [],
    specialties: [],
    avatar_url: null,
  })

  useEffect(() => {
    if (!user || authLoading) return
    if (profile) {
      setForm({
        business_name: profile.business_name ?? '',
        bio: profile.bio ?? '',
        tagline: profile.tagline ?? '',
        phone: profile.phone ?? '',
        website: profile.website ?? '',
        instagram: profile.instagram_url ?? '',
        tiktok: profile.tiktok_url ?? '',
        linkedin: profile.linkedin_url ?? '',
        facebook: profile.facebook_url ?? '',
        twitter: profile.twitter_url ?? '',
        city: profile.city ?? '',
        state: profile.state ?? '',
        country: profile.country ?? 'Australia',
        skill_types: profile.skill_types ?? [],
        specialties: profile.specialties ?? [],
        avatar_url: profile.avatar_url ?? null,
      })
      setCredentials({
        abn: profile.abn ?? '',
        has_insurance: profile.has_insurance ?? false,
        has_blue_card: profile.has_blue_card ?? false,
        has_police_check: profile.has_police_check ?? false,
        has_wwvp: profile.has_wwvp ?? false,
        has_drone_licence: profile.has_drone_licence ?? false,
        has_other: profile.has_other ?? false,
        insurance_url: profile.insurance_url ?? null,
        blue_card_url: profile.blue_card_url ?? null,
        police_check_url: profile.police_check_url ?? null,
        wwvp_url: profile.wwvp_url ?? null,
        drone_licence_url: profile.drone_licence_url ?? null,
        other_url: profile.other_url ?? null,
      })
      setOtherCredentialName(profile.other_credential_name ?? '')
      setShowFoundingBadge(profileWantsFoundingBadgeVisible(profile))
      setLoading(false)
      void loadPortfolio()
    } else {
      setLoading(false)
    }
  }, [profile, user, authLoading])

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  async function loadPortfolio() {
    if (!user) return
    const { data } = await supabase.from('portfolio_items').select('*').eq('creative_id', user.id).order('sort_order', { ascending: true })
    setPortfolioItems(data ?? [])
  }

  async function uploadPortfolioFiles(files) {
    if (!user) return
    setUploadingPortfolio(true)
    setPortfolioUploadPhase('checking')
    try {
      const { filesToUpload, blockedFileNames, moderationFailedFileNames } =
        await partitionFilesByPortfolioImageModeration(files)

      if (blockedFileNames.length || moderationFailedFileNames.length) {
        const lines = []
        if (blockedFileNames.length) {
          lines.push(
            `${PORTFOLIO_PHOTO_MODERATION_BLOCKED_MESSAGE}\n\nRejected: ${blockedFileNames.join(', ')}`,
          )
        }
        if (moderationFailedFileNames.length) {
          lines.push(`Could not verify: ${moderationFailedFileNames.join(', ')}`)
        }
        setToast({ type: 'error', msg: lines.join('\n\n') })
        setTimeout(() => setToast(null), 9000)
      }

      if (!filesToUpload.length) {
        await loadPortfolio()
        return
      }

      setPortfolioUploadPhase('uploading')
      let nextOrder = portfolioItems.length
      for (const file of filesToUpload) {
        const isVideo = file.type.startsWith('video')
        const path = `${user.id}/${Date.now()}_${file.name}`
        const bucket = isVideo ? 'portfolio-videos' : 'portfolio'
        const { error } = await supabase.storage.from(bucket).upload(path, file)
        if (!error) {
          const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path)
          await supabase.from('portfolio_items').insert({
            creative_id: user.id,
            user_id: user.id,
            file_url: publicUrl,
            image_url: publicUrl,
            file_type: isVideo ? 'video' : 'image',
            sort_order: nextOrder,
          })
          nextOrder += 1
        }
      }
      await loadPortfolio()
    } finally {
      setPortfolioUploadPhase(null)
      setUploadingPortfolio(false)
    }
  }

  async function deletePortfolioItem(id) {
    await supabase.from('portfolio_items').delete().eq('id', id)
    setPortfolioItems(prev => prev.filter(p => p.id !== id))
  }

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function toggleArray(field, value) {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value]
    }))
  }

  async function persistFoundingBadge(nextChecked) {
    if (!user?.id || !profileIsFoundingMember(profile)) return
    const prev = showFoundingBadge
    setShowFoundingBadge(nextChecked)
    setSavingFoundingBadge(true)
    const { error } = await supabase.from('profiles').update({ show_founding_badge: nextChecked }).eq('id', user.id)
    if (error) {
      setShowFoundingBadge(prev)
      setSavingFoundingBadge(false)
      return
    }
    await fetchUserData(user.id)
    setSavingFoundingBadge(false)
  }

  function handleFoundingBadgeChange(e) {
    const next = e.target.checked
    void persistFoundingBadge(next)
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const result = await moderateImage(file)
      if (result?.blocked) {
        setToast({ type: 'error', msg: PORTFOLIO_PHOTO_MODERATION_BLOCKED_MESSAGE })
        setTimeout(() => setToast(null), 5000)
        e.target.value = ''
        return
      }
      if (result?.flagged) {
        console.warn('[moderateContent] Avatar flagged (upload allowed)', result?.reason ?? '')
      }
      const ext = file.name.split('.').pop()
      const path = `${user.id}/avatar.${ext}`
      await supabase.storage.from('portfolio').upload(path, file, { upsert: true })
      const { data: { publicUrl } } = supabase.storage.from('portfolio').getPublicUrl(path)
      update('avatar_url', publicUrl)
    } catch (err) {
      setToast({ type: 'error', msg: err?.message || 'Could not check or upload image.' })
      setTimeout(() => setToast(null), 5000)
      e.target.value = ''
    } finally {
      setUploading(false)
    }
  }

  async function uploadCredential(file, field) {
    if (!user) return
    const path = `credentials/${user.id}/${field}_${Date.now()}`
    const { error } = await supabase.storage.from('credentials').upload(path, file, { upsert: true })
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('credentials').getPublicUrl(path)
      setCredentials(prev => ({ ...prev, [`${field}_url`]: publicUrl, [`has_${field}`]: true }))
    }
  }

  async function saveProfile() {
    setSaving(true)
    setProfileTextModerationError('')
    const combinedBioTagline = [form.bio, form.tagline].filter(Boolean).join('\n')
    const textResult = await moderateText(combinedBioTagline)
    if (textResult?.blocked) {
      setProfileTextModerationError(textResult.reason || 'This content cannot be saved.')
      setSaving(false)
      return
    }
    if (textResult?.flagged) {
      console.warn('[EditProfile] Profile text flagged by moderation', { reason: textResult.reason })
    }
    await supabase.from('profiles').update({
      business_name: form.business_name,
      bio: form.bio,
      tagline: form.tagline,
      phone: form.phone,
      website: form.website,
      instagram_url: form.instagram,
      tiktok_url: form.tiktok,
      linkedin_url: form.linkedin,
      facebook_url: form.facebook,
      twitter_url: form.twitter,
      city: form.city,
      state: form.state,
      country: form.country,
      skill_types: form.skill_types,
      specialties: form.specialties,
      avatar_url: form.avatar_url,
      abn: credentials.abn || null,
      has_insurance: credentials.has_insurance,
      has_blue_card: credentials.has_blue_card,
      has_police_check: credentials.has_police_check,
      has_wwvp: credentials.has_wwvp,
      has_drone_licence: credentials.has_drone_licence,
      has_other: credentials.has_other,
      insurance_url: credentials.insurance_url,
      blue_card_url: credentials.blue_card_url,
      police_check_url: credentials.police_check_url,
      wwvp_url: credentials.wwvp_url,
      drone_licence_url: credentials.drone_licence_url,
      other_url: credentials.other_url,
      other_credential_name: otherCredentialName || null,
    }).eq('id', user.id)
    await fetchUserData(user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const availableSpecialties = form.skill_types.flatMap(s => SPECIALTIES_MAP[s] ?? [])
  const uniqueSpecialties = [...new Set(availableSpecialties)]

  const styles = {
    page: { background: 'transparent', display: 'flex', flexDirection: 'column', gap: '32px' },
    pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' },
    title: { ...TYPO.heading, fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--text-primary)', fontWeight: 400 },
    subtitle: { ...TYPO.body, fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px' },
    tabs: { display: 'flex', ...GLASS_CARD, borderRadius: 'var(--radius-lg)', overflowX: isMobile ? 'auto' : 'hidden', overflowY: 'hidden', width: isMobile ? '100%' : 'fit-content', whiteSpace: isMobile ? 'nowrap' : 'normal' },
    tab: (active) => ({ padding: '8px 20px', border: 'none', background: active ? 'var(--bg-overlay)' : 'transparent', color: active ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-ui)', cursor: 'pointer', transition: 'all var(--transition-fast)', fontWeight: active ? 500 : 400, whiteSpace: 'nowrap', flexShrink: 0 }),
    section: { display: 'flex', flexDirection: 'column', gap: '20px' },
    sectionTitle: { ...TYPO.heading, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    sectionSub: { fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '-12px' },
    row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    card: { ...GLASS_CARD, borderRadius: 'var(--radius-xl)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' },
    avatarSection: { display: 'flex', alignItems: 'center', gap: '24px' },
    avatar: { width: '80px', height: '80px', borderRadius: 'var(--radius-full)', background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', objectFit: 'cover', flexShrink: 0 },
    avatarPlaceholder: { width: '80px', height: '80px', borderRadius: 'var(--radius-full)', background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', flexShrink: 0 },
    avatarInfo: { display: 'flex', flexDirection: 'column', gap: '8px' },
    avatarName: { fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    skillGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
    skillChip: (selected) => ({ padding: '10px 16px', borderRadius: 'var(--radius-lg)', border: `1px solid ${selected ? 'var(--green)' : 'var(--border-default)'}`, background: selected ? 'var(--green-dim)' : 'var(--bg-elevated)', color: selected ? 'var(--green)' : 'var(--text-secondary)', fontSize: '13px', fontWeight: selected ? 500 : 400, cursor: 'pointer', transition: 'all var(--transition-base)', textAlign: 'center', fontFamily: 'var(--font-ui)' }),
    specialtyWrap: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
    specialtyChip: (selected) => ({ padding: '6px 14px', borderRadius: 'var(--radius-full)', border: `1px solid ${selected ? 'var(--green)' : 'var(--border-default)'}`, background: selected ? 'var(--green-dim)' : 'transparent', color: selected ? 'var(--green)' : 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', transition: 'all var(--transition-base)', fontFamily: 'var(--font-ui)' }),
    textarea: { ...GLASS_NATIVE_FIELD, width: '100%', minHeight: '120px', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' },
    select: { ...LT_DASHBOARD_SELECT_STYLE, borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontFamily: 'var(--font-ui)', fontSize: '14px', outline: 'none', width: '100%' },
    label: { ...TYPO.label, fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', display: 'block', marginBottom: '6px' },
    actions: { display: 'flex', justifyContent: 'flex-end', gap: '12px' },
  }

  if (loading) return <div style={{ background: 'transparent', padding: '40px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Loading profile…</div>

  return (
    <div style={{ ...styles.page, overflowX: 'hidden' }} className="edit-profile-page">
      <LtDashboardSelectDarkStyles />
      {toast && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            background: toast.type === 'error' ? '#ef4444' : '#1DB954',
            color: toast.type === 'error' ? '#fff' : '#000',
            padding: '12px 20px',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: 600,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            fontFamily: 'var(--font-ui)',
            maxWidth: 'min(420px, calc(100vw - 32px))',
          }}
        >
          {toast.type === 'error' ? '✕ ' : '✓ '}
          {toast.msg}
        </div>
      )}
      <style>{`
        @media (max-width: 767px) {
          .edit-profile-page { padding: 16px !important; }
          .edit-profile-page h1, .edit-profile-page h2 { font-size: 24px !important; }
          .edit-profile-page button { min-height: 44px; }
          .edit-profile-page input, .edit-profile-page textarea, .edit-profile-page select { width: 100% !important; font-size: 14px !important; }
          .edit-profile-page [style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Edit Profile</h1>
          <p style={styles.subtitle}>Update your public profile and account details.</p>
        </div>
        <Button variant="primary" disabled={saving} onClick={saveProfile}>
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

      <div style={styles.card}>
        <div style={styles.avatarSection}>
          {form.avatar_url
            ? <img src={form.avatar_url} alt="Avatar" style={styles.avatar} />
            : <div style={styles.avatarPlaceholder}>👤</div>
          }
          <div style={styles.avatarInfo}>
            <div style={styles.avatarName}>{form.business_name || 'Your Business'}</div>
            <Button variant="secondary" size="sm" disabled={uploading} onClick={() => document.getElementById('avatar-edit').click()}>
              {uploading ? 'Uploading…' : 'Change Photo'}
            </Button>
            <input id="avatar-edit" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
          </div>
        </div>
      </div>

      <div style={styles.tabs}>
        {['basics', 'skills', 'location', 'social', 'credentials', 'portfolio'].map(t => (
          <button key={t} type="button" style={styles.tab(activeTab === t)} onClick={() => setActiveTab(t)}>
            {t === 'credentials' ? 'Credentials' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'basics' && (
        <div style={styles.card}>
          {(!form.avatar_url || String(form.avatar_url).trim() === '') && (
            <div
              style={{
                marginBottom: '14px',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(29,185,84,0.35)',
                background: 'rgba(29,185,84,0.08)',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                fontFamily: 'var(--font-ui)',
              }}
            >
              Add a profile photo to appear in the Featured Creatives section on the homepage.
            </div>
          )}
          <div style={styles.sectionTitle}>Business Details</div>
          <Input label="Business name" value={form.business_name} onChange={e => update('business_name', e.target.value)} placeholder="Golden Hour Studio" />
          <Input
            label="Tagline"
            value={form.tagline}
            onChange={e => { setProfileTextModerationError(''); update('tagline', e.target.value) }}
            placeholder="Brisbane's most trusted wedding photographer"
            error={profileTextModerationError}
          />
          <div>
            <label style={styles.label}>Bio</label>
            <textarea
              style={{
                ...styles.textarea,
                ...(profileTextModerationError
                  ? { borderColor: 'rgba(239,68,68,0.45)', boxShadow: '0 0 0 1px rgba(239,68,68,0.2)' }
                  : {}),
              }}
              value={form.bio}
              onChange={e => { setProfileTextModerationError(''); update('bio', e.target.value) }}
              placeholder="I'm a Brisbane-based wedding photographer with 8 years of experience capturing authentic moments…"
              aria-invalid={profileTextModerationError ? true : undefined}
              aria-describedby={profileTextModerationError ? 'bio-moderation-hint' : undefined}
            />
            {profileTextModerationError ? (
              <p id="bio-moderation-hint" style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', fontFamily: 'var(--font-ui)', lineHeight: 1.45 }}>
                Tagline and bio are checked together. See the message under Tagline.
              </p>
            ) : null}
          </div>
          {profileIsFoundingMember(profile) && (
            <div style={{ marginTop: '8px', paddingTop: '20px', borderTop: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1', minWidth: '200px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>Founding Member Badge</div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', margin: '6px 0 0', lineHeight: 1.5 }}>
                    Show your Founding Member badge on your public and private profile.
                  </p>
                </div>
                <label
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    width: '48px',
                    height: '28px',
                    flexShrink: 0,
                    cursor: savingFoundingBadge ? 'wait' : 'pointer',
                    opacity: savingFoundingBadge ? 0.7 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    role="switch"
                    aria-checked={showFoundingBadge}
                    checked={showFoundingBadge}
                    disabled={savingFoundingBadge}
                    onChange={handleFoundingBadgeChange}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '48px',
                      height: '28px',
                      margin: 0,
                      opacity: 0,
                      cursor: savingFoundingBadge ? 'wait' : 'pointer',
                      zIndex: 2,
                    }}
                  />
                  <span
                    aria-hidden
                    style={{
                      display: 'block',
                      width: '48px',
                      height: '28px',
                      borderRadius: '14px',
                      background: showFoundingBadge ? '#1DB954' : 'var(--border-default)',
                      transition: 'background 0.2s',
                      position: 'relative',
                      pointerEvents: 'none',
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        position: 'absolute',
                        top: '3px',
                        left: showFoundingBadge ? '23px' : '3px',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: '#fff',
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        pointerEvents: 'none',
                      }}
                    />
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'skills' && (
        <div style={styles.section}>
          <div style={styles.card}>
            <div style={styles.sectionTitle}>Creative Skills</div>
            <div style={styles.sectionSub}>Select all categories that apply to you.</div>
            <div style={styles.skillGrid}>
              {SKILL_TYPES.map(skill => (
                <div key={skill} style={styles.skillChip(form.skill_types.includes(skill))} onClick={() => toggleArray('skill_types', skill)}>
                  {skill}
                </div>
              ))}
            </div>
          </div>

          {uniqueSpecialties.length > 0 && (
            <div style={styles.card}>
              <div style={styles.sectionTitle}>Specialties</div>
              <div style={styles.sectionSub}>Select your areas of focus within your chosen skill types.</div>
              <div style={styles.specialtyWrap}>
                {uniqueSpecialties.map(spec => (
                  <div key={spec} style={styles.specialtyChip(form.specialties.includes(spec))} onClick={() => toggleArray('specialties', spec)}>
                    {spec}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'location' && (
        <div style={styles.card}>
          <div style={styles.sectionTitle}>Location</div>
          <div style={styles.sectionSub}>Used so clients can find you in search results.</div>
          <Input label="City or suburb" value={form.city} onChange={e => update('city', e.target.value)} placeholder="Brisbane" />
          <div style={styles.row}>
            <div>
              <label style={styles.label}>State</label>
              <select className={LT_DASHBOARD_SELECT_CLASS} style={styles.select} value={form.state} onChange={e => update('state', e.target.value)}>
                <option value="">Select state</option>
                {AU_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <Input label="Country" value={form.country} onChange={e => update('country', e.target.value)} placeholder="Australia" />
          </div>
        </div>
      )}

      {activeTab === 'social' && (
        <div style={styles.card}>
          <div style={styles.sectionTitle}>Social Links</div>
          <div style={styles.sectionSub}>Displayed on your public profile.</div>
          <Input label="Website" placeholder="https://yourwebsite.com" value={form.website} onChange={e => update('website', e.target.value)} />
          <Input label="Instagram" placeholder="@yourhandle" value={form.instagram} onChange={e => update('instagram', e.target.value)} />
          <Input label="TikTok" placeholder="@yourhandle" value={form.tiktok} onChange={e => update('tiktok', e.target.value)} />
          <Input label="LinkedIn" placeholder="linkedin.com/in/yourprofile" value={form.linkedin} onChange={e => update('linkedin', e.target.value)} />
          <Input label="Facebook" placeholder="facebook.com/yourpage" value={form.facebook} onChange={e => update('facebook', e.target.value)} />
          <Input label="X / Twitter" value={form.twitter} onChange={e => update('twitter', e.target.value)} placeholder="https://x.com/yourusername" />
          <Input label="Phone (optional)" placeholder="0400 000 000" value={form.phone} onChange={e => update('phone', e.target.value)} />
        </div>
      )}

      {activeTab === 'credentials' && (
        <div style={styles.card}>
          <div style={styles.sectionTitle}>Trust & Credentials</div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.6 }}>
            These documents are private — only the badges display publicly on your profile. Clients cannot view or download the actual files.
          </p>

          <Input label="ABN / ACN" value={credentials.abn} onChange={e => setCredentials(p => ({ ...p, abn: e.target.value }))} placeholder="12 345 678 901" />

          {[
            { key: 'insurance', label: 'Public Liability Insurance', desc: 'Upload your certificate of currency' },
            { key: 'blue_card', label: 'Blue Card / Working with Children Check', desc: 'Upload your blue card or WWCC' },
            { key: 'police_check', label: 'Police Check', desc: 'Upload your national police certificate' },
            { key: 'wwvp', label: 'Working with Vulnerable People (WWVP)', desc: 'Upload your WWVP card or certificate' },
            { key: 'drone_licence', label: 'CASA Drone Licence / ReOC', desc: 'Upload your Remote Pilot Licence or ReOC certificate' },
            { key: 'other', label: 'Other Credential', desc: 'Any other professional licence or certification' },
          ].map(({ key, label, desc }) => (
            <div key={key} style={{ marginBottom: '20px', padding: '16px', ...GLASS_CARD, borderRadius: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{desc}</div>
                </div>
                {credentials[`has_${key}`] && (
                  <span style={{ padding: '3px 10px', ...GLASS_CARD_GREEN, borderRadius: '999px', fontSize: '11px', fontWeight: 700, color: '#1DB954' }}>✓ Uploaded</span>
                )}
              </div>
              {key === 'other' && (
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Credential Name</label>
                  <input
                    value={otherCredentialName}
                    onChange={e => setOtherCredentialName(e.target.value)}
                    placeholder="e.g. CASA Remote Pilot Licence, First Aid Certificate..."
                    style={{ width: '100%', padding: '9px 12px', ...GLASS_CARD, borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => document.getElementById(`cred-${key}`).click()}
                  style={{ padding: '7px 14px', ...GLASS_CARD, borderRadius: '7px', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
                >
                  {credentials[`has_${key}`] ? 'Replace File' : 'Upload File'}
                </button>
                {credentials[`has_${key}`] && (
                  <button
                    type="button"
                    onClick={() => setCredentials(p => ({ ...p, [`has_${key}`]: false, [`${key}_url`]: null }))}
                    style={{ padding: '7px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '7px', color: '#ef4444', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
                  >Remove</button>
                )}
                <input id={`cred-${key}`} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadCredential(f, key); e.target.value = '' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'portfolio' && (
        <div style={styles.card}>
          <div style={styles.sectionTitle}>Portfolio</div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.6 }}>
            Photos and videos uploaded here appear on your public profile.
          </p>
          <div
            onClick={() => document.getElementById('portfolio-upload').click()}
            style={{ border: '2px dashed var(--border-default)', borderRadius: '10px', padding: '24px', textAlign: 'center', cursor: 'pointer', marginBottom: '20px', color: 'var(--text-muted)', fontSize: '14px' }}
          >
            {uploadingPortfolio
              ? portfolioUploadPhase === 'checking'
                ? 'Checking photos...'
                : 'Uploading...'
              : '+ Click to upload photos or videos'}
          </div>
          <input
            id="portfolio-upload"
            type="file"
            accept="image/*,video/*"
            multiple
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files
              if (f?.length) void uploadPortfolioFiles(Array.from(f))
              e.target.value = ''
            }}
          />
          {portfolioItems.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {portfolioItems.map(item => (
                <div key={item.id} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', aspectRatio: '1', background: 'var(--bg-base)' }}>
                  {item.file_type === 'video'
                    ? <video src={item.file_url ?? item.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                    : <img src={item.file_url ?? item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  }
                  <button
                    type="button"
                    onClick={() => deletePortfolioItem(item.id)}
                    style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', color: '#fff', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >✕</button>
                </div>
              ))}
            </div>
          )}
          {portfolioItems.length === 0 && !uploadingPortfolio && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '20px' }}>No portfolio items yet.</div>
          )}
        </div>
      )}

      <div style={styles.actions}>
        <Button variant="primary" disabled={saving} onClick={saveProfile}>
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
