import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import {
  TYPO,
  LIQUID_GLASS,
  LIQUID_GLASS_CARD,
  LIQUID_FIELD,
} from '../../lib/glassTokensLight'
import { LiquidLensFilter, LiquidPill, LiquidSelect } from '../../components/ui/liquidGlass'
import TileField from '../../components/ui/TileField'

const IconCamera = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>)
const IconVideo = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>)
const IconDrone = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M4 4l4 4m8-4l-4 4m4 8l4 4m-12 0l4-4"/><circle cx="4" cy="4" r="1.5"/><circle cx="20" cy="4" r="1.5"/><circle cx="4" cy="20" r="1.5"/><circle cx="20" cy="20" r="1.5"/></svg>)
const IconEdit = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>)
const IconPhoto = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>)
const IconShare = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>)
const IconMakeup = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>)
const IconPhone = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>)

// Creative types live at launch. The rest join LensTrybe later.
const LAUNCH_SKILLS = ['photographer', 'videographer']

// Four honest statuses instead of one blanket "Coming Soon".
//
// The old page put the same badge on things that already shipped and things that are
// years away, which made the platform look emptier than it is and made every line read
// as a promise. Anything marked live is in the product today. Anything marked exploring
// is an idea, and the legend on the page says so in plain words.
//
// Text colours are darkened from the brand green and pink so small bold type stays
// readable on the light background.
const STATUS = {
  live: { label: 'Available now', colour: '#0E7C3A', bg: 'rgba(29,185,84,0.12)', border: 'rgba(29,185,84,0.35)' },
  building: { label: 'In development', colour: '#9A5B00', bg: 'rgba(234,179,8,0.14)', border: 'rgba(234,179,8,0.42)' },
  planned: { label: 'Planned', colour: '#5B5766', bg: 'rgba(20,17,26,0.05)', border: 'rgba(20,17,26,0.14)' },
  exploring: { label: 'Exploring', colour: '#c11f5a', bg: 'rgba(255,45,120,0.1)', border: 'rgba(255,45,120,0.32)' },
}

const STATUS_ORDER = ['live', 'building', 'planned', 'exploring']

const LEGEND = [
  { key: 'live', text: 'In the platform today.' },
  { key: 'building', text: 'Being built right now.' },
  { key: 'planned', text: 'We will build it. No date yet.' },
  { key: 'exploring', text: 'An idea we are looking at. It may change, or it may not happen.' },
]

