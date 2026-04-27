import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const SKILLS = [
  { key: 'photographer', label: 'Photographer', icon: '📷' },
  { key: 'videographer', label: 'Videographer', icon: '🎬' },
  { key: 'drone_pilot', label: 'Drone Pilot', icon: '🚁' },
  { key: 'video_editor', label: 'Video Editor', icon: '✂️' },
  { key: 'photo_editor', label: 'Photo Editor', icon: '🖼️' },
  { key: 'social_media_manager', label: 'Social Media Manager', icon: '📱' },
  { key: 'hair_makeup_artist', label: 'Hair and Makeup Artist', icon: '💄' },
  { key: 'ugc_creator', label: 'UGC Creator', icon: '⭐' },
]

const SKILL_FEATURES = {
  photographer: ['AI client matching', 'Mobile app', 'Automated booking reminders', 'Look book builder', 'Online gallery delivery', 'Recurring billing'],
  videographer: ['AI client matching', 'Mobile app', 'Automated booking reminders', 'Video project tracker', 'Recurring billing', 'Online delivery'],
  drone_pilot: ['AI client matching', 'Mobile app', 'Flight log tracker', 'Automated booking reminders', 'Recurring billing'],
  video_editor: ['AI client matching', 'Mobile app', 'Timestamp feedback tool', 'Project tracker', 'Recurring billing'],
  photo_editor: ['AI client matching', 'Mobile app', 'Batch job tracker', 'Project tracker', 'Recurring billing'],
  social_media_manager: ['AI client matching', 'Mobile app', 'Content calendar integration', 'Brand deal tracker', 'Recurring billing', 'Analytics reporting'],
  hair_makeup_artist: ['AI client matching', 'Mobile app', 'Look book builder', 'Automated booking reminders', 'Recurring billing'],
  ugc_creator: ['AI client matching', 'Mobile app', 'Brand deal tracker', 'Content calendar integration', 'Recurring billing', 'Paid ad performance tracker'],
}

const UNIVERSAL_FEATURES = [
  'Mileage and expense tracking',
  'Tax estimation tools',
  'Referral tracking',
  'UK expansion (Q1 2027)',
  'Mobile app (iOS and Android, Q4 2026)',
]

