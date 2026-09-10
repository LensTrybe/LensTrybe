import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import {
  moderateText,
  moderateImage,
  PORTFOLIO_PHOTO_MODERATION_BLOCKED_MESSAGE,
  partitionFilesByPortfolioImageModeration,
} from '../../lib/moderateContent'
import { useAuth } from '../../context/AuthContext'
import { CREATIVE_TYPES } from '../../lib/creativeTypes'

const GREEN = '#1DB954'
const GREEN_DARK = '#04120a'
const PINK = '#FF2D78'

const PROFILE_TABS = ['basics', 'skills', 'location', 'social', 'credentials', 'portfolio']

// Launch scope (Photographer, Videographer) from the shared source of truth.
const SKILL_TYPES = CREATIVE_TYPES

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

function StyleBlock() {
  return (
    <style>{`
      .ltep-page { display: flex; flex-direction: column; gap: 24px; overflow-x: hidden; }
      .ltep-label { font-size: 13px; font-weight: 600; color: var(--lt-muted); display: block; margin-bottom: 6px; }
      .ltep-input, .ltep-textarea, .ltep-select { width: 100%; padding: 10px 14px; border-radius: 10px; font-size: 14px; font-family: inherit; outline: none; background: var(--lt-input-bg); color: var(--lt-text); border: 1px solid var(--lt-input-border); box-sizing: border-box; }
      .ltep-textarea { min-height: 120px; resize: vertical; line-height: 1.6; }
      .ltep-input:focus, .ltep-textarea:focus, .ltep-select:focus { border-color: ${GREEN}; }
      .ltep-input::placeholder, .ltep-textarea::placeholder { color: var(--lt-faint); }
      .ltep-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: 9px; padding: 9px 18px; font-size: 13.5px; font-weight: 700; font-family: inherit; cursor: pointer; border: none; white-space: nowrap; transition: filter .15s ease, background .15s ease, opacity .15s ease; }
      .ltep-btn-primary { background: ${GREEN}; color: ${GREEN_DARK}; }
      .ltep-btn-primary:hover { filter: brightness(1.06); }
      .ltep-btn-primary:disabled { opacity: .55; cursor: default; }
      .ltep-btn-ghost { background: var(--lt-input-bg); color: var(--lt-text); border: 1px solid var(--lt-border); }
      .ltep-btn-ghost:hover { background: var(--lt-surface-2); }
      .ltep-chip { padding: 7px 15px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; border: 1px solid var(--lt-border); background: var(--lt-input-bg); color: var(--lt-muted); white-space: nowrap; flex-shrink: 0; }
      .ltep-chip.on { border-color: ${GREEN}; background: rgba(29,185,84,0.14); color: ${GREEN}; }
      .ltep-skill { padding: 11px 16px; border-radius: 12px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; text-align: center; border: 1px solid var(--lt-border); background: var(--lt-input-bg); color: var(--lt-muted); transition: all .12s ease; }
      .ltep-skill.on { border-color: ${GREEN}; background: rgba(29,185,84,0.14); color: ${GREEN}; }
      .ltep-spec { padding: 6px 14px; border-radius: 999px; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; border: 1px solid var(--lt-border); background: var(--lt-input-bg); color: var(--lt-muted); transition: all .12s ease; }
      .ltep-spec.on { border-color: ${GREEN}; background: rgba(29,185,84,0.14); color: ${GREEN}; }
      .ltep-drop { border: 2px dashed var(--lt-border); border-radius: 12px; padding: 26px; text-align: center; cursor: pointer; color: var(--lt-muted); font-size: 14px; transition: border-color .12s ease, background .12s ease; }
      .ltep-drop:hover { border-color: ${GREEN}; background: var(--lt-surface-2); }
      @media (max-width: 767px) {
        .ltep-row { grid-template-columns: 1fr !important; }
        .ltep-skillgrid { grid-template-columns: 1fr !important; }
        .ltep-portfolio-grid { grid-template-columns: repeat(2, 1fr) !important; }
        .ltep-page button { min-height: 44px; }
      }
    `}</style>
  )
}