function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.planned
  return (
    <span style={{ whiteSpace: 'nowrap', borderRadius: '999px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, color: s.colour, border: `1px solid ${s.border}`, background: s.bg }}>
      {s.label}
    </span>
  )
}

// Things that land for every creative, whatever they shoot.
const PLATFORM_FEATURES = [
  { name: 'Mobile app for iPhone and Android', status: 'building', description: 'Your whole LensTrybe business in your pocket. Take bookings, reply to clients, send invoices and check payments from your phone. In build now.' },
  { name: 'More creative disciplines', status: 'planned', description: 'LensTrybe opens with Photographers and Videographers. Drone Pilots, Video Editors, Photo Editors, Social Media Managers, Hair and Makeup Artists and UGC Creators follow after launch.' },
  { name: 'Two-way calendar sync', status: 'planned', description: 'Connect Google Calendar or Apple Calendar so your LensTrybe availability and your own diary stay in step in both directions. Stop double booking yourself.' },
  { name: 'Creative community feed', status: 'exploring', description: 'A place for creatives on LensTrybe to share work, ask questions and find people to collaborate with. We are still working out what it should be, so tell us.' },
]

const SKILLS = [
  { key: 'photographer', label: 'Photographer', icon: <IconCamera /> },
  { key: 'videographer', label: 'Videographer', icon: <IconVideo /> },
  { key: 'drone_pilot', label: 'Drone Pilot', icon: <IconDrone /> },
  { key: 'video_editor', label: 'Video Editor', icon: <IconEdit /> },
  { key: 'photo_editor', label: 'Photo Editor', icon: <IconPhoto /> },
  { key: 'social_media_manager', label: 'Social Media Manager', icon: <IconShare /> },
  { key: 'hair_makeup_artist', label: 'Hair and Makeup Artist', icon: <IconMakeup /> },
  { key: 'ugc_creator', label: 'UGC Creator', icon: <IconPhone /> },
]

const SKILL_FEATURES = {
  photographer: [
    { name: 'Shot list builder', status: 'live', description: 'Build a shot list on any job as a checklist, tick frames off as you get them, and keep prep lists and gear lists on the same project. Available in your project workspace today.' },
    { name: 'Location scouting notes', status: 'planned', description: 'Save GPS pins, lighting windows, parking and access instructions for every location, then reuse them on future shoots at the same spot.' },
    { name: 'Style questionnaire templates', status: 'planned', description: 'Send a branded pre shoot questionnaire to capture mood, styling and image references. Answers save against the booking so you arrive prepared.' },
    { name: 'Pass selects to a Photo Editor', status: 'planned', description: 'Send your approved selects straight to a Photo Editor on LensTrybe with your notes attached. Arrives once Photo Editors join the platform.' },
    { name: 'Culling tool', status: 'exploring', description: 'Review a full shoot in one workspace and mark each frame Keep, Maybe or Reject. Doing this properly in a browser is a serious piece of work, so we are looking at it rather than promising it.' },
    { name: 'Deposit and balance payment splits', status: 'exploring', description: 'Take a deposit at booking and the balance later, with LensTrybe chasing the second payment. Anything touching payments has to be right first time, so this one is under review.' },
    { name: 'Weather and light window', status: 'planned', description: 'Sunrise, sunset, golden hour and the forecast for the date and place you are shooting, on the booking itself. Stop working it out by hand the night before.' },
    { name: 'Travel and mileage', status: 'planned', description: 'Log the kilometres for a shoot and have them land in Expenses at the ATO rate, ready for your Tax Hub at the end of the financial year.' },
    { name: 'Watermarks and download controls', status: 'planned', description: 'Watermark a proofing gallery, cap how many times a set can be downloaded, and lift both once the client has paid. Proofing and favourites already work, this finishes them.' },
    { name: 'Mini sessions', status: 'exploring', description: 'Publish a day of fixed price, fixed length slots and let clients book and pay themselves. Christmas minis and headshot days without a single back and forth email.' },
    { name: 'Packages catalogue', status: 'exploring', description: 'Set a package up once, with its inclusions and price, then pull it into a quote, an invoice and your public profile. Stop rebuilding the same wedding package every time.' },
    { name: 'Book a second shooter', status: 'exploring', description: 'Need a second shooter for a wedding? Post the day, book another LensTrybe creative, and agree the split up front. The other photographers are already here, so it is a search rather than a group chat.' },
    { name: 'Model and property releases', status: 'exploring', description: 'Send a release to a subject or a venue and have it signed on the day, stored against the shoot. Commercial and stock work needs it, and chasing a signature afterwards never goes well.' },
  ],
  videographer: [
    { name: 'Project timeline tracker', status: 'live', description: 'Move every job through stages you name yourself across pre production, production and post. See your whole slate and spot a schedule risk early. In your Projects board today.' },
    { name: 'Shot list builder', status: 'live', description: 'Build scene by scene shot lists as checklists on the project, with whatever detail the job needs. Available in your project workspace today.' },
    { name: 'Production brief and run sheet', status: 'planned', description: 'One shareable brief with call times, locations, contacts and logistics, published as a run sheet so the whole crew works from the same page on shoot day.' },
    { name: 'Revision round tracker', status: 'planned', description: 'Track each revision cycle with timestamps and change notes, so clients can see what was updated and agreed revision limits hold without an argument.' },
    { name: 'Music licensing log', status: 'planned', description: 'Record every track used on a project with licence type, source and expiry. A clear compliance record before anything is delivered.' },
    { name: 'Weather and light window', status: 'planned', description: 'Sunrise, sunset, golden hour and the forecast for your shoot date and location, on the booking itself, so you can plan the day around the light before you leave the house.' },
    { name: 'Travel and mileage', status: 'planned', description: 'Log the kilometres for a shoot and have them land in Expenses at the ATO rate, ready for your Tax Hub at the end of the financial year.' },
    { name: 'Watermarks and download controls', status: 'planned', description: 'Watermark a review cut, cap how many times a delivery can be downloaded, and lift both once the client has paid.' },
    { name: 'Packages catalogue', status: 'exploring', description: 'Set a package up once, with its inclusions and price, then pull it into a quote, an invoice and your public profile. Stop rebuilding the same production package every time.' },
    { name: 'Book crew for a shoot day', status: 'exploring', description: 'Need a second operator, a sound recordist or someone on lights? Post the day, book another LensTrybe creative, and agree the split up front.' },
    { name: 'Model and property releases', status: 'exploring', description: 'Send a release to talent or a venue and have it signed on the day, stored against the shoot. Commercial work needs it, and chasing a signature afterwards never goes well.' },
  ],
  drone_pilot: [
    { name: 'Gear and battery register', status: 'live', description: 'Log every aircraft, controller and battery with serial numbers and values, track what the kit is worth for insurance, and check gear out to a job. In your Inventory today.' },
    { name: 'Flight log', status: 'planned', description: 'Capture date, site, weather, altitude, aircraft and duration for every mission, and keep a complete operating history you can export.' },
    { name: 'Pre flight checklist', status: 'planned', description: 'Run your own safety checklist against each booking so no step is missed, and keep the completed record attached to the job.' },
    { name: 'Battery cycle tracker', status: 'planned', description: 'Count charge cycles per battery and watch pack health over time, with a nudge when one is due for replacement.' },
    { name: 'Insurance and registration reminders', status: 'planned', description: 'Store policy and registration expiry dates and get reminded before they lapse, so you stay job ready without the last minute scramble.' },
    { name: 'No-fly zone notes', status: 'exploring', description: 'Flag airspace restrictions during planning. Getting this wrong has real consequences for a pilot, so we will only build it if we can do it accurately. Always check CASA yourself.' },
  ],
  video_editor: [
    { name: 'Edit status board', status: 'live', description: 'Move jobs through stages you name yourself, rough cut to colour grade to sound mix to delivered, and see your workload and bottlenecks at a glance. In your Projects board today.' },
    { name: 'Handover checklist', status: 'live', description: 'Keep a final checklist on the project for exports, project files, fonts and proxies, so nothing is missed at signoff. In your project workspace today.' },
    { name: 'Revision round tracker', status: 'planned', description: 'Log every revision round and what changed in each pass, keeping scope clear and reducing arguments about extra edits.' },
    { name: 'Receive rough cut handoff from a Videographer', status: 'planned', description: 'Accept rough cuts from Videographers on LensTrybe with source links and notes attached, so you can start editing without chasing files.' },
    { name: 'Timestamp feedback', status: 'exploring', description: 'Clients leaving comments on exact timecodes in your cut. This needs proper video playback built into the platform, so it is an idea rather than a commitment.' },
  ],
  photo_editor: [
    { name: 'Batch job tracker', status: 'live', description: 'Track every editing job through stages you name yourself, with deadlines and values, so you can prioritise by volume and due date. In your Projects board today.' },
    { name: 'Receive culled selects from a Photographer', status: 'planned', description: 'Get curated selects in one handoff with client instructions and references attached, so you start with the context you need.' },
    { name: 'Client approval workflow', status: 'planned', description: 'Send an edited set for approval with a clear approve or request changes flow, and only deliver once signoff is in.' },
    { name: 'Turnaround time estimator', status: 'planned', description: 'Work out a delivery date from image volume and your usual edit speed, so you set an expectation you can actually meet.' },
    { name: 'Style reference board', status: 'planned', description: 'Attach mood boards and visual references to a job so your look stays aligned with client direction the whole way through.' },
    { name: 'Retouching notes per image', status: 'planned', description: 'Leave precise instructions on individual images instead of one note for the whole job, which cuts repeat revisions.' },
  ],
  social_media_manager: [
    { name: 'Content calendar', status: 'live', description: 'Plan posts by client, platform and campaign in a board or month view, move them through Idea, Draft, Scheduled and Posted, and store captions and hashtags on each one. Assign posts to your team on Expert and Elite.' },
    { name: 'Content ideas board', status: 'live', description: 'Park every idea as it comes to you with notes and platforms, then promote the good ones straight into the calendar. In your dashboard today.' },
    { name: 'Caption library', status: 'planned', description: 'Save your best captions as reusable templates across clients and campaigns. Captions already save on each post, this makes them a library you can pull from.' },
    { name: 'Content approval workflow', status: 'planned', description: 'Send drafts to the client for sign off before anything publishes, and track approvals and requested edits in one place.' },
    { name: 'Monthly reporting card', status: 'planned', description: 'Generate a clean monthly summary with the metrics and highlights that matter, ready to send without building a report by hand.' },
    { name: 'Receive finished gallery from a Photographer', status: 'planned', description: 'Accept delivered galleries from Photographers on LensTrybe and go straight to producing content, with no download and upload loop.' },
    { name: 'Platform performance dashboard', status: 'exploring', description: 'Follower growth, reach and engagement by client and platform in one view. This depends on approval from Meta and TikTok, which is not ours to promise, so it stays an idea for now.' },
  ],
  hair_makeup_artist: [
    { name: 'Client records', status: 'live', description: 'Keep a record for every client with notes, contact details and booking history, so you walk into a repeat appointment knowing exactly what you did last time. In your CRM today.' },
    { name: 'Look book builder', status: 'planned', description: 'Build a visual mood board for each booking and share it before the day, so the look is agreed early and nothing changes at the last minute.' },
    { name: 'Skin and allergy profile', status: 'planned', description: 'Save skin type, sensitivities and product preferences against a client and carry them into every future appointment. Safer service, less asking twice.' },
    { name: 'Product kit log', status: 'planned', description: 'Record every product used on a look, down to shade and finish, so you can recreate it exactly for a follow up booking.' },
    { name: 'Trial and day-of booking flow', status: 'planned', description: 'Handle the trial and the event day as linked but separate appointments, keeping notes, timings and outcomes for both.' },
    { name: 'Artist call time sheet', status: 'planned', description: 'Coordinate several artists with clear call times and roles, so a big wedding or production runs to schedule.' },
  ],
  ugc_creator: [
    { name: 'Brand deal tracker', status: 'live', description: 'Track every deal through stages you name yourself, with the brand in your CRM, deliverable dates and deal value in one place. In your Projects board today.' },
    { name: 'Rate card builder', status: 'planned', description: 'Build a shareable rate card link with packages, inclusions and pricing, so you answer a brand enquiry in one message.' },
    { name: 'Usage rights log', status: 'planned', description: 'Record the agreed usage window, platforms and licensing for each deal, and check your rights before you repost or repurpose anything.' },
    { name: 'Content brief builder', status: 'planned', description: 'Capture objectives, hooks, format requirements and calls to action in a structured brief, so scope is clear before you shoot.' },
    { name: 'Posting schedule tracker', status: 'planned', description: 'See which deliverables are live, scheduled or still pending across every active deal, and stay on top of your commitments.' },
  ],
}

function sortByStatus(list) {
  return [...list].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))
}

