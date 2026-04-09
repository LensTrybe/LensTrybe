import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useAuthUser from '../../hooks/useAuthUser'
import { supabase } from '../../lib/supabaseClient'

const PAGE = {
  bg: '#0a0a0f',
  text: 'rgb(242, 242, 242)',
  label: '#888',
  accent: '#39ff14',
  card: '#13131a',
  cardBorder: '1px solid #1e1e1e',
  inputBg: '#1a1a24',
  inputBorder: '1px solid #202027',
  subtitle: '#666',
  helper: '#666',
  muted: '#555',
}

const font = { fontFamily: 'Inter, sans-serif' }

const SKILL_TYPES = [
  { key: 'Photographer', label: 'Photographer', emoji: '📷' },
  { key: 'Videographer', label: 'Videographer', emoji: '🎬' },
  { key: 'Drone Pilot', label: 'Drone Pilot', emoji: '🚁' },
  { key: 'Video Editor', label: 'Video Editor', emoji: '🎞️' },
  { key: 'Photo Editor', label: 'Photo Editor', emoji: '🖼️' },
  { key: 'Social Media Manager', label: 'Social Media Manager', emoji: '📱' },
  { key: 'Hair and Makeup Artist', label: 'Hair and Makeup Artist', emoji: '💄' },
  { key: 'UGC Creator', label: 'UGC Creator', emoji: '🎥' },
]

const PHOTOGRAPHER_SPECIALTIES = [
  'Architecture',
  'Automotive',
  'Boudoir',
  'Commercial',
  'Corporate/Headshots',
  'Events',
  'Fashion',
  'Food',
  'Maternity',
  'Pets',
  'Portrait',
  'Product',
  'Real Estate',
  'Schools & Education',
  'Sports',
  'Street',
  'Wedding',
]

const SPECIALTIES_BY_TYPE = {
  Photographer: PHOTOGRAPHER_SPECIALTIES,
  Videographer: ['Wedding', 'Brand Film', 'Documentary', 'Events', 'Music Video', 'Social Media', 'Corporate', 'Sport'],
  'Drone Pilot': ['Real Estate', 'Cinematic', 'Surveying', 'Events', 'Agriculture', 'Construction', 'Infrastructure'],
  'Video Editor': ['Colour Grading', 'Short-form/Reels', 'Wedding Films', 'VFX', 'Motion Graphics', 'Corporate', 'Music Video'],
  'Photo Editor': ['Retouching', 'Culling', 'Compositing', 'Product Editing', 'Restoration', 'Fashion'],
  'Social Media Manager': [
    'Instagram & TikTok',
    'Reels & Short-form',
    'Brand Content',
    'Content Strategy',
    'Content Scheduling',
    'Visual Storytelling',
    'YouTube Management',
    'LinkedIn Visual Content',
    'Facebook & Meta Content',
  ],
  'Hair and Makeup Artist': [
    'Bridal & Wedding',
    'Editorial & Fashion',
    'Commercial & Advertising',
    'Film & TV',
    'Portrait & Headshots',
    'Special Effects SFX',
    'Hair Styling',
    'Airbrush',
    'Natural & Lifestyle',
    'Events & Occasions',
  ],
  'UGC Creator': [
    'E-commerce & Product',
    'App & Software Demos',
    'Food & Beverage',
    'Beauty & Skincare',
    'Health & Fitness',
    'Travel & Lifestyle',
    'Fashion & Apparel',
    'Home & Interiors',
    'Pet Products',
    'Unboxing & Reviews',
    'Paid Ad Creative',
    'Testimonial Style',
  ],
}

const COUNTRIES = [
  'Australia',
  'United States',
  'Canada',
  'United Kingdom',
  'New Zealand',
  'Ireland',
  'Germany',
  'France',
  'Spain',
  'Italy',
  'Netherlands',
  'Sweden',
  'Norway',
  'Denmark',
  'South Africa',
  'India',
  'Singapore',
  'Philippines',
  'Indonesia',
  'Japan',
  'South Korea',
  'Brazil',
  'Mexico',
]

const labelStyle = {
  color: PAGE.label,
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 8,
  display: 'block',
  ...font,
}

const helperStyle = {
  color: PAGE.helper,
  fontSize: 12,
  marginTop: 8,
  lineHeight: 1.45,
  ...font,
}