function TextField({ label, value, onChange, placeholder, type = 'text', error }) {
  return (
    <div>
      {label && <label className="ltep-label">{label}</label>}
      <input className="ltep-input" style={error ? { borderColor: 'rgba(255,45,120,0.55)', boxShadow: '0 0 0 1px rgba(255,45,120,0.2)' } : undefined} type={type} value={value} onChange={onChange} placeholder={placeholder} />
      {error && <div style={{ fontSize: 12.5, color: PINK, marginTop: 6, lineHeight: 1.45 }}>{error}</div>}
    </div>
  )
}

export default function EditProfilePage() {
  const { user, profile, fetchUserData, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(() => {
    const t = searchParams.get('tab')
    return PROFILE_TABS.includes(t) ? t : 'basics'
  })
  useEffect(() => {
    const t = searchParams.get('tab')
    if (PROFILE_TABS.includes(t)) setActiveTab(t)
  }, [searchParams])
  const [portfolioItems, setPortfolioItems] = useState([])
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false)
  const [portfolioUploadPhase, setPortfolioUploadPhase] = useState(null)
  const [otherCredentialName, setOtherCredentialName] = useState('')
  const [showFoundingBadge, setShowFoundingBadge] = useState(true)
  const [savingFoundingBadge, setSavingFoundingBadge] = useState(false)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const [toast, setToast] = useState(null)
  const [profileTextModerationError, setProfileTextModerationError] = useState('')

  const [credentials, setCredentials] = useState({
    abn: '', has_insurance: false, has_blue_card: false, has_police_check: false,
    has_wwvp: false, has_drone_licence: false, has_other: false,
    insurance_url: null, blue_card_url: null, police_check_url: null,
    wwvp_url: null, drone_licence_url: null, other_url: null,
  })

  const [form, setForm] = useState({
    business_name: '', bio: '', tagline: '', phone: '', website: '',
    instagram: '', tiktok: '', linkedin: '', facebook: '', twitter: '',
    city: '', state: '', country: 'Australia',
    skill_types: [], specialties: [], avatar_url: null,
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
    function handleResize() { setIsMobile(window.innerWidth < 768) }
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
          lines.push(`${PORTFOLIO_PHOTO_MODERATION_BLOCKED_MESSAGE}\n\nRejected: ${blockedFileNames.join(', ')}`)
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
        : [...prev[field], value],
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
    void persistFoundingBadge(e.target.checked)
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
      if (result?.flagged) console.warn('[moderateContent] Avatar flagged (upload allowed)', result?.reason ?? '')
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
    if (textResult?.flagged) console.warn('[EditProfile] Profile text flagged by moderation', { reason: textResult.reason })
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
    // Credential document links are private: save them (including removals) to
    // the owner-only profile_private table.
    await supabase.from('profile_private').upsert({
      id: user.id,
      insurance_url: credentials.insurance_url || null,
      blue_card_url: credentials.blue_card_url || null,
      police_check_url: credentials.police_check_url || null,
      wwvp_url: credentials.wwvp_url || null,
      drone_licence_url: credentials.drone_licence_url || null,
      other_url: credentials.other_url || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    await fetchUserData(user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const availableSpecialties = form.skill_types.flatMap(s => SPECIALTIES_MAP[s] ?? [])
  const uniqueSpecialties = [...new Set(availableSpecialties)]

  const GLASS = { background: 'var(--lt-glass-bg)', border: 'var(--lt-glass-border)', boxShadow: 'var(--lt-glass-shadow)', backdropFilter: 'var(--lt-glass-blur)', WebkitBackdropFilter: 'var(--lt-glass-blur)' }
  const card = { ...GLASS, borderRadius: 18, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }
  const sectionTitle = { fontSize: 15, fontWeight: 700, color: 'var(--lt-text)' }
  const sectionSub = { fontSize: 13, color: 'var(--lt-muted)', marginTop: -12 }

  if (loading) return <div style={{ padding: 40, color: 'var(--lt-muted)' }}>Loading profile…</div>

  const saveBtn = (
    <button type="button" className="ltep-btn ltep-btn-primary" disabled={saving} onClick={saveProfile}>
      {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save changes'}
    </button>
  )

  return (
    <>
      <StyleBlock />
      <div className="ltep-page">
        {toast && (
          <div role="alert" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: toast.type === 'error' ? PINK : GREEN, color: toast.type === 'error' ? '#fff' : GREEN_DARK, padding: '12px 20px', borderRadius: 12, fontSize: 14, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', maxWidth: 'min(420px, calc(100vw - 32px))', whiteSpace: 'pre-line' }}>
            {toast.type === 'error' ? '✕ ' : '✓ '}{toast.msg}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: isMobile ? 24 : 27, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--lt-text)' }}>Edit profile</h1>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--lt-muted)' }}>Update your public profile and account details.</p>
          </div>
          {saveBtn}
        </div>

        {/* Avatar */}
        <div style={{ ...card, flexDirection: 'row', alignItems: 'center', gap: 24 }}>
          {form.avatar_url
            ? <img src={form.avatar_url} alt="Avatar" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--lt-border)', flexShrink: 0 }} />
            : <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--lt-surface-2)', border: '1px solid var(--lt-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: 'var(--lt-faint)', flexShrink: 0 }}>👤</div>
          }
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--lt-text)' }}>{form.business_name || 'Your business'}</div>
            <button type="button" className="ltep-btn ltep-btn-ghost" disabled={uploading} onClick={() => document.getElementById('avatar-edit').click()}>
              {uploading ? 'Uploading…' : 'Change photo'}
            </button>
            <input id="avatar-edit" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PROFILE_TABS.map(t => (
            <button key={t} type="button" className={`ltep-chip${activeTab === t ? ' on' : ''}`} onClick={() => setActiveTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === 'basics' && (
          <div style={card}>
            {(!form.avatar_url || String(form.avatar_url).trim() === '') && (
              <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(29,185,84,0.35)', background: 'rgba(29,185,84,0.08)', color: 'var(--lt-text)', fontSize: 13 }}>
                Add a profile photo to appear in the Featured Creatives section on the homepage.
              </div>
            )}
            <div style={sectionTitle}>Business details</div>
            <TextField label="Business name" value={form.business_name} onChange={e => update('business_name', e.target.value)} placeholder="Golden Hour Studio" />
            <TextField label="Tagline" value={form.tagline} onChange={e => { setProfileTextModerationError(''); update('tagline', e.target.value) }} placeholder="Brisbane's most trusted wedding photographer" error={profileTextModerationError} />
            <div>
              <label className="ltep-label">Bio</label>
              <textarea
                className="ltep-textarea"
                style={profileTextModerationError ? { borderColor: 'rgba(255,45,120,0.55)', boxShadow: '0 0 0 1px rgba(255,45,120,0.2)' } : undefined}
                value={form.bio}
                onChange={e => { setProfileTextModerationError(''); update('bio', e.target.value) }}
                placeholder="I'm a Brisbane-based wedding photographer with 8 years of experience capturing authentic moments…"
                aria-invalid={profileTextModerationError ? true : undefined}
              />
              {profileTextModerationError && (
                <p style={{ fontSize: 12, color: 'var(--lt-muted)', marginTop: 6, lineHeight: 1.45 }}>Tagline and bio are checked together. See the message under Tagline.</p>
              )}
            </div>
            {profileIsFoundingMember(profile) && (
              <div style={{ marginTop: 8, paddingTop: 20, borderTop: '1px solid var(--lt-hairline)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--lt-text)' }}>Founding member badge</div>
                    <p style={{ fontSize: 12.5, color: 'var(--lt-muted)', margin: '6px 0 0', lineHeight: 1.5 }}>Show your Founding Member badge on your public and private profile.</p>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: 48, height: 28, flexShrink: 0, cursor: savingFoundingBadge ? 'wait' : 'pointer', opacity: savingFoundingBadge ? 0.7 : 1 }}>
                    <input type="checkbox" role="switch" aria-checked={showFoundingBadge} checked={showFoundingBadge} disabled={savingFoundingBadge} onChange={handleFoundingBadgeChange} style={{ position: 'absolute', inset: 0, width: 48, height: 28, margin: 0, opacity: 0, cursor: savingFoundingBadge ? 'wait' : 'pointer', zIndex: 2 }} />
                    <span aria-hidden style={{ display: 'block', width: 48, height: 28, borderRadius: 14, background: showFoundingBadge ? GREEN : 'var(--lt-track)', transition: 'background 0.2s', position: 'relative', pointerEvents: 'none' }}>
                      <span aria-hidden style={{ position: 'absolute', top: 3, left: showFoundingBadge ? 23 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', pointerEvents: 'none' }} />
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'skills' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={card}>
              <div style={sectionTitle}>Creative skills</div>
              <div style={sectionSub}>Select all categories that apply to you.</div>
              <div className="ltep-skillgrid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {SKILL_TYPES.map(skill => (
                  <button type="button" key={skill} className={`ltep-skill${form.skill_types.includes(skill) ? ' on' : ''}`} onClick={() => toggleArray('skill_types', skill)}>{skill}</button>
                ))}
              </div>
            </div>
            {uniqueSpecialties.length > 0 && (
              <div style={card}>
                <div style={sectionTitle}>Specialties</div>
                <div style={sectionSub}>Select your areas of focus within your chosen skill types.</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {uniqueSpecialties.map(spec => (
                    <button type="button" key={spec} className={`ltep-spec${form.specialties.includes(spec) ? ' on' : ''}`} onClick={() => toggleArray('specialties', spec)}>{spec}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'location' && (
          <div style={card}>
            <div style={sectionTitle}>Location</div>
            <div style={sectionSub}>Used so clients can find you in search results.</div>
            <TextField label="City or suburb" value={form.city} onChange={e => update('city', e.target.value)} placeholder="Brisbane" />
            <div className="ltep-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label className="ltep-label">State</label>
                <select className="ltep-select" value={form.state} onChange={e => update('state', e.target.value)}>
                  <option value="">Select state</option>
                  {AU_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <TextField label="Country" value={form.country} onChange={e => update('country', e.target.value)} placeholder="Australia" />
            </div>
          </div>
        )}

        {activeTab === 'social' && (
          <div style={card}>
            <div style={sectionTitle}>Social links</div>
            <div style={sectionSub}>Displayed on your public profile.</div>
            <TextField label="Website" placeholder="https://yourwebsite.com" value={form.website} onChange={e => update('website', e.target.value)} />
            <TextField label="Instagram" placeholder="@yourhandle" value={form.instagram} onChange={e => update('instagram', e.target.value)} />
            <TextField label="TikTok" placeholder="@yourhandle" value={form.tiktok} onChange={e => update('tiktok', e.target.value)} />
            <TextField label="LinkedIn" placeholder="linkedin.com/in/yourprofile" value={form.linkedin} onChange={e => update('linkedin', e.target.value)} />
            <TextField label="Facebook" placeholder="facebook.com/yourpage" value={form.facebook} onChange={e => update('facebook', e.target.value)} />
            <TextField label="X / Twitter" value={form.twitter} onChange={e => update('twitter', e.target.value)} placeholder="https://x.com/yourusername" />
            <TextField label="Phone (optional)" placeholder="0400 000 000" value={form.phone} onChange={e => update('phone', e.target.value)} />
          </div>
        )}

        {activeTab === 'credentials' && (
          <div style={card}>
            <div style={sectionTitle}>Trust &amp; credentials</div>
            <p style={{ fontSize: 13, color: 'var(--lt-muted)', margin: '-8px 0 0', lineHeight: 1.6 }}>
              These documents are private: only the badges display publicly on your profile. Clients cannot view or download the actual files.
            </p>
            <TextField label="ABN / ACN" value={credentials.abn} onChange={e => setCredentials(p => ({ ...p, abn: e.target.value }))} placeholder="12 345 678 901" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { key: 'insurance', label: 'Public Liability Insurance', desc: 'Upload your certificate of currency' },
                { key: 'blue_card', label: 'Blue Card / Working with Children Check', desc: 'Upload your blue card or WWCC' },
                { key: 'police_check', label: 'Police Check', desc: 'Upload your national police certificate' },
                { key: 'wwvp', label: 'Working with Vulnerable People (WWVP)', desc: 'Upload your WWVP card or certificate' },
                { key: 'drone_licence', label: 'CASA Drone Licence / ReOC', desc: 'Upload your Remote Pilot Licence or ReOC certificate' },
                { key: 'other', label: 'Other Credential', desc: 'Any other professional licence or certification' },
              ].map(({ key, label, desc }) => (
                <div key={key} style={{ padding: 16, background: 'var(--lt-surface-2)', border: '1px solid var(--lt-hairline)', borderRadius: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--lt-text)' }}>{label}</div>
                      <div style={{ fontSize: 12, color: 'var(--lt-muted)' }}>{desc}</div>
                    </div>
                    {credentials[`has_${key}`] && (
                      <span style={{ padding: '3px 10px', background: 'rgba(29,185,84,0.14)', borderRadius: 999, fontSize: 11, fontWeight: 700, color: GREEN, whiteSpace: 'nowrap' }}>✓ Uploaded</span>
                    )}
                  </div>
                  {key === 'other' && (
                    <div style={{ marginBottom: 10 }}>
                      <label className="ltep-label" style={{ fontSize: 12 }}>Credential name</label>
                      <input className="ltep-input" value={otherCredentialName} onChange={e => setOtherCredentialName(e.target.value)} placeholder="e.g. CASA Remote Pilot Licence, First Aid Certificate" />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <button type="button" className="ltep-btn ltep-btn-ghost" style={{ padding: '7px 14px', fontSize: 12.5 }} onClick={() => document.getElementById(`cred-${key}`).click()}>
                      {credentials[`has_${key}`] ? 'Replace file' : 'Upload file'}
                    </button>
                    {credentials[`has_${key}`] && (
                      <button type="button" className="ltep-btn ltep-btn-ghost" style={{ padding: '7px 14px', fontSize: 12.5, color: PINK, borderColor: 'rgba(255,45,120,0.4)' }} onClick={() => setCredentials(p => ({ ...p, [`has_${key}`]: false, [`${key}_url`]: null }))}>Remove</button>
                    )}
                    <input id={`cred-${key}`} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadCredential(f, key); e.target.value = '' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'portfolio' && (
          <div style={card}>
            <div style={sectionTitle}>Portfolio</div>
            <p style={{ fontSize: 13, color: 'var(--lt-muted)', margin: '-8px 0 0', lineHeight: 1.6 }}>Photos and videos uploaded here appear on your public profile.</p>
            <div className="ltep-drop" onClick={() => document.getElementById('portfolio-upload').click()}>
              {uploadingPortfolio
                ? portfolioUploadPhase === 'checking' ? 'Checking photos…' : 'Uploading…'
                : '+ Click to upload photos or videos'}
            </div>
            <input id="portfolio-upload" type="file" accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={e => { const f = e.target.files; if (f?.length) void uploadPortfolioFiles(Array.from(f)); e.target.value = '' }} />
            {portfolioItems.length > 0 && (
              <div className="ltep-portfolio-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {portfolioItems.map(item => (
                  <div key={item.id} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '1', background: 'var(--lt-surface-2)' }}>
                    {item.file_type === 'video'
                      ? <video src={item.file_url ?? item.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                      : <img src={item.file_url ?? item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    <button type="button" onClick={() => deletePortfolioItem(item.id)} style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', width: 24, height: 24, color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            {portfolioItems.length === 0 && !uploadingPortfolio && (
              <div style={{ textAlign: 'center', color: 'var(--lt-muted)', fontSize: 13, padding: 20 }}>No portfolio items yet.</div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{saveBtn}</div>
      </div>
    </>
  )
}
