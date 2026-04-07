import { useEffect, useMemo, useRef, useState } from 'react'
import useAuthUser from '../hooks/useAuthUser'
import { supabase } from '../lib/supabaseClient'

const THEME = {
  pageBg: '#0a0a0f',
  text: 'rgb(242, 242, 242)',
  muted: '#555',
  label: '#888',
  accent: '#39ff14',
  cardBg: '#13131a',
  cardBorder: '1px solid #20202740',
  controlBg: '#1a1a24',
  controlBorder: '1px solid #202027',
}

const SKILL_TYPES = [
  { key: 'Photographer', label: 'Photographer', emoji: '📷' },
  { key: 'Videographer', label: 'Videographer', emoji: '🎥' },
  { key: 'Drone Pilot', label: 'Drone Pilot', emoji: '🛸' },
  { key: 'Video Editor', label: 'Video Editor', emoji: '✂️' },
  { key: 'Photo Editor', label: 'Photo Editor', emoji: '🎛️' },
  { key: 'Social Media Manager', label: 'Social Media Manager', emoji: '📱' },
  { key: 'Hair & Makeup Artist', label: 'Hair & Makeup Artist', emoji: '💄' },
  { key: 'UGC Creator', label: 'UGC Creator', emoji: '🧑‍🎨' },
]

const SPECIALTIES_BY_TYPE = {
  Photographer: ['Weddings', 'Portraits', 'Events', 'Fashion', 'Product', 'Real Estate', 'Brand', 'Sports'],
  Videographer: ['Weddings', 'Events', 'Commercial', 'Music Video', 'Documentary', 'Social Shorts', 'Interviews', 'Brand Film'],
  'Drone Pilot': ['Real Estate', 'Weddings', 'Events', 'Commercial', 'Cinematics', 'Construction', 'Tourism'],
  'Video Editor': ['Short-form', 'Long-form', 'Color grading', 'Sound design', 'Motion graphics', 'Reels/TikTok'],
  'Photo Editor': ['Retouching', 'Color correction', 'Skin retouch', 'Product cleanup', 'Batch editing'],
  'Social Media Manager': ['Content planning', 'Posting & scheduling', 'Community', 'Analytics', 'Paid ads'],
  'Hair & Makeup Artist': ['Bridal', 'Editorial', 'Event glam', 'Natural glam', 'SFX'],
  'UGC Creator': ['Lifestyle', 'Beauty', 'Fitness', 'Food', 'Tech', 'Travel'],
}

const COUNTRIES = [
  'United States',
  'Canada',
  'United Kingdom',
  'Australia',
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
  color: THEME.label,
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 6,
  display: 'block',
}

const controlStyle = {
  background: THEME.controlBg,
  border: THEME.controlBorder,
  borderRadius: 10,
  padding: '10px 14px',
  color: THEME.text,
  fontFamily: 'Inter, sans-serif',
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
}

function pillStyle(active) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: active ? '#1e2a1e' : THEME.controlBg,
    border: active ? `1px solid ${THEME.accent}` : THEME.controlBorder,
    color: active ? THEME.accent : THEME.label,
    borderRadius: 20,
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
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