const focusHandlers = {
  onFocus: (e) => {
    e.currentTarget.style.borderColor = PAGE.accent
  },
  onBlur: (e) => {
    e.currentTarget.style.borderColor = '#202027'
  },
}

const controlStyle = {
  background: PAGE.inputBg,
  border: PAGE.inputBorder,
  borderRadius: 8,
  padding: '12px 14px',
  color: PAGE.text,
  ...font,
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
  fontSize: 14,
}

function skillPillStyle(active) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    justifyContent: 'flex-start',
    boxSizing: 'border-box',
    minHeight: 52,
    padding: '12px 16px',
    background: active ? '#1e2a1e' : PAGE.inputBg,
    border: active ? `1px solid ${PAGE.accent}` : PAGE.inputBorder,
    color: active ? PAGE.accent : PAGE.label,
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    userSelect: 'none',
    ...font,
    textAlign: 'left',
  }
}

function specialtyTagStyle(active) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 14px',
    borderRadius: 9999,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    userSelect: 'none',
    ...font,
    background: active ? '#1e2a1e' : PAGE.inputBg,
    border: active ? `1px solid ${PAGE.accent}` : PAGE.inputBorder,
    color: active ? PAGE.accent : PAGE.label,
  }
}

function sectionHeadingStyle() {
  return {
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 20,
    borderLeft: `3px solid ${PAGE.accent}`,
    paddingLeft: 10,
    lineHeight: 1.3,
    ...font,
  }
}

function cardShell() {
  return {
    background: PAGE.card,
    border: PAGE.cardBorder,
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
    boxSizing: 'border-box',
    ...font,
  }
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string' && item.trim())
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function IconEye({ color }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
      />
      <circle cx={12} cy={12} r={2.75} stroke={color} strokeWidth={1.75} />
    </svg>
  )
}

