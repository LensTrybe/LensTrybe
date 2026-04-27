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
  photographer: [
    { name: 'Culling Tool', description: 'Review your shoot in one workspace and mark each image as Keep, Maybe or Reject. Add quick notes per frame and export a selects list you can action immediately.' },
    { name: 'Pass selects to a Photo Editor', description: 'Send your approved selects straight to a Photo Editor on LensTrybe with all notes attached. This removes back and forth file sharing and keeps the handoff in one thread.' },
    { name: 'Shot list builder', description: 'Create detailed shot lists with required frames, priorities and client must haves. Share the list with clients before shoot day so everyone is aligned.' },
    { name: 'Booking deposit and balance payment splits', description: 'Set automatic payment rules so clients pay a deposit at booking and the remaining balance later. LensTrybe tracks each stage and sends reminders at the right time.' },
    { name: 'Location scouting notes', description: 'Save GPS pins, lighting windows, parking details and access instructions for every location. Reuse these notes across future shoots to speed up planning.' },
    { name: 'Style questionnaire templates', description: 'Send branded pre shoot questionnaires to capture mood, styling and image references. Responses are stored against the booking so you can prepare with confidence.' },
  ],
  videographer: [
    { name: 'Shot list and run sheet builder', description: 'Build scene by scene shot lists with camera angles, timing and priorities. Publish them as a run sheet for the full crew on shoot day.' },
    { name: 'Production brief builder', description: 'Prepare one shareable brief with call times, locations, contacts and logistics. Keep everyone working from the same source of truth before and during production.' },
    { name: 'Revision round tracker', description: 'Track each revision cycle with timestamps and change notes so clients can see exactly what was updated. Enforce agreed revision limits without confusion.' },
    { name: 'Music licensing log', description: 'Record every track used in a project, including licence type, source and expiry date. Get a clear compliance record before delivery.' },
    { name: 'Project timeline tracker', description: 'Map pre production, production and post production stages with deadlines and owners. Monitor progress across projects and spot schedule risks early.' },
  ],
  drone_pilot: [
    { name: 'Flight log', description: 'Capture flight date, site, weather, altitude, aircraft and duration for every mission. Keep a complete operating history for reporting and audits.' },
    { name: 'CASA compliance checklist', description: 'Run a pre flight checklist linked to each booking so no safety step is missed. Keep a saved compliance trail for every completed job.' },
    { name: 'No-fly zone notes', description: 'Flag location restrictions against CASA no fly and controlled airspace zones during planning. Reduce on site surprises and avoid non compliant flights.' },
    { name: 'Battery cycle tracker', description: 'Track charge cycles by battery and monitor pack health over time. Receive alerts when a battery is nearing replacement thresholds.' },
    { name: 'Insurance expiry reminders', description: 'Store policy and registration expiries in your profile and receive reminders before they lapse. Stay job ready without last minute admin stress.' },
  ],
  video_editor: [
    { name: 'Timestamp feedback', description: 'Clients can leave comments directly on exact timecodes in your cut. You can jump to each note instantly and resolve feedback faster.' },
    { name: 'Revision round tracker', description: 'Log every revision round and document what changed in each pass. Keep project scope clear and reduce disputes around extra edits.' },
    { name: 'Edit status board', description: 'Move jobs through stages like rough cut, colour grade, sound mix, final and delivered. See workload and bottlenecks at a glance.' },
    { name: 'Project file handover checklist', description: 'Run a final checklist for exports, project files, fonts and proxies before signoff. Ensure nothing is missed when handing over to clients or teams.' },
    { name: 'Receive rough cut handoff from a Videographer', description: 'Accept rough cuts from Videographers on LensTrybe with source links and notes attached. Start editing immediately without chasing files across tools.' },
  ],
  photo_editor: [
    { name: 'Receive culled selects handoff from a Photographer', description: 'Receive curated selects from Photographers in one handoff with client instructions and references. Begin edits quickly with all required context in place.' },
    { name: 'Batch job tracker', description: 'Track image counts, completion percentage and deadlines across active editing jobs. Prioritise work based on volume and due date.' },
    { name: 'Turnaround time estimator', description: 'Estimate delivery dates automatically from image volume and your typical edit speed. Set realistic client expectations before work starts.' },
    { name: 'Style reference board', description: 'Attach mood boards and visual references to each job for consistent results. Keep your look aligned with client direction throughout the edit.' },
    { name: 'Retouching notes per image', description: 'Add precise retouching instructions to individual images instead of broad job level notes. Reduce ambiguity and avoid repeat revisions.' },
    { name: 'Client approval workflow', description: 'Send edited sets for approval with a clear approve or request changes flow. Final delivery only proceeds once signoff is complete.' },
  ],
  social_media_manager: [
    { name: 'Content calendar', description: 'Plan posts across channels in a single calendar view by client, platform and campaign. Keep scheduling organised across the entire month.' },
    { name: 'Content approval workflow', description: 'Send draft content to clients for sign off before publishing. Track approvals and requested edits in one place.' },
    { name: 'Platform performance dashboard', description: 'View follower growth, reach and engagement by client and platform. Spot trends quickly without switching between native apps.' },
    { name: 'Caption library', description: 'Store high performing caption templates and reuse them across campaigns. Save time while keeping brand voice consistent.' },
    { name: 'Monthly reporting card', description: 'Generate a clean monthly performance summary with key metrics and highlights. Share client ready updates without manual report building.' },
    { name: 'Receive finished gallery handoff from a Photographer', description: 'Accept delivered galleries from Photographers directly on LensTrybe for content production. Move from shoot to posting without download and upload loops.' },
  ],
  hair_makeup_artist: [
    { name: 'Look book builder', description: 'Build visual mood boards for each booking and share them with clients before the day. Confirm style expectations early and reduce last minute changes.' },
    { name: 'Client skin and allergy profile', description: 'Save each client profile with skin type, sensitivities and product preferences. Reuse this information for future appointments and safer service.' },
    { name: 'Product kit log', description: 'Record every product used to create each look, including shade and finish details. Recreate results accurately for follow up bookings.' },
    { name: 'Trial vs day-of booking flow', description: 'Manage trial sessions and event day appointments as linked but separate workflows. Keep notes, timings and outcomes organised for both stages.' },
    { name: 'Artist call time sheet', description: 'Coordinate multiple artists with clear call times and role assignments. Keep large weddings and productions running to schedule.' },
  ],
  ugc_creator: [
    { name: 'Brand deal tracker', description: 'Track every active deal with deliverables, due dates and payment status. Keep your pipeline organised from brief to final invoice.' },
    { name: 'Usage rights log', description: 'Record agreed usage windows, platforms and licensing terms for each brand deal. Check rights quickly before repurposing or reposting content.' },
    { name: 'Rate card builder', description: 'Create a shareable rate card link with packages, inclusions and pricing tiers. Send professional quotes faster when brands enquire.' },
    { name: 'Content brief builder', description: 'Capture campaign objectives, hooks, format requirements and CTAs in a structured brief. Generate a clear scope of work before production starts.' },
    { name: 'Posting schedule tracker', description: 'Track whether each deliverable is live, scheduled or pending across ongoing deals. Stay on top of commitments and posting deadlines.' },
  ],
}

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

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
              {selectedSkillFeatures.map((feature) => (
                <div key={feature.name} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 600 }}>{feature.name}</div>
                    <span style={{ borderRadius: '999px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, color: '#1DB954', border: '1px solid rgba(29,185,84,0.35)', background: 'rgba(29,185,84,0.12)' }}>
                      Coming Soon
                    </span>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.58)', fontSize: '14px', lineHeight: 1.6 }}>
                    {feature.description}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section id="request-feature-form" style={{ margin: '64px auto 0', maxWidth: '640px' }}>
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
