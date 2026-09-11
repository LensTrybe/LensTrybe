import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'

const GREEN = '#1DB954'
const GREEN_DARK = '#04120a'
const PINK = '#FF2D78'
const TEXT = '#14111a'
const TEXT_MUTED = '#55545f'
const TEXT_FAINT = '#8a8995'

const CATEGORIES = [
  'I am a creative on LensTrybe',
  'I am a client booking a creative',
  'Billing and subscription',
  'Technical issue or bug',
  'Media, partnership or press',
  'Feedback or feature idea',
  'Something else',
]

const FAQS = [
  {
    q: 'What is LensTrybe?',
    a: 'LensTrybe is a no-commission marketplace for Australian visual creatives, starting with photographers and videographers, with more creative types coming soon. Creatives keep everything they charge and pay only a simple monthly subscription.',
  },
  {
    q: 'I am a client. How do I book a creative?',
    a: 'Browse creatives from the Find Creatives page, open a profile you like and send an enquiry. The creative will be in touch to sort out the details with you directly.',
  },
  {
    q: 'How do I join as a creative?',
    a: 'Choose Join as a Creative from the top of the page, pick the plan that suits you and set up your profile. You can start on the free Basic plan and upgrade whenever you are ready.',
  },
  {
    q: 'I did not receive an email from LensTrybe.',
    a: 'Our emails come from noreply@mail.lenstrybe.com. Please check your spam or promotions folder and mark us as safe. If it is still missing, send us a message below.',
  },
]

function StyleBlock() {
  return (
    <style>{`
      .ltps-wrap { max-width: 880px; margin: 0 auto; padding: 48px 20px 72px; font-family: 'Inter', sans-serif; }
      .ltps-card { background: linear-gradient(160deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.62) 100%); border: 1px solid rgba(20,17,26,0.07); border-radius: 20px; padding: 26px 26px; box-shadow: 0 10px 30px -12px rgba(40,30,60,0.16), inset 0 1px 0 rgba(255,255,255,0.85); }
      .ltps-label { display: block; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: ${TEXT_FAINT}; margin: 0 0 6px; }
      .ltps-input, .ltps-select, .ltps-textarea {
        width: 100%; box-sizing: border-box; font-family: inherit; font-size: 14px; color: ${TEXT};
        background: rgba(255,255,255,0.75); border: 1px solid rgba(20,17,26,0.12); border-radius: 10px; padding: 11px 13px; outline: none;
        transition: border-color .15s ease, box-shadow .15s ease;
      }
      .ltps-textarea { resize: vertical; min-height: 150px; line-height: 1.55; }
      .ltps-input:focus, .ltps-select:focus, .ltps-textarea:focus { border-color: ${GREEN}; box-shadow: 0 0 0 3px rgba(29,185,84,0.16); }
      .ltps-select { appearance: none; -webkit-appearance: none; cursor: pointer; }
      .ltps-btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        background: ${GREEN}; color: ${GREEN_DARK}; border: none; border-radius: 10px;
        padding: 12px 24px; font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer;
        transition: filter .15s ease, opacity .15s ease;
      }
      .ltps-btn:hover { filter: brightness(1.06); }
      .ltps-btn:disabled { opacity: 0.55; cursor: default; }
      .ltps-faq { border: 1px solid rgba(20,17,26,0.09); border-radius: 12px; overflow: hidden; background: rgba(255,255,255,0.55); }
      .ltps-faq + .ltps-faq { margin-top: 10px; }
      .ltps-faq-q { width: 100%; text-align: left; background: transparent; border: none; cursor: pointer; padding: 15px 16px; font-family: inherit; font-size: 14px; font-weight: 600; color: ${TEXT}; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .ltps-faq-a { padding: 0 16px 16px; font-size: 13.5px; line-height: 1.6; color: ${TEXT_MUTED}; }
      .ltps-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      @media (max-width: 620px) { .ltps-grid { grid-template-columns: 1fr; } }
    `}</style>
  )
}

function FaqItem({ item }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="ltps-faq">
      <button type="button" className="ltps-faq-q" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>{item.q}</span>
        <span style={{ color: GREEN, fontSize: 18, lineHeight: 1, transform: open ? 'rotate(45deg)' : 'none', transition: 'transform .18s ease' }}>+</span>
      </button>
      {open && <div className="ltps-faq-a">{item.a}</div>}
    </div>
  )
}