export default function UpcomingFeaturesPage() {
  const [selectedSkill, setSelectedSkill] = useState(null)
  const [form, setForm] = useState({ business_name: '', email: '', skill: '', feature_request: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const selectedSkillLabel = SKILLS.find((s) => s.key === selectedSkill)?.label
  const selectedSkillFeatures = selectedSkill ? SKILL_FEATURES[selectedSkill] || [] : []

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.business_name || !form.email || !form.skill || !form.feature_request) {
      setError('Please complete all fields.')
      return
    }

    setError('')
    setLoading(true)
    try {
      const { error: insertError } = await supabase.from('feature_requests').insert([form])
      if (insertError) throw insertError
      setSubmitted(true)
      setForm({ business_name: '', email: '', skill: '', feature_request: '' })
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: '#080810', color: '#fff', minHeight: '100vh', padding: isMobile ? '48px 16px 88px' : '72px 24px 96px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? '36px' : '52px', fontWeight: 800, letterSpacing: '-0.02em' }}>Upcoming Features</h1>
          <p style={{ margin: '14px auto 0', maxWidth: '720px', color: 'rgba(255,255,255,0.65)', fontSize: '16px', lineHeight: 1.7 }}>
            See what is coming to LensTrybe and shape the future of the platform.
          </p>
          <button
            type="button"
            onClick={() => document.getElementById('request-feature-form')?.scrollIntoView({ behavior: 'smooth' })}
            style={{
              background: '#1DB954',
              color: '#000',
              border: 'none',
              borderRadius: '100px',
              padding: '14px 28px',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 0 24px rgba(29,185,84,0.35)',
              minHeight: '44px',
              marginTop: '24px',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Request a Feature
          </button>
        </div>

        {!selectedSkill ? (
          <section>
            <h2 style={{ fontSize: isMobile ? '26px' : '34px', margin: '0 0 8px' }}>Browse by Skill</h2>
            <p style={{ margin: '0 0 24px', color: 'rgba(255,255,255,0.55)' }}>Select your skill to see what is coming next.</p>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, 1fr)', gap: '12px' }}>
              {SKILLS.map((skill) => (
                <button
                  key={skill.key}
                  type="button"
                  onClick={() => setSelectedSkill(skill.key)}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px',
                    padding: isMobile ? '16px 12px' : '24px 16px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: '#fff',
                    minHeight: isMobile ? '140px' : '160px',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ width: isMobile ? '36px' : '40px', height: isMobile ? '36px' : '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: isMobile ? '10px' : '14px', fontSize: '18px' }}>
                    {skill.icon}
                  </div>
                  <div style={{ fontSize: isMobile ? '14px' : '15px', fontWeight: 600, marginBottom: '4px', lineHeight: 1.35 }}>{skill.label}</div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginTop: 'auto' }}>View features →</div>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section>
            <button
              type="button"
              onClick={() => setSelectedSkill(null)}
              style={{
                marginBottom: '20px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff',
                borderRadius: '100px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              Back
            </button>

            <h2 style={{ fontSize: isMobile ? '28px' : '38px', margin: '0 0 10px' }}>{selectedSkillLabel} upcoming features</h2>
            <p style={{ margin: '0 0 24px', color: 'rgba(255,255,255,0.55)' }}>Planned features for this skill category.</p>

            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '18px', color: '#1DB954' }}>Universal upcoming features</h3>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                {UNIVERSAL_FEATURES.map((feature) => (
                  <div key={feature} style={{ background: 'rgba(29,185,84,0.08)', border: '1px solid rgba(29,185,84,0.2)', borderRadius: '14px', padding: '14px' }}>
                    <div style={{ fontWeight: 600 }}>{feature}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
              {selectedSkillFeatures.map((feature) => (
                <div key={feature} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 600 }}>{feature}</div>
                    <span style={{ borderRadius: '999px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, color: '#1DB954', border: '1px solid rgba(29,185,84,0.35)', background: 'rgba(29,185,84,0.12)' }}>
                      Coming Soon
                    </span>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.58)', fontSize: '14px', lineHeight: 1.6 }}>
                    This feature is planned to help {selectedSkillLabel.toLowerCase()} run their business more smoothly.
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section id="request-feature-form" style={{ marginTop: '64px', maxWidth: '760px' }}>
          <h2 style={{ margin: 0, fontSize: isMobile ? '28px' : '36px' }}>Request a Feature</h2>
          <p style={{ margin: '10px 0 24px', color: 'rgba(255,255,255,0.55)' }}>Tell us what would help your workflow most.</p>

          <form onSubmit={handleSubmit} style={{ background: '#12111a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: isMobile ? '18px' : '24px' }}>
            {error ? <div style={{ color: '#FF4D8D', marginBottom: '12px', fontSize: '13px' }}>{error}</div> : null}
            {submitted ? (
              <div style={{ marginBottom: '12px', color: '#1DB954', fontSize: '13px' }}>Thanks. Your feature request has been submitted.</div>
            ) : null}

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="Business name"
                value={form.business_name}
                onChange={(e) => set('business_name', e.target.value)}
                style={{ width: '100%', background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '13px 14px', color: '#fff', fontSize: '14px' }}
              />
              <input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                style={{ width: '100%', background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '13px 14px', color: '#fff', fontSize: '14px' }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <select
                value={form.skill}
                onChange={(e) => set('skill', e.target.value)}
                style={{ width: '100%', background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '13px 14px', color: '#fff', fontSize: '14px' }}
              >
                <option value="">Your skill</option>
                {SKILLS.map((skill) => (
                  <option key={skill.key} value={skill.label}>{skill.label}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <textarea
                placeholder="Feature request"
                value={form.feature_request}
                onChange={(e) => set('feature_request', e.target.value)}
                rows={5}
                style={{ width: '100%', background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '13px 14px', color: '#fff', fontSize: '14px', resize: 'vertical' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ background: '#1DB954', color: '#000', border: 'none', borderRadius: '100px', padding: '14px 28px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 24px rgba(29,185,84,0.35)', minHeight: '44px', fontFamily: "'Inter', sans-serif", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
