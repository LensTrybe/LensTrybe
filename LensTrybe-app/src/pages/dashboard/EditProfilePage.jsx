import { useEffect, useState } from 'react'
import useAuthUser from '../../hooks/useAuthUser'
import { supabase } from '../../lib/supabaseClient'
import { findUserRow } from '../../lib/filterRowsForUser'

const skillCategories = [
  'Photography',
  'Videography',
  'Graphic Design',
  'Brand Design',
  'UI/UX Design',
  'Social Media Content',
  'Copywriting',
  'Creative Direction',
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
  specialties: '',
}

function EditProfilePage() {
  const { user, loading: authLoading } = useAuthUser()
  const [profileId, setProfileId] = useState(null)
  const [formState, setFormState] = useState(initialFormState)
  const [skillTypes, setSkillTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const loadProfile = async () => {
      if (!supabase || !user?.id) {
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorMessage('')

      const { data, error } = await supabase.from('profiles').select('*')

      if (error) {
        setErrorMessage(error.message)
        setLoading(false)
        return
      }

      const row = findUserRow(data, user.id)

      if (row) {
        setProfileId(row.id ?? null)
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
          specialties: row.specialties ?? '',
        })

        const rowSkillTypes = Array.isArray(row.skill_types)
          ? row.skill_types
          : typeof row.skill_types === 'string'
            ? row.skill_types
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean)
            : []

        setSkillTypes(rowSkillTypes)
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
    setSkillTypes((current) => {
      if (current.includes(skill)) {
        return current.filter((item) => item !== skill)
      }
      return [...current, skill]
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!supabase || !user?.id) {
      setErrorMessage('Supabase is not configured or user is missing.')
      return
    }

    setSaving(true)
    setMessage('')
    setErrorMessage('')

    const payload = {
      ...formState,
      years_experience: formState.years_experience
        ? Number(formState.years_experience)
        : null,
      skill_types: skillTypes,
      user_id: user.id,
    }

    let response

    if (profileId) {
      response = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', profileId)
        .select('*')
        .maybeSingle()
    } else {
      response = await supabase.from('profiles').insert(payload).select('*').maybeSingle()
    }

    const { data, error } = response

    if (error) {
      setErrorMessage(error.message)
    } else {
      if (data?.id) {
        setProfileId(data.id)
      }
      setMessage('Profile saved.')
    }

    setSaving(false)
  }

  if (authLoading || loading) {
    return <p>Loading profile...</p>
  }

  return (
    <section>
      <h1>Edit Profile</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="business_name">Business Name</label>
          <input
            id="business_name"
            name="business_name"
            value={formState.business_name}
            onChange={handleFieldChange}
          />
        </div>
        <div>
          <label htmlFor="business_email">Business Email</label>
          <input
            id="business_email"
            name="business_email"
            type="email"
            value={formState.business_email}
            onChange={handleFieldChange}
          />
        </div>
        <div>
          <label htmlFor="tagline">Tagline</label>
          <input
            id="tagline"
            name="tagline"
            value={formState.tagline}
            onChange={handleFieldChange}
          />
        </div>
        <div>
          <label htmlFor="bio">Bio</label>
          <textarea id="bio" name="bio" value={formState.bio} onChange={handleFieldChange} />
        </div>
        <div>
          <label htmlFor="years_experience">Years of Experience</label>
          <input
            id="years_experience"
            name="years_experience"
            type="number"
            min="0"
            value={formState.years_experience}
            onChange={handleFieldChange}
          />
        </div>
        <div>
          <label htmlFor="location">Location</label>
          <input
            id="location"
            name="location"
            value={formState.location}
            onChange={handleFieldChange}
          />
        </div>
        <div>
          <label htmlFor="phone">Phone</label>
          <input id="phone" name="phone" value={formState.phone} onChange={handleFieldChange} />
        </div>
        <div>
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            value={formState.website}
            onChange={handleFieldChange}
          />
        </div>
        <fieldset>
          <legend>Skill Types</legend>
          {skillCategories.map((skill) => (
            <label key={skill}>
              <input
                type="checkbox"
                checked={skillTypes.includes(skill)}
                onChange={() => handleSkillToggle(skill)}
              />
              {skill}
            </label>
          ))}
        </fieldset>
        <div>
          <label htmlFor="specialties">Specialties</label>
          <textarea
            id="specialties"
            name="specialties"
            value={formState.specialties}
            onChange={handleFieldChange}
          />
        </div>
        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
      {message && <p>{message}</p>}
      {errorMessage && <p>{errorMessage}</p>}
    </section>
  )
}

export default EditProfilePage