export default function PublicSupportPage() {
  const { user, profile } = useAuth()

  const [name, setName] = useState(profile?.business_name || '')
  const [email, setEmail] = useState(profile?.business_email || user?.email || '')
  const [category, setCategory] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!email.trim()) { setError('Please add an email address so we can reply.'); return }
    if (!message.trim()) { setError('Please tell us a little about what you need help with.'); return }
    setSending(true)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('submit-support-ticket', {
        body: {
          name: name.trim(),
          email: email.trim(),
          role: user ? (profile?.account_type || profile?.role || 'member') : 'visitor',
          category,
          subject: subject.trim(),
          message: message.trim(),
          user_id: user?.id || null,
        },
      })
      if (fnErr || !data?.ok) { setError('Something went wrong sending your request. Please try again in a moment.'); setSending(false); return }
      setDone({ ref: data.ref })
    } catch {
      setError('Something went wrong sending your request. Please try again in a moment.')
      setSending(false)
    }
  }

  if (done) {
    return (
      <div className="ltps-wrap">
        <StyleBlock />
        <div className="ltps-card" style={{ textAlign: 'center', padding: '48px 24px', maxWidth: 620, margin: '0 auto' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(29,185,84,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
            <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h2 style={{ margin: '0 0 10px', fontSize: 24, fontWeight: 800, color: TEXT }}>Thanks, we are on it</h2>
          <p style={{ margin: '0 auto', maxWidth: 460, fontSize: 15, lineHeight: 1.6, color: TEXT_MUTED }}>
            Your message has reached the LensTrybe team. We will reply to you at {email} as soon as we can, usually within one business day.
          </p>
          {done.ref && <p style={{ margin: '14px 0 0', fontSize: 13, color: TEXT_FAINT }}>Reference: <span style={{ color: TEXT, fontWeight: 700 }}>#{done.ref}</span></p>}
        </div>
      </div>
    )
  }

  return (
    <div className="ltps-wrap">
      <StyleBlock />

      <div style={{ textAlign: 'center', marginBottom: 30 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: GREEN, marginBottom: 12 }}>Support</div>
        <h1 style={{ margin: '0 0 10px', fontSize: 34, fontWeight: 800, color: TEXT, letterSpacing: '-0.02em' }}>How can we help?</h1>
        <p style={{ margin: '0 auto', maxWidth: 560, fontSize: 15.5, lineHeight: 1.6, color: TEXT_MUTED }}>
          Whether you are a creative, a client or just curious, drop us a line and a real person will get back to you.
        </p>
      </div>

      <div className="ltps-card" style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: TEXT_FAINT, marginBottom: 14 }}>Common questions</div>
        {FAQS.map((f, i) => <FaqItem key={i} item={f} />)}
      </div>

      <div className="ltps-card">
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: TEXT_FAINT, marginBottom: 16 }}>Send us a message</div>
        <form onSubmit={submit}>
          <div className="ltps-grid" style={{ marginBottom: 14 }}>
            <div>
              <label className="ltps-label" htmlFor="ltps-name">Your name</label>
              <input id="ltps-name" className="ltps-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </div>
            <div>
              <label className="ltps-label" htmlFor="ltps-email">Reply-to email</label>
              <input id="ltps-email" className="ltps-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
          </div>

          <div className="ltps-grid" style={{ marginBottom: 14 }}>
            <div>
              <label className="ltps-label" htmlFor="ltps-cat">Category</label>
              <select id="ltps-cat" className="ltps-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Choose a topic (optional)</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="ltps-label" htmlFor="ltps-subj">Subject</label>
              <input id="ltps-subj" className="ltps-input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="A short summary" />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="ltps-label" htmlFor="ltps-msg">How can we help?</label>
            <textarea id="ltps-msg" className="ltps-textarea" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell us what is happening, and include any details that might help us sort it out quickly." />
          </div>

          {error && (
            <div style={{ marginBottom: 14, padding: '11px 14px', borderRadius: 10, background: 'rgba(255,45,120,0.1)', border: `1px solid ${PINK}`, color: PINK, fontSize: 13.5 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <button type="submit" className="ltps-btn" disabled={sending}>
              {sending ? 'Sending…' : 'Send message'}
            </button>
            <span style={{ fontSize: 12.5, color: TEXT_FAINT }}>Or email us directly at support@lenstrybe.com</span>
          </div>
        </form>
      </div>
    </div>
  )
}
