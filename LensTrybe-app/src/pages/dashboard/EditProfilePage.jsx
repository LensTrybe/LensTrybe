import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

const SKILL_TYPES = [
  'Photographer', 'Videographer', 'Drone Pilot', 'Video Editor',
  'Photo Editor', 'Social Media Manager', 'Hair & Makeup Artist', 'UGC Creator'
]

const SPECIALTIES = {
  'Photographer': ['Wedding', 'Portrait', 'Commercial', 'Real Estate', 'Events', 'Fashion', 'Product', 'Sports', 'Street', 'Architecture'],
  'Videographer': ['Wedding', 'Brand Film', 'Documentary', 'Events', 'Music Video', 'Social Media', 'Corporate', 'Sport'],
  'Drone Pilot': ['Real Estate', 'Cinematic', 'Surveying', 'Events', 'Agriculture', 'Construction', 'Infrastructure'],
  'Video Editor': ['Colour Grading', 'Short-form/Reels', 'Wedding Films', 'VFX', 'Motion Graphics', 'Corporate', 'Music Video'],
  'Photo Editor': ['Retouching', 'Culling', 'Compositing', 'Product Editing', 'Restoration', 'Fashion'],
  'Social Media Manager': ['Instagram & TikTok', 'Reels & Short-form', 'Brand Content', 'Content Strategy', 'YouTube Management', 'LinkedIn', 'Facebook & Meta'],
  'Hair & Makeup Artist': ['Bridal & Wedding', 'Editorial & Fashion', 'Commercial', 'Film & TV', 'Portrait & Headshots', 'Special Effects', 'Hair Styling', 'Airbrush', 'Natural & Lifestyle', 'Events'],
  'UGC Creator': ['E-commerce & Product', 'App & Software', 'Food & Beverage', 'Beauty & Skincare', 'Health & Fitness', 'Travel & Lifestyle', 'Fashion & Apparel', 'Home & Interiors', 'Unboxing & Reviews', 'Paid Ad Creative'],
}

const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']

export default function EditProfilePage() {
  const { user, profile, fetchUserData } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState('basics')

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
    city: '',
    state: '',
    country: 'Australia',
    skill_types: [],
    specialties: [],
    avatar_url: null,
  })

  useEffect(() => {
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
        city: profile.city ?? '',
        state: profile.state ?? '',
        country: profile.country ?? 'Australia',
        skill_types: profile.skill_types ?? [],
        specialties: profile.specialties ?? [],
        avatar_url: profile.avatar_url ?? null,
      })
      setLoading(false)
    }
  }, [profile])

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

  async function handleAvatarUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`
    await supabase.storage.from('portfolio').upload(path, file, { upsert: true })
    const { data: { publicUrl } } = supabase.storage.from('portfolio').getPublicUrl(path)
    update('avatar_url', publicUrl)
    setUploading(false)
  }

  async function saveProfile() {
    setSaving(true)
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
      city: form.city,
      state: form.state,
      country: form.country,
      skill_types: form.skill_types,
      specialties: form.specialties,
      avatar_url: form.avatar_url,
    }).eq('id', user.id)
    await fetchUserData(user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const availableSpecialties = form.skill_types.flatMap(s => SPECIALTIES[s] ?? [])
  const uniqueSpecialties = [...new Set(availableSpecialties)]

  const styles = {
    page: { display: 'flex', flexDirection: 'column', gap: '32px' },
    pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' },
    title: { fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--text-primary)', fontWeight: 400 },
    subtitle: { fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px' },
    tabs: { display: 'flex', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', width: 'fit-content' },
    tab: (active) => ({ padding: '8px 20px', border: 'none', background: active ? 'var(--bg-overlay)' : 'transparent', color: active ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-ui)', cursor: 'pointer', transition: 'all var(--transition-fast)', fontWeight: active ? 500 : 400 }),
    section: { display: 'flex', flexDirection: 'column', gap: '20px' },
    sectionTitle: { fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    sectionSub: { fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '-12px' },
    row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    card: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' },
    avatarSection: { display: 'flex', alignItems: 'center', gap: '24px' },
    avatar: { width: '80px', height: '80px', borderRadius: 'var(--radius-full)', background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', objectFit: 'cover', flexShrink: 0 },
    avatarPlaceholder: { width: '80px', height: '80px', borderRadius: 'var(--radius-full)', background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', flexShrink: 0 },
    avatarInfo: { display: 'flex', flexDirection: 'column', gap: '8px' },
    avatarName: { fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    skillGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
    skillChip: (selected) => ({ padding: '10px 16px', borderRadius: 'var(--radius-lg)', border: `1px solid ${selected ? 'var(--green)' : 'var(--border-default)'}`, background: selected ? 'var(--green-dim)' : 'var(--bg-elevated)', color: selected ? 'var(--green)' : 'var(--text-secondary)', fontSize: '13px', fontWeight: selected ? 500 : 400, cursor: 'pointer', transition: 'all var(--transition-base)', textAlign: 'center', fontFamily: 'var(--font-ui)' }),
    specialtyWrap: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
    specialtyChip: (selected) => ({ padding: '6px 14px', borderRadius: 'var(--radius-full)', border: `1px solid ${selected ? 'var(--green)' : 'var(--border-default)'}`, background: selected ? 'var(--green-dim)' : 'transparent', color: selected ? 'var(--green)' : 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', transition: 'all var(--transition-base)', fontFamily: 'var(--font-ui)' }),
    textarea: { width: '100%', minHeight: '120px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' },
    select: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', outline: 'none', width: '100%' },
    label: { fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', display: 'block', marginBottom: '6px' },
    actions: { display: 'flex', justifyContent: 'flex-end', gap: '12px' },
  }

  if (loading) return <div style={{ padding: '40px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Loading profile…</div>

  return (
    <div style={styles.page}>
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
        {['basics', 'skills', 'location', 'social'].map(t => (
          <button key={t} style={styles.tab(activeTab === t)} onClick={() => setActiveTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'basics' && (
        <div style={styles.card}>
          <div style={styles.sectionTitle}>Business Details</div>
          <Input label="Business name" value={form.business_name} onChange={e => update('business_name', e.target.value)} placeholder="Golden Hour Studio" />
          <Input label="Tagline" value={form.tagline} onChange={e => update('tagline', e.target.value)} placeholder="Brisbane's most trusted wedding photographer" />
          <div>
            <label style={styles.label}>Bio</label>
            <textarea
              style={styles.textarea}
              value={form.bio}
              onChange={e => update('bio', e.target.value)}
              placeholder="I'm a Brisbane-based wedding photographer with 8 years of experience capturing authentic moments…"
            />
          </div>
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
              <select style={styles.select} value={form.state} onChange={e => update('state', e.target.value)}>
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
          <Input label="Phone (optional)" placeholder="0400 000 000" value={form.phone} onChange={e => update('phone', e.target.value)} />
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