function EditProfile() {
  const { user, loading: authLoading } = useAuthUser()
  const [formState, setFormState] = useState({
    business_name: '',
    business_email: '',
    tagline: '',
    bio: '',
    years_experience: '',

    country: '',
    state_region: '',
    city: '',

    website: '',
    instagram_url: '',
    tiktok_url: '',
    linkedin_url: '',
    facebook_url: '',

    avatar_url: '',
    cover_url: '',

    // legacy
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
        const loadedSkillTypes = normalizeStringArray(row.skill_types ?? row.skills)
        const loadedSpecialties = normalizeStringArray(row.specialties)
        const loadedSpecialtiesByType = {}
        for (const type of loadedSkillTypes) loadedSpecialtiesByType[type] = []

        if (row.specialties_by_type && typeof row.specialties_by_type === 'object') {
          for (const [k, v] of Object.entries(row.specialties_by_type)) {
            loadedSpecialtiesByType[k] = normalizeStringArray(v)
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

          country: row.country ?? '',
          state_region: row.state_region ?? row.state ?? row.region ?? '',
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
          country: '',
          state_region: '',
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
    const ext = String(file.name).split('.').pop() || 'png'
    const objectKey = `${userId}/${field}-${Date.now()}.${ext}`

    setUploading((p) => ({ ...p, [field]: true }))
    setErrorMessage('')
    try {
      const { error } = await supabase.storage.from('avatars').upload(objectKey, file, { upsert: true })
      if (error) {
        setErrorMessage(error.message)
        return
      }
      const { data } = supabase.storage.from('avatars').getPublicUrl(objectKey)
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

    const locationString = [formState.city, formState.state_region, formState.country]
      .map((s) => String(s ?? '').trim())
      .filter(Boolean)
      .join(', ')

    const payload = {
      id: userId,
      business_name: formState.business_name || null,
      business_email: formState.business_email || null,
      tagline: formState.tagline || null,
      bio: formState.bio || null,
      years_experience: formState.years_experience ? Number(formState.years_experience) : null,
      country: formState.country || null,
      state_region: formState.state_region || null,
      city: formState.city || null,
      location: locationString || formState.location || null,
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
      specialties_by_type: specialtiesByType,
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

  if (authLoading || loading) {
    return (
      <section
        style={{
          background: THEME.pageBg,
          color: THEME.text,
          minHeight: '100vh',
          padding: 32,
          fontFamily: 'Inter, sans-serif',
          boxSizing: 'border-box',
        }}
      >
        <p style={{ margin: 0 }}>Loading profile…</p>
      </section>
    )
  }

  return (
    <section
      style={{
        background: THEME.pageBg,
        color: THEME.text,
        minHeight: '100vh',
        padding: 32,
        fontFamily: 'Inter, sans-serif',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>Edit Profile</div>
          <div style={{ fontSize: 13, color: THEME.muted, marginTop: 6 }}>
            Update your profile details, specialties, and public-facing links.
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Basic Information */}
          <div
            style={{
              background: THEME.cardBg,
              border: THEME.cardBorder,
              borderRadius: 12,
              padding: 24,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                color: '#fff',
                fontSize: 16,
                fontWeight: 700,
                marginBottom: 16,
                borderLeft: `3px solid ${THEME.accent}`,
                paddingLeft: 10,
              }}
            >
              Basic Information
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
              <div>
                <label style={labelStyle} htmlFor="business_name">Business Name</label>
                <input
                  id="business_name"
                  name="business_name"
                  value={formState.business_name}
                  onChange={handleFieldChange}
                  style={controlStyle}
                  type="text"
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="business_email">Business Email</label>
                <input
                  id="business_email"
                  name="business_email"
                  value={formState.business_email}
                  onChange={handleFieldChange}
                  style={controlStyle}
                  type="email"
                />
                <div style={{ marginTop: 8, fontSize: 12, color: THEME.muted }}>
                  Used as the reply-to address on invoices, quotes and contracts
                </div>
              </div>

              <div>
                <label style={labelStyle} htmlFor="tagline">Tagline</label>
                <input
                  id="tagline"
                  name="tagline"
                  value={formState.tagline}
                  onChange={handleFieldChange}
                  style={controlStyle}
                  type="text"
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="bio">Bio</label>
                <textarea
                  id="bio"
                  name="bio"
                  value={formState.bio}
                  onChange={handleFieldChange}
                  style={{ ...controlStyle, minHeight: 120, resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="years_experience">Years of Experience</label>
                <input
                  id="years_experience"
                  name="years_experience"
                  value={formState.years_experience}
                  onChange={handleFieldChange}
                  style={controlStyle}
                  type="number"
                  min={0}
                />
              </div>
            </div>
          </div>

          {/* Skills & Specialties */}
          <div
            style={{
              background: THEME.cardBg,
              border: THEME.cardBorder,
              borderRadius: 12,
              padding: 24,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                color: '#fff',
                fontSize: 16,
                fontWeight: 700,
                marginBottom: 16,
                borderLeft: `3px solid ${THEME.accent}`,
                paddingLeft: 10,
              }}
            >
              Skills & Specialties
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={labelStyle}>Skill Types</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {SKILL_TYPES.map((t) => {
                  const active = skillTypes.includes(t.key)
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => handleSkillTypeToggle(t.key)}
                      style={pillStyle(active)}
                    >
                      <span aria-hidden="true">{t.emoji}</span>
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <div style={labelStyle}>Specialties</div>
              {skillTypes.length === 0 ? (
                <div style={{ fontSize: 13, color: THEME.muted }}>
                  Select one or more skill types to choose specialties.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 14 }}>
                  {skillTypes.map((skillType) => {
                    const options = SPECIALTIES_BY_TYPE[skillType] || []
                    const selected = specialtiesByType?.[skillType] || []
                    return (
                      <div key={skillType} style={{ paddingTop: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 10 }}>
                          {skillType}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                          {options.map((s) => {
                            const active = selected.includes(s)
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => handleSpecialtyToggle(skillType, s)}
                                style={pillStyle(active)}
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

          {/* Location */}
          <div
            style={{
              background: THEME.cardBg,
              border: THEME.cardBorder,
              borderRadius: 12,
              padding: 24,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                color: '#fff',
                fontSize: 16,
                fontWeight: 700,
                marginBottom: 16,
                borderLeft: `3px solid ${THEME.accent}`,
                paddingLeft: 10,
              }}
            >
              Location
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
              <div>
                <label style={labelStyle} htmlFor="country">Country</label>
                <select
                  id="country"
                  name="country"
                  value={formState.country}
                  onChange={handleFieldChange}
                  style={controlStyle}
                >
                  <option value="">Select a country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle} htmlFor="state_region">State / Region</label>
                <input
                  id="state_region"
                  name="state_region"
                  value={formState.state_region}
                  onChange={handleFieldChange}
                  style={controlStyle}
                  type="text"
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="city">City</label>
                <input
                  id="city"
                  name="city"
                  value={formState.city}
                  onChange={handleFieldChange}
                  style={controlStyle}
                  type="text"
                />
              </div>
            </div>
          </div>

          {/* Social & Web Links */}
          <div
            style={{
              background: THEME.cardBg,
              border: THEME.cardBorder,
              borderRadius: 12,
              padding: 24,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                color: '#fff',
                fontSize: 16,
                fontWeight: 700,
                marginBottom: 16,
                borderLeft: `3px solid ${THEME.accent}`,
                paddingLeft: 10,
              }}
            >
              Social & Web Links
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
              <div>
                <label style={labelStyle} htmlFor="website">Website URL</label>
                <input id="website" name="website" value={formState.website} onChange={handleFieldChange} style={controlStyle} type="url" />
              </div>
              <div>
                <label style={labelStyle} htmlFor="instagram_url">Instagram URL</label>
                <input id="instagram_url" name="instagram_url" value={formState.instagram_url} onChange={handleFieldChange} style={controlStyle} type="url" />
              </div>
              <div>
                <label style={labelStyle} htmlFor="tiktok_url">TikTok URL</label>
                <input id="tiktok_url" name="tiktok_url" value={formState.tiktok_url} onChange={handleFieldChange} style={controlStyle} type="url" />
              </div>
              <div>
                <label style={labelStyle} htmlFor="linkedin_url">LinkedIn URL</label>
                <input id="linkedin_url" name="linkedin_url" value={formState.linkedin_url} onChange={handleFieldChange} style={controlStyle} type="url" />
              </div>
              <div>
                <label style={labelStyle} htmlFor="facebook_url">Facebook URL</label>
                <input id="facebook_url" name="facebook_url" value={formState.facebook_url} onChange={handleFieldChange} style={controlStyle} type="url" />
              </div>
            </div>
          </div>

          {/* Profile Images */}
          <div
            style={{
              background: THEME.cardBg,
              border: THEME.cardBorder,
              borderRadius: 12,
              padding: 24,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                color: '#fff',
                fontSize: 16,
                fontWeight: 700,
                marginBottom: 16,
                borderLeft: `3px solid ${THEME.accent}`,
                paddingLeft: 10,
              }}
            >
              Profile Images
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <div style={labelStyle}>Profile Photo</div>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  style={{
                    width: '100%',
                    background: THEME.controlBg,
                    border: '2px dashed #202027',
                    borderRadius: 12,
                    padding: 18,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 14,
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: THEME.text,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: '#0f0f14',
                        border: '1px solid #202027',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: THEME.label,
                        fontSize: 18,
                      }}
                      aria-hidden="true"
                    >
                      ⬆️
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#fff', fontSize: 13 }}>
                        {formState.avatar_url ? 'Change profile photo' : 'Upload profile photo'}
                      </div>
                      <div style={{ fontSize: 12, color: THEME.muted, marginTop: 4 }}>
                        PNG or JPG recommended
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: THEME.muted }}>
                    {uploading.avatar ? 'Uploading…' : 'Browse'}
                  </div>
                </button>
                {formState.avatar_url && (
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img
                      src={formState.avatar_url}
                      alt="Profile preview"
                      style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', border: '1px solid #202027' }}
                    />
                    <button
                      type="button"
                      onClick={() => setFormState((p) => ({ ...p, avatar_url: '' }))}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: THEME.label,
                        fontSize: 13,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
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
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  style={{
                    width: '100%',
                    background: THEME.controlBg,
                    border: '2px dashed #202027',
                    borderRadius: 12,
                    padding: 18,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 14,
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: THEME.text,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: '#0f0f14',
                        border: '1px solid #202027',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: THEME.label,
                        fontSize: 18,
                      }}
                      aria-hidden="true"
                    >
                      🖼️
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#fff', fontSize: 13 }}>
                        {formState.cover_url ? 'Change cover image' : 'Upload cover image'}
                      </div>
                      <div style={{ fontSize: 12, color: THEME.muted, marginTop: 4 }}>
                        Wide images look best
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: THEME.muted }}>
                    {uploading.cover ? 'Uploading…' : 'Browse'}
                  </div>
                </button>
                {formState.cover_url && (
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img
                      src={formState.cover_url}
                      alt="Cover preview"
                      style={{ width: 160, height: 64, borderRadius: 12, objectFit: 'cover', border: '1px solid #202027' }}
                    />
                    <button
                      type="button"
                      onClick={() => setFormState((p) => ({ ...p, cover_url: '' }))}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: THEME.label,
                        fontSize: 13,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
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
              background: THEME.accent,
              color: '#000',
              fontWeight: 700,
              borderRadius: 10,
              padding: 14,
              fontSize: 15,
              border: 'none',
              cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.8 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>

      {successMessage && (
        <p
          role="status"
          style={{
            marginTop: 14,
            color: '#22c55e',
            fontWeight: 600,
            maxWidth: 800,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          {successMessage}
        </p>
      )}
      {errorMessage && (
        <p style={{ marginTop: 14, color: '#f87171', maxWidth: 800, marginLeft: 'auto', marginRight: 'auto' }}>
          {errorMessage}
        </p>
      )}
    </section>
  )
}

export default EditProfile
