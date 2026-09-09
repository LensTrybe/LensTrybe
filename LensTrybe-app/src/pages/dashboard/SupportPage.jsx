import { useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'

const GREEN = '#1DB954'
const GREEN_DARK = '#04120a'
const PINK = '#FF2D78'

const CATEGORIES = [
  'Account and login',
  'Billing and subscription',
  'Bookings and clients',
  'Invoices, quotes and contracts',
  'Technical issue or bug',
  'Feedback or feature idea',
  'Something else',
]

const FAQS = [
  {
    q: 'How do I update my billing or change my plan?',
    a: 'Head to Settings, then Subscription. You can move between Basic, Pro, Expert and Elite at any time, and any change takes effect from your next billing date.',
  },
  {
    q: 'A client cannot open my invoice, quote or portal link. What do I do?',
    a: 'Resend the document from the relevant page (Invoicing, Quotes or Deliver) so a fresh link is generated. If it still will not open, send us the client name and the link and we will look into it.',
  },
  {
    q: 'I did not receive an email from LensTrybe.',
    a: 'Our emails come from noreply@mail.lenstrybe.com. Please check your spam or promotions folder and mark us as safe. If it is still missing after a few minutes, let us know below.',
  },
  {
    q: 'How do payouts and commission work?',
    a: 'LensTrybe is no-commission. You keep everything you charge your clients. Your only cost is your monthly subscription.',
  },
  {
    q: 'How quickly will I hear back?',
    a: 'We usually reply within one business day. Founding creatives are always first in the queue.',
  },
]

// Scoped styles for the support page. Defined at module scope so it is never
// re-created inside a render.
function StyleBlock() {
  return (
    <style>{`
      .ltsp-wrap { max-width: 860px; margin: 0 auto; padding: 8px 4px 48px; }
      .ltsp-card { background: var(--lt-surface); border: 1px solid var(--lt-border); border-radius: 16px; padding: 22px 22px; }
      .ltsp-label { display: block; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--lt-faint); margin: 0 0 6px; }
      .ltsp-input, .ltsp-select, .ltsp-textarea {
        width: 100%; box-sizing: border-box; font-family: inherit; font-size: 14px;
        color: var(--lt-text); background: var(--lt-surface-2);
        border: 1px solid var(--lt-border); border-radius: 10px; padding: 11px 13px; outline: none;
        transition: border-color .15s ease, box-shadow .15s ease;
      }
      .ltsp-textarea { resize: vertical; min-height: 140px; line-height: 1.55; }
      .ltsp-input:focus, .ltsp-select:focus, .ltsp-textarea:focus { border-color: ${GREEN}; box-shadow: 0 0 0 3px rgba(29,185,84,0.16); }
      .ltsp-select { appearance: none; -webkit-appearance: none; cursor: pointer; }
      .ltsp-btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        background: ${GREEN}; color: ${GREEN_DARK}; border: none; border-radius: 10px;
        padding: 12px 22px; font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer;
        transition: filter .15s ease, opacity .15s ease;
      }
      .ltsp-btn:hover { filter: brightness(1.06); }
      .ltsp-btn:disabled { opacity: 0.55; cursor: default; }
      .ltsp-faq { border: 1px solid var(--lt-border); border-radius: 12px; overflow: hidden; }
      .ltsp-faq + .ltsp-faq { margin-top: 10px; }
      .ltsp-faq-q {
        width: 100%; text-align: left; background: var(--lt-surface-2); border: none; cursor: pointer;
        padding: 14px 16px; font-family: inherit; font-size: 14px; font-weight: 600; color: var(--lt-text);
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
      }
      .ltsp-faq-a { padding: 0 16px 16px; font-size: 13.5px; line-height: 1.6; color: var(--lt-muted); }
      .ltsp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      @media (max-width: 620px) { .ltsp-grid { grid-template-columns: 1fr; } }
    `}</style>
  )
}

function FaqItem({ item }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="ltsp-faq">
      <button type="button" className="ltsp-faq-q" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>{item.q}</span>
        <span style={{ color: GREEN, fontSize: 18, lineHeight: 1, transform: open ? 'rotate(45deg)' : 'none', transition: 'transform .18s ease' }}>+</span>
      </button>
      {open && <div className="ltsp-faq-a">{item.a}</div>}
    </div>
  )
}

