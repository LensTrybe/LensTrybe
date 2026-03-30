import { useEffect, useState } from 'react'
import useAuthUser from '../hooks/useAuthUser'
import { supabase } from '../lib/supabaseClient'

const BG = '#080810'
const ACCENT = '#4ADE80'
const HEADING = '#D946EF'
const TEXT = '#ffffff'

const skillCategories = [
  'Photographer',
  'Videographer',
  'Drone Pilot',
  'Video Editor',
  'Photo Editor',
  'Social Media Manager',
  'Hair & Makeup Artist',
  'UGC Creator',
]

const initialFormState = {
  business_name: '',
  business_email: '',
  tagline: '',
  bio: '',
  years_experience: '',
  location: '',
  phone: '',
  website: '',
}

const inputStyle = {
  width: '100%',
  maxWidth: '32rem',
  padding: '0.65rem 0.85rem',
  borderRadius: '8px',
  border: `1px solid rgba(74, 222, 128, 0.35)`,
  background: 'rgba(255, 255, 255, 0.04)',
  color: TEXT,
  fontSize: '1rem',
  boxSizing: 'border-box',
}

const labelStyle = {
  display: 'block',
  marginBottom: '0.35rem',
  color: 'rgba(255, 255, 255, 0.85)',
  fontSize: '0.9rem',
}

function normalizeSkills(value) {
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
  const [formState, setFormState] = useState(initialFormState)
  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

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
        setFormState({
          business_name: row.business_name ?? '',
          business_email: row.business_email ?? '',
          tagline: row.tagline ?? '',
          bio: row.bio ?? '',
          years_experience:
            row.years_experience !== undefined && row.years_experience !== null
              ? String(row.years_experience)
              : '',
          location: row.location ?? '',
          phone: row.phone ?? '',
          website: row.website ?? '',
        })
        setSkills(normalizeSkills(row.skills))
      } else {
        setFormState(initialFormState)
        setSkills([])
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

  const handleSkillToggle = (skill) => {
    setSkills((current) => {
      if (current.includes(skill)) {
        return current.filter((item) => item !== skill)
      }
      return [...current, skill]
    })
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
      location: formState.location || null,
      phone: formState.phone || null,
      website: formState.website || null,
      skills,
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
      <section style={{ background: BG, color: TEXT, minHeight: '100%', padding: '1.5rem' }}>
        <p style={{ margin: 0 }}>Loading profile…</p>
      </section>
    )
  }

  return (
    <section
      style={{
        background: BG,
        color: TEXT,
        minHeight: '100%',
        padding: '1.5rem 1.5rem 2.5rem',
      }}
    >
      <h1 style={{ color: HEADING, fontSize: '1.75rem', marginTop: 0, marginBottom: '1.25rem' }}>
        Edit Profile
      </h1>

      <form onSubmit={handleSubmit} style={{ maxWidth: '36rem' }}>
        {[
          { id: 'business_name', name: 'business_name', label: 'Business Name', type: 'text' },
          { id: 'business_email', name: 'business_email', label: 'Business Email', type: 'email' },
          { id: 'tagline', name: 'tagline', label: 'Tagline', type: 'text' },
          {
            id: 'bio',
            name: 'bio',
            label: 'Bio',
            type: 'textarea',
          },
          {
            id: 'years_experience',
            name: 'years_experience',
            label: 'Years Experience',
            type: 'number',
            min: 0,
          },
          { id: 'location', name: 'location', label: 'Location', type: 'text' },
          { id: 'phone', name: 'phone', label: 'Phone', type: 'text' },
          { id: 'website', name: 'website', label: 'Website', type: 'text' },
        ].map((field) => (
          <div key={field.name} style={{ marginBottom: '1.1rem' }}>
            <label htmlFor={field.id} style={labelStyle}>
              {field.label}
            </label>
            {field.type === 'textarea' ? (
              <textarea
                id={field.id}
                name={field.name}
                value={formState[field.name]}
                onChange={handleFieldChange}
                rows={4}
                style={{ ...inputStyle, minHeight: '6rem', resize: 'vertical' }}
              />
            ) : (
              <input
                id={field.id}
                name={field.name}
                type={field.type}
                min={field.min}
                value={formState[field.name]}
                onChange={handleFieldChange}
                style={inputStyle}
              />
            )}
          </div>
        ))}

        <div
          style={{
            marginTop: '1.75rem',
            marginBottom: '1.25rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid rgba(217, 70, 239, 0.35)',
          }}
        >
          <h2
            style={{
              color: HEADING,
              fontSize: '1.2rem',
              marginTop: 0,
              marginBottom: '0.85rem',
            }}
          >
            Your Skills
          </h2>
          <div
            style={{
              display: 'grid',
              gap: '0.65rem',
              gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))',
            }}
          >
            {skillCategories.map((skill) => (
              <label
                key={skill}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  color: TEXT,
                  fontSize: '0.95rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={skills.includes(skill)}
                  onChange={() => handleSkillToggle(skill)}
                  style={{
                    width: '1.1rem',
                    height: '1.1rem',
                    accentColor: ACCENT,
                  }}
                />
                {skill}
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{
            marginTop: '0.5rem',
            padding: '0.7rem 1.4rem',
            borderRadius: '8px',
            border: 'none',
            background: ACCENT,
            color: BG,
            fontWeight: 600,
            fontSize: '1rem',
            cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.75 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      {successMessage && (
        <p
          role="status"
          style={{
            marginTop: '1rem',
            color: ACCENT,
            fontWeight: 500,
          }}
        >
          {successMessage}
        </p>
      )}
      {errorMessage && (
        <p style={{ marginTop: '1rem', color: '#f87171' }}>{errorMessage}</p>
      )}
    </section>
  )
}

export default EditProfile