const LIVE_COUNT = Object.values(SKILL_FEATURES).flat().filter((f) => f.status === 'live').length

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
  const selectedSkillFeatures = selectedSkill ? sortByStatus(SKILL_FEATURES[selectedSkill] || []) : []

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
      // Goes through submit_feature_request rather than a direct table insert, so the
      // form is validated and rate limited server side. anon has no write access to
      // feature_requests.
      const { error: rpcError } = await supabase.rpc('submit_feature_request', {
        p_business_name: form.business_name,
        p_email: form.email,
        p_skill: form.skill,
        p_feature_request: form.feature_request,
      })
      if (rpcError) throw rpcError
      setSubmitted(true)
      setForm({ business_name: '', email: '', skill: '', feature_request: '' })
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const cardGrid = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '12px' }

  return (
    <div style={{ background: 'transparent', color: 'var(--text-primary)', minHeight: '100dvh', padding: isMobile ? '48px 16px 88px' : '72px 24px 96px', fontFamily: 'var(--font-ui)', ...TYPO.body, position: 'relative', overflow: 'hidden' }}>
      <LiquidLensFilter />
      <TileField animated={false} opacity={0.22} minColumns={isMobile ? 2 : 6} />
      {(
        <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '220px', zIndex: 1, background: 'linear-gradient(180deg, rgba(246,245,243,0.9) 0%, rgba(246,245,243,0.5) 55%, rgba(246,245,243,0) 100%)' }} />
      )}
      <div style={{ maxWidth: '1100px', margin: '0 auto', position: 'relative', zIndex: 2 }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? '36px' : '52px', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--text-primary)' }}>Upcoming Features</h1>
          <p style={{ margin: '14px auto 0', maxWidth: '720px', color: 'var(--text-secondary)', fontSize: '16px', ...TYPO.body }}>
            What is being built, what is planned, and what we are still thinking about. {LIVE_COUNT} of these are already in the platform today.
          </p>
          <LiquidPill
            primary
            style={{ flex: '0 0 auto', display: 'inline-flex', marginTop: '24px', padding: '14px 26px' }}
            onClick={() => document.getElementById('request-feature-form')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Request a Feature
          </LiquidPill>
        </div>

        <div style={{ ...LIQUID_GLASS_CARD, borderRadius: '16px', padding: isMobile ? '16px' : '18px 20px', marginBottom: '40px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: isMobile ? '10px' : '12px 24px' }}>
          {LEGEND.map((item) => (
            <div key={item.key} style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <StatusBadge status={item.key} />
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px', ...TYPO.body }}>{item.text}</span>
            </div>
          ))}
        </div>

        <section style={{ marginBottom: '56px' }}>
          <h2 style={{ fontSize: isMobile ? '26px' : '34px', margin: '0 0 8px', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--text-primary)' }}>Coming to everyone</h2>
          <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', ...TYPO.body }}>Whatever you shoot, these land for every creative on LensTrybe.</p>
          <div style={cardGrid}>
            {sortByStatus(PLATFORM_FEATURES).map((feature) => (
              <div key={feature.name} style={{ ...LIQUID_GLASS_CARD, borderRadius: '16px', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                  <div style={{ fontSize: '16px', ...TYPO.heading }}>{feature.name}</div>
                  <StatusBadge status={feature.status} />
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px', ...TYPO.body }}>{feature.description}</div>
              </div>
            ))}
          </div>
        </section>

        {!selectedSkill ? (
          <section>
            <h2 style={{ fontSize: isMobile ? '26px' : '34px', margin: '0 0 8px', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--text-primary)' }}>Browse by skill</h2>
            <p style={{ margin: '0 0 24px', color: 'var(--text-secondary)', ...TYPO.body }}>Pick your skill to see what is coming for the way you work.</p>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, 1fr)', gap: '12px' }}>
              {SKILLS.map((skill) => (
                <button
                  key={skill.key}
                  type="button"
                  onClick={() => setSelectedSkill(skill.key)}
                  style={{
                    ...LIQUID_GLASS_CARD,
                    borderRadius: '16px',
                    padding: isMobile ? '16px 12px' : '24px 16px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: 'var(--text-primary)',
                    minHeight: isMobile ? '140px' : '160px',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ width: isMobile ? '38px' : '44px', height: isMobile ? '38px' : '44px', borderRadius: '12px', background: '#ffffff', border: '1px solid rgba(20,17,26,0.05)', boxShadow: '0 6px 16px -6px rgba(40,30,60,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: isMobile ? '12px' : '16px', color: 'var(--text-primary)' }}>
                    {skill.icon}
                  </div>
                  <div style={{ fontSize: isMobile ? '14px' : '15px', marginBottom: '4px', lineHeight: 1.35, ...TYPO.heading }}>{skill.label}</div>
                  {!LAUNCH_SKILLS.includes(skill.key) && (
                    <div style={{ marginBottom: '8px' }}><span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 700, color: '#FF2D78', background: 'rgba(255,45,120,0.1)', border: '1px solid rgba(255,45,120,0.3)' }}>Joining after launch</span></div>
                  )}
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: 'auto', ...TYPO.body }}>View features →</div>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section>
            <LiquidPill style={{ flex: '0 0 auto', display: 'inline-flex', marginBottom: '20px', padding: '11px 20px', fontSize: '13px' }} onClick={() => setSelectedSkill(null)}>
              ← Back
            </LiquidPill>

            <h2 style={{ fontSize: isMobile ? '28px' : '38px', margin: '0 0 10px', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--text-primary)' }}>{selectedSkillLabel} tools</h2>
            <p style={{ margin: '0 0 24px', color: 'var(--text-secondary)', ...TYPO.body }}>
              {LAUNCH_SKILLS.includes(selectedSkill)
                ? 'What is in the platform today, and what comes next.'
                : `${selectedSkillLabel}s join LensTrybe after launch. These are the tools being built for them, and some are already in the platform.`}
            </p>

            <div style={cardGrid}>
              {selectedSkillFeatures.map((feature) => (
                <div key={feature.name} style={{ ...LIQUID_GLASS_CARD, borderRadius: '16px', padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                    <div style={{ fontSize: '16px', ...TYPO.heading }}>{feature.name}</div>
                    <StatusBadge status={feature.status} />
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '14px', ...TYPO.body }}>
                    {feature.description}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section id="request-feature-form" style={{ margin: '64px auto 0', maxWidth: '640px' }}>
          <h2 style={{ margin: 0, fontSize: isMobile ? '28px' : '36px', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--text-primary)' }}>Request a Feature</h2>
          <p style={{ margin: '10px 0 24px', color: 'var(--text-secondary)', ...TYPO.body }}>Tell us what would help your workflow most. We read every one.</p>

          <form onSubmit={handleSubmit} style={{ ...LIQUID_GLASS, position: 'relative', zIndex: 1, padding: isMobile ? '20px' : '26px' }}>
            {error ? <div style={{ color: '#c11f5a', marginBottom: '12px', fontSize: '13px', ...TYPO.body }}>{error}</div> : null}
            {submitted ? (
              <div style={{ marginBottom: '12px', color: '#0E7C3A', fontSize: '13px', ...TYPO.body }}>Thanks. Your feature request has been submitted.</div>
            ) : null}

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="Business name"
                value={form.business_name}
                onChange={(e) => set('business_name', e.target.value)}
                maxLength={200}
                style={{ width: '100%', padding: '13px 14px', ...LIQUID_FIELD }}
              />
              <input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                maxLength={320}
                style={{ width: '100%', padding: '13px 14px', ...LIQUID_FIELD }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <LiquidSelect
                value={form.skill}
                onChange={(v) => set('skill', v)}
                ariaLabel="Your skill"
                placeholder="Your skill"
                style={{ flex: '1 1 100%' }}
                options={[{ value: '', label: 'Your skill' }, ...SKILLS.map((skill) => ({ value: skill.label, label: skill.label }))]}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <textarea
                placeholder="Feature request"
                value={form.feature_request}
                onChange={(e) => set('feature_request', e.target.value)}
                rows={5}
                maxLength={3000}
                style={{ width: '100%', padding: '13px 14px', resize: 'vertical', ...LIQUID_FIELD }}
              />
            </div>

            <LiquidPill type="submit" primary disabled={loading} style={{ flex: '0 0 auto', display: 'inline-flex', padding: '14px 26px', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Submitting...' : 'Submit'}
            </LiquidPill>
          </form>
        </section>
      </div>
    </div>
  )
}