export default function SupportPage() {
  const { user, profile } = useAuth()

  const defaults = useMemo(() => ({
    name: profile?.business_name || '',
    email: profile?.business_email || user?.email || '',
    role: profile?.account_type || profile?.role || 'creative',
  }), [profile, user])

  const [name, setName] = useState(defaults.name)
  const [email, setEmail] = useState(defaults.email)
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
          role: defaults.role,
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
      <div className="ltsp-wrap">
        <StyleBlock />
        <div className="ltsp-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'rgba(29,185,84,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: 'var(--lt-text)' }}>Thanks, we are on it</h2>
          <p style={{ margin: '0 auto 4px', maxWidth: 460, fontSize: 14.5, lineHeight: 1.6, color: 'var(--lt-muted)' }}>
            Your request has reached the LensTrybe team. We will get back to you at {email} as soon as we can, usually within one business day.
          </p>
          {done.ref && <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--lt-faint)' }}>Reference: <span style={{ color: 'var(--lt-text)', fontWeight: 700 }}>#{done.ref}</span></p>}
          <button
            type="button"
            className="ltsp-btn"
            style={{ marginTop: 24 }}
            onClick={() => { setDone(null); setSubject(''); setMessage(''); setCategory(''); setSending(false) }}
          >
            Send another request
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="ltsp-wrap">
      <StyleBlock />

      <div style={{ marginBottom: 22 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800, color: 'var(--lt-text)', letterSpacing: '-0.01em' }}>Help and support</h1>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: 'var(--lt-muted)', maxWidth: 620 }}>
          Stuck on something or spotted a bug? Check the common questions below, or send us a message and a real person will get back to you.
        </p>
      </div>

      <div className="ltsp-card" style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--lt-faint)', marginBottom: 14 }}>Common questions</div>
        {FAQS.map((f, i) => <FaqItem key={i} item={f} />)}
      </div>

      <div className="ltsp-card">
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--lt-faint)', marginBottom: 16 }}>Send us a message</div>
        <form onSubmit={submit}>
          <div className="ltsp-grid" style={{ marginBottom: 14 }}>
            <div>
              <label className="ltsp-label" htmlFor="ltsp-name">Your name</label>
              <input id="ltsp-name" className="ltsp-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </div>
            <div>
              <label className="ltsp-label" htmlFor="ltsp-email">Reply-to email</label>
              <input id="ltsp-email" className="ltsp-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
          </div>

          <div className="ltsp-grid" style={{ marginBottom: 14 }}>
            <div>
              <label className="ltsp-label" htmlFor="ltsp-cat">Category</label>
              <select id="ltsp-cat" className="ltsp-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Choose a topic (optional)</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="ltsp-label" htmlFor="ltsp-subj">Subject</label>
              <input id="ltsp-subj" className="ltsp-input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="A short summary" />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="ltsp-label" htmlFor="ltsp-msg">How can we help?</label>
            <textarea id="ltsp-msg" className="ltsp-textarea" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell us what is happening, and include any details that might help us sort it out quickly." />
          </div>

          {error && (
            <div style={{ marginBottom: 14, padding: '11px 14px', borderRadius: 10, background: 'rgba(255,45,120,0.12)', border: `1px solid ${PINK}`, color: PINK, fontSize: 13.5 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <button type="submit" className="ltsp-btn" disabled={sending}>
              {sending ? 'Sending…' : 'Send message'}
            </button>
            <span style={{ fontSize: 12.5, color: 'var(--lt-faint)' }}>Or email us directly at support@lenstrybe.com</span>
          </div>
        </form>
      </div>
    </div>
  )
}