function IconUpload({ color }) {
  return (
    <svg width={36} height={36} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15V3m0 0 4.5 4.5M12 3 7.5 7.5M3 17.5V19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1.5"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden style={{ marginRight: 8 }}>
      <path d="M5 12.5l4 4 10-10" stroke="#000" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function EditProfilePage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuthUser()
  const [formState, setFormState] = useState({
    business_name: '',
    business_email: '',
    tagline: '',
    bio: '',
    years_experience: '',

    country: 'Australia',
    state: '',
    city: '',

    website: '',
    instagram_url: '',
    tiktok_url: '',
    linkedin_url: '',
    facebook_url: '',

    avatar_url: '',
    cover_url: '',

    location: '',
    phone: '',
  })
  const [skillTypes, setSkillTypes] = useState([])
  const [specialtiesByType, setSpecialtiesByType] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [uploading, setUploading] = useState({ avatar: false, cover: false })
  const avatarInputRef = useRef(null)
  const coverInputRef = useRef(null)

  const allSpecialties = useMemo(() => {
    const out = []
    for (const values of Object.values(specialtiesByType)) {
      if (Array.isArray(values)) out.push(...values)
    }
    return Array.from(new Set(out))
  }, [specialtiesByType])

  useEffect(() => {
    const loadProfile = async () => {
      if (!supabase) {
        setLoading(false)
        return
      }

      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData?.user?.id) {
        setErrorMessage(authError?.message ?? 'Not signed in.')
        setLoading(false)
        return
      }

      const userId = authData.user.id
      setLoading(true)
      setErrorMessage('')

      const { data: row, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        setErrorMessage(error.message)
        setLoading(false)
        return
      }

      if (row) {
        const legacySkillKey = { 'Hair & Makeup Artist': 'Hair and Makeup Artist' }
        const loadedSkillTypes = normalizeStringArray(row.skill_types ?? row.skills).map(
          (k) => legacySkillKey[k] || k,
        )
        const loadedSpecialties = normalizeStringArray(row.specialties)
        const loadedSpecialtiesByType = {}
        for (const type of loadedSkillTypes) loadedSpecialtiesByType[type] = []

        if (row.specialties_by_type && typeof row.specialties_by_type === 'object') {
          for (const [k, v] of Object.entries(row.specialties_by_type)) {
            const nk = legacySkillKey[k] || k
            loadedSpecialtiesByType[nk] = normalizeStringArray(v)
          }
        } else if (loadedSpecialties.length && loadedSkillTypes[0]) {
          loadedSpecialtiesByType[loadedSkillTypes[0]] = loadedSpecialties
        }

        setFormState((current) => ({
          ...current,
          business_name: row.business_name ?? '',
          business_email: row.business_email ?? '',
          tagline: row.tagline ?? '',
          bio: row.bio ?? '',
          years_experience:
            row.years_experience !== undefined && row.years_experience !== null
              ? String(row.years_experience)
              : '',

          country: row.country || 'Australia',
          state: row.state ?? row.state_region ?? row.region ?? '',
          city: row.city ?? '',

          website: row.website ?? '',
          instagram_url: row.instagram_url ?? row.instagram ?? '',
          tiktok_url: row.tiktok_url ?? row.tiktok ?? '',
          linkedin_url: row.linkedin_url ?? row.linkedin ?? '',
          facebook_url: row.facebook_url ?? row.facebook ?? '',

          avatar_url: row.avatar_url ?? '',
          cover_url: row.cover_url ?? '',

          location: row.location ?? '',
          phone: row.phone ?? '',
        }))
        setSkillTypes(loadedSkillTypes)
        setSpecialtiesByType(loadedSpecialtiesByType)
      } else {
        setFormState((current) => ({
          ...current,
          business_name: '',
          business_email: '',
          tagline: '',
          bio: '',
          years_experience: '',
          country: 'Australia',
          state: '',
          city: '',
          website: '',
          instagram_url: '',
          tiktok_url: '',
          linkedin_url: '',
          facebook_url: '',
          avatar_url: '',
          cover_url: '',
          location: '',
          phone: '',
        }))
        setSkillTypes([])
        setSpecialtiesByType({})
      }

      setLoading(false)
    }

    if (!authLoading) {
      loadProfile()
    }
  }, [authLoading, user?.id])

  const handleFieldChange = (event) => {
    const { name, value } = event.target
    setFormState((current) => ({ ...current, [name]: value }))
  }

  const handleSkillTypeToggle = (skillType) => {
    setSkillTypes((current) => {
      if (current.includes(skillType)) {
        setSpecialtiesByType((prev) => {
          const copy = { ...prev }
          delete copy[skillType]
          return copy
        })
        return current.filter((item) => item !== skillType)
      }
      if (current.length >= 8) return current
      setSpecialtiesByType((prev) => ({ ...prev, [skillType]: prev[skillType] ?? [] }))
      return [...current, skillType]
    })
  }

  const handleSpecialtyToggle = (skillType, specialty) => {
    setSpecialtiesByType((current) => {
      const existing = Array.isArray(current?.[skillType]) ? current[skillType] : []
      const next = existing.includes(specialty)
        ? existing.filter((x) => x !== specialty)
        : [...existing, specialty]
      return { ...current, [skillType]: next }
    })
  }

  const uploadImage = async (file, field) => {
    if (!supabase || !file) return

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user?.id) {
      setErrorMessage(authError?.message ?? 'Not signed in.')
      return
    }

    const userId = authData.user.id
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData?.session) {
      setErrorMessage('Please sign in again to upload images.')
      return
    }

    let bucket = 'covers'
    let objectKey = `${userId}/cover-${Date.now()}`
    if (field === 'avatar') {
      const ext = String(file.name).split('.').pop() || 'png'
      bucket = 'avatars'
      objectKey = `${userId}/avatar-${Date.now()}.${ext}`
    }

    setUploading((p) => ({ ...p, [field]: true }))
    setErrorMessage('')
    try {
      const { error } = await supabase.storage.from(bucket).upload(objectKey, file, { upsert: true })
      if (error) {
        setErrorMessage(error.message)
        return
      }
      const { data } = supabase.storage.from(bucket).getPublicUrl(objectKey)
      setFormState((p) => ({ ...p, [field === 'avatar' ? 'avatar_url' : 'cover_url']: data.publicUrl }))
    } finally {
      setUploading((p) => ({ ...p, [field]: false }))
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSuccessMessage('')

    if (!supabase) {
      setErrorMessage('Supabase is not configured.')
      return
    }

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user?.id) {
      setErrorMessage(authError?.message ?? 'Could not resolve current user.')
      return
    }

    const userId = authData.user.id
    setSaving(true)
    setErrorMessage('')

    const payload = {
      id: userId,
      business_name: formState.business_name || null,
      business_email: formState.business_email || null,
      tagline: formState.tagline || null,
      bio: formState.bio || null,
      years_experience: formState.years_experience ? Number(formState.years_experience) : null,
      country: formState.country || null,
      state: formState.state || null,
      city: formState.city || null,
      phone: formState.phone || null,
      website: formState.website || null,
      instagram_url: formState.instagram_url || null,
      tiktok_url: formState.tiktok_url || null,
      linkedin_url: formState.linkedin_url || null,
      facebook_url: formState.facebook_url || null,
      avatar_url: formState.avatar_url || null,
      cover_url: formState.cover_url || null,
      skill_types: skillTypes,
      specialties: allSpecialties,
      skills: skillTypes,
    }

    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })

    if (error) {
      setErrorMessage(error.message)
    } else {
      setSuccessMessage('Profile saved successfully.')
    }

    setSaving(false)
  }

  const shellStyle = {
    background: PAGE.bg,
    color: PAGE.text,
    minHeight: '100%',
    padding: '24px 28px 40px',
    boxSizing: 'border-box',
    ...font,
  }

  const innerStyle = {
    maxWidth: 820,
    margin: '0 auto',
  }

  const viewProfileHref = user?.id ? `/portfolio/${user.id}` : '/dashboard'

  if (authLoading || loading) {
    return (
      <section style={shellStyle}>
        <div style={innerStyle}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              marginBottom: 28,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ color: PAGE.accent, fontSize: 13, fontWeight: 600, ...font }}>← Back</span>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#fff', ...font }}>Edit Profile</h1>
            </div>
          </div>
          <p style={{ margin: 0, color: PAGE.muted, fontSize: 14, ...font }}>Loading profile…</p>
        </div>
      </section>
    )
  }

  return (
    <section style={shellStyle}>
      <div style={innerStyle}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 28,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                color: PAGE.accent,
                fontSize: 14,
                fontWeight: 600,
                ...font,
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }} aria-hidden>
                ←
              </span>
              Back
            </button>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', ...font }}>
              Edit Profile
            </h1>
          </div>
          <Link
            to={viewProfileHref}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              color: PAGE.label,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              ...font,
            }}
          >
            <IconEye color={PAGE.label} />
            View Profile
          </Link>
        </header>

        <form onSubmit={handleSubmit}>
          <div style={cardShell()}>
            <div style={sectionHeadingStyle()}>Basic Information</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={labelStyle} htmlFor="business_name">
                  Business Name *
                </label>
                <input
                  id="business_name"
                  name="business_name"
                  value={formState.business_name}
                  onChange={handleFieldChange}
                  style={controlStyle}
                  type="text"
                  required
                  {...focusHandlers}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="business_email">
                  Business Email
                </label>
                <input
                  id="business_email"
                  name="business_email"
                  value={formState.business_email}
                  onChange={handleFieldChange}
                  style={controlStyle}
                  type="email"
                  {...focusHandlers}
                />
                <div style={helperStyle}>
                  Used as the reply-to address on invoices, quotes and contracts sent to clients.
                </div>
              </div>

              <div>
                <label style={labelStyle} htmlFor="tagline">
                  Tagline
                </label>
                <input
                  id="tagline"
                  name="tagline"
                  value={formState.tagline}
                  onChange={handleFieldChange}
                  style={controlStyle}
                  type="text"
                  {...focusHandlers}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="bio">
                  Bio
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  value={formState.bio}
                  onChange={handleFieldChange}
                  style={{ ...controlStyle, minHeight: 120, resize: 'vertical' }}
                  {...focusHandlers}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="years_experience">
                  Years of Experience
                </label>
                <input
                  id="years_experience"
                  name="years_experience"
                  value={formState.years_experience}
                  onChange={handleFieldChange}
                  style={controlStyle}
                  type="number"
                  min={0}
                  {...focusHandlers}
                />
              </div>
            </div>
          </div>

          <div style={cardShell()}>
            <div style={sectionHeadingStyle()}>Skills &amp; Specialties</div>
            <div style={{ marginBottom: 22 }}>
              <span style={{ ...labelStyle, marginBottom: 12 }}>Skill Types (up to 8)</span>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 12,
                }}
              >
                {SKILL_TYPES.map((t) => {
                  const active = skillTypes.includes(t.key)
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => handleSkillTypeToggle(t.key)}
                      style={skillPillStyle(active)}
                    >
                      <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>
                        {t.emoji}
                      </span>
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              {skillTypes.length === 0 ? (
                <div style={{ ...helperStyle, marginTop: 0 }}>Select skill types above to choose specialties.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                  {skillTypes.map((skillType) => {
                    const options = SPECIALTIES_BY_TYPE[skillType] || []
                    const selected = specialtiesByType?.[skillType] || []
                    return (
                      <div key={skillType}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: '#fff',
                            marginBottom: 12,
                            ...font,
                          }}
                        >
                          Specialties: {skillType}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                          {options.map((s) => {
                            const active = selected.includes(s)
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => handleSpecialtyToggle(skillType, s)}
                                style={specialtyTagStyle(active)}
                              >
                                {s}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div style={cardShell()}>
            <div style={sectionHeadingStyle()}>Location</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={labelStyle} htmlFor="country">
                  Country
                </label>
                <select
                  id="country"
                  name="country"
                  value={formState.country}
                  onChange={handleFieldChange}
                  style={{ ...controlStyle, cursor: 'pointer' }}
                  {...focusHandlers}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c} style={{ background: PAGE.inputBg, color: PAGE.text }}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle} htmlFor="state">
                  State
                </label>
                <input
                  id="state"
                  name="state"
                  value={formState.state}
                  onChange={handleFieldChange}
                  style={controlStyle}
                  type="text"
                  {...focusHandlers}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="city">
                  City
                </label>
                <input
                  id="city"
                  name="city"
                  value={formState.city}
                  onChange={handleFieldChange}
                  style={controlStyle}
                  type="text"
                  {...focusHandlers}
                />
              </div>
            </div>
          </div>

          <div style={cardShell()}>
            <div style={sectionHeadingStyle()}>Social &amp; Web Links</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {[
                { id: 'website', name: 'website', label: 'Website URL' },
                { id: 'instagram_url', name: 'instagram_url', label: 'Instagram URL' },
                { id: 'tiktok_url', name: 'tiktok_url', label: 'TikTok URL' },
                { id: 'linkedin_url', name: 'linkedin_url', label: 'LinkedIn URL' },
                { id: 'facebook_url', name: 'facebook_url', label: 'Facebook URL' },
              ].map((field) => (
                <div key={field.id}>
                  <label style={labelStyle} htmlFor={field.id}>
                    {field.label}
                  </label>
                  <input
                    id={field.id}
                    name={field.name}
                    value={formState[field.name]}
                    onChange={handleFieldChange}
                    style={controlStyle}
                    type="url"
                    placeholder="https://"
                    {...focusHandlers}
                  />
                </div>
              ))}
            </div>
          </div>

          <div style={cardShell()}>
            <div style={sectionHeadingStyle()}>Profile Images</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 20,
              }}
            >
              <div>
                <div style={labelStyle}>Profile Photo</div>
                <div style={helperStyle}>Your personal avatar shown across the platform.</div>
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      if (!uploading.avatar) avatarInputRef.current?.click()
                    }
                  }}
                  onClick={() => {
                    if (!uploading.avatar) avatarInputRef.current?.click()
                  }}
                  style={{
                    marginTop: 12,
                    width: '100%',
                    minHeight: 200,
                    background: PAGE.inputBg,
                    border: '2px dashed #202027',
                    borderRadius: 12,
                    padding: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 14,
                    cursor: uploading.avatar ? 'wait' : 'pointer',
                    color: PAGE.text,
                    boxSizing: 'border-box',
                    ...font,
                  }}
                >
                  {formState.avatar_url ? (
                    <>
                      <img
                        src={formState.avatar_url}
                        alt="Profile preview"
                        style={{
                          width: 140,
                          height: 140,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: PAGE.inputBorder,
                          display: 'block',
                        }}
                      />
                      <span style={{ fontSize: 12, color: PAGE.label, fontWeight: 600 }}>
                        {uploading.avatar ? 'Uploading…' : 'Click to replace'}
                      </span>
                    </>
                  ) : (
                    <>
                      <IconUpload color={PAGE.label} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: PAGE.text }}>Upload profile photo</span>
                      {uploading.avatar ? (
                        <span style={{ fontSize: 12, color: PAGE.muted }}>Uploading…</span>
                      ) : null}
                    </>
                  )}
                </div>
                {formState.avatar_url ? (
                  <button
                    type="button"
                    onClick={() => setFormState((p) => ({ ...p, avatar_url: '' }))}
                    style={{
                      marginTop: 10,
                      background: 'transparent',
                      border: 'none',
                      color: PAGE.label,
                      fontSize: 12,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: 0,
                      ...font,
                    }}
                  >
                    Remove photo
                  </button>
                ) : null}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadImage(file, 'avatar')
                    e.target.value = ''
                  }}
                />
              </div>

              <div>
                <div style={labelStyle}>Cover Image</div>
                <div style={helperStyle}>Large background image shown at the top of your profile.</div>
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      if (!uploading.cover) coverInputRef.current?.click()
                    }
                  }}
                  onClick={() => {
                    if (!uploading.cover) coverInputRef.current?.click()
                  }}
                  style={{
                    marginTop: 12,
                    width: '100%',
                    minHeight: 200,
                    background: PAGE.inputBg,
                    border: '2px dashed #202027',
                    borderRadius: 12,
                    padding: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 14,
                    cursor: uploading.cover ? 'wait' : 'pointer',
                    color: PAGE.text,
                    boxSizing: 'border-box',
                    ...font,
                  }}
                >
                  {formState.cover_url ? (
                    <>
                      <img
                        src={formState.cover_url}
                        alt="Cover preview"
                        style={{
                          width: '100%',
                          maxWidth: '100%',
                          height: 128,
                          borderRadius: 8,
                          objectFit: 'cover',
                          border: PAGE.inputBorder,
                        }}
                      />
                      <span style={{ fontSize: 12, color: PAGE.label, fontWeight: 600 }}>
                        {uploading.cover ? 'Uploading…' : 'Click to replace'}
                      </span>
                    </>
                  ) : (
                    <>
                      <IconUpload color={PAGE.label} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: PAGE.text }}>Upload cover image</span>
                      {uploading.cover ? (
                        <span style={{ fontSize: 12, color: PAGE.muted }}>Uploading…</span>
                      ) : null}
                    </>
                  )}
                </div>
                {formState.cover_url ? (
                  <button
                    type="button"
                    onClick={() => setFormState((p) => ({ ...p, cover_url: '' }))}
                    style={{
                      marginTop: 10,
                      background: 'transparent',
                      border: 'none',
                      color: PAGE.label,
                      fontSize: 12,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: 0,
                      ...font,
                    }}
                  >
                    Remove cover
                  </button>
                ) : null}
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadImage(file, 'cover')
                    e.target.value = ''
                  }}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              width: '100%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: PAGE.accent,
              color: '#000',
              fontWeight: 700,
              borderRadius: 8,
              padding: 14,
              fontSize: 14,
              border: 'none',
              cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.85 : 1,
              marginTop: 4,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              ...font,
            }}
          >
            {saving ? (
              'Saving…'
            ) : (
              <>
                <IconCheck />
                Save Changes
              </>
            )}
          </button>
        </form>

        {successMessage ? (
          <div
            role="status"
            style={{
              marginTop: 18,
              padding: '12px 16px',
              borderRadius: 8,
              border: `1px solid ${PAGE.accent}`,
              background: 'rgba(57, 255, 20, 0.08)',
              color: PAGE.accent,
              fontSize: 14,
              fontWeight: 600,
              ...font,
            }}
          >
            {successMessage}
          </div>
        ) : null}
        {errorMessage ? (
          <div
            style={{
              marginTop: 18,
              padding: '12px 16px',
              borderRadius: 8,
              border: '1px solid rgba(248, 113, 113, 0.5)',
              background: 'rgba(248, 113, 113, 0.08)',
              color: '#f87171',
              fontSize: 14,
              ...font,
            }}
          >
            {errorMessage}
          </div>
        ) : null}
      </div>
    </section>
  )
}
