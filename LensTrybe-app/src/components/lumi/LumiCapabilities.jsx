import { useEffect } from 'react'

// The two pieces that tell a creative what Lumi can actually do.
//
// Lumi can read their invoices, bookings, enquiries, quotes and contacts, and none of that
// is visible on screen. Without this most people treat it as a generic chatbot, ask one
// vague question, get a general answer and never come back.
//
// LumiIntroCard is the one time nudge, shown until they dismiss it.
// LumiAboutPanel is the full picture, opened from the "What can Lumi do?" link.
//
// Both are exported at the top level on purpose. Never define these inside another
// component's render function.
//
// Styling is inline and uses the theme aware --lt-* tokens only, so both work in light
// and dark. Shared by LumiWidget (drawer) and LumiPage (full page).

const GREEN = '#1DB954'
const GREEN_TEXT = '#04120a'

export const LUMI_KNOWS = [
  ['Money owed', 'Unpaid and overdue invoices, who owes what, and the total.'],
  ['What is coming up', 'Confirmed and pending bookings, with dates, clients and locations.'],
  ['Who is waiting on you', 'Enquiries where the client sent the last message and you have not replied.'],
  ['Quotes', 'What you sent, what it was worth, and whether it was accepted or declined.'],
  ['Your contacts', 'Search your client list by name, email or company.'],
]

export const LUMI_WRITES = [
  'A reply to an enquiry, using what the client actually asked for',
  'A follow up on an invoice that is overdue',
  'Quote wording and package descriptions',
  'Captions, bios and website copy',
  'A second opinion on your pricing',
]

export const LUMI_LIMITS = [
  ['It reads, it never writes', 'Lumi cannot change your invoices, bookings or client records. Nothing you ask it can break your data.'],
  ['It never sends', 'Every draft is yours to read, change and send yourself.'],
  ['It only sees your account', "Lumi has no way to reach another creative's numbers, and no other creative can reach yours."],
]

export const LUMI_EXAMPLES = [
  'Who owes me money?',
  'What is on this week?',
  'Who is waiting on a reply from me?',
  'What did I quote Harbour Cafe?',
  'Am I charging enough for a half day brand shoot?',
]

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.09em',
          color: GREEN,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ label, detail }) {
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--lt-text)', lineHeight: 1.4 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--lt-muted)', lineHeight: 1.55, marginTop: 2 }}>{detail}</div>
    </div>
  )
}

function Bullet({ children }) {
  return (
    <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: 7 }}>
      <span
        aria-hidden="true"
        style={{ width: 5, height: 5, borderRadius: '50%', background: GREEN, flexShrink: 0, marginTop: 7 }}
      />
      <span style={{ fontSize: 13, color: 'var(--lt-muted)', lineHeight: 1.55 }}>{children}</span>
    </div>
  )
}

/**
 * The first run nudge. Sits above the starter prompts until the creative dismisses it.
 * onDismiss should persist the dismissal, so it does not come back on their next device.
 */
export function LumiIntroCard({ onDismiss, onOpenAbout }) {
  return (
    <div
      style={{
        background: 'var(--lt-glass-bg)',
        border: `1px solid ${GREEN}55`,
        boxShadow: 'var(--lt-glass-shadow)',
        borderRadius: 14,
        padding: '16px 17px',
        marginBottom: 18,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--lt-text)', marginBottom: 7 }}>
        Lumi knows your business
      </div>
      <div style={{ fontSize: 13, color: 'var(--lt-muted)', lineHeight: 1.6 }}>
        Ask about money owed, what is coming up, or who is waiting on a reply, and you get your
        actual numbers rather than general advice. It will draft the client reply too.
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            padding: '8px 18px',
            borderRadius: 9,
            border: 'none',
            background: GREEN,
            color: GREEN_TEXT,
            fontSize: 13,
            fontWeight: 800,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          Got it
        </button>
        <button
          type="button"
          onClick={onOpenAbout}
          style={{
            padding: '8px 4px',
            border: 'none',
            background: 'none',
            color: 'var(--lt-muted)',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: 'pointer',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          See everything it can do
        </button>
      </div>
    </div>
  )
}

/**
 * The full explanation, opened from the "What can Lumi do?" link.
 * Rendered inside whatever surface the caller gives it, so it works in the drawer and on
 * the full page without a second layout.
 */
export function LumiAboutPanel({ onClose, onTryExample }) {
  // Escape closes it, the same as every other panel in the dashboard.
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-label="What Lumi can do"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 5,
        background: 'var(--lt-modal-bg)',
        backdropFilter: 'var(--lt-modal-blur)',
        WebkitBackdropFilter: 'var(--lt-modal-blur)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '16px 18px',
          borderBottom: '1px solid var(--lt-hairline)',
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--lt-text)' }}>What Lumi can do</div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            border: 'none',
            background: 'var(--lt-surface)',
            color: 'var(--lt-text)',
            borderRadius: 9,
            padding: '7px 14px',
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px 26px' }}>
        <p style={{ margin: '0 0 22px', fontSize: 13.5, color: 'var(--lt-muted)', lineHeight: 1.6 }}>
          Lumi is connected to your LensTrybe account, so it answers from your real numbers
          instead of guessing. Ask it anything below and it will look it up before it replies.
        </p>

        <Section title="What it can look up">
          {LUMI_KNOWS.map(([label, detail]) => (
            <Row key={label} label={label} detail={detail} />
          ))}
        </Section>

        <Section title="What it can write for you">
          {LUMI_WRITES.map((line) => (
            <Bullet key={line}>{line}</Bullet>
          ))}
          <div style={{ fontSize: 12.5, color: 'var(--lt-faint)', lineHeight: 1.55, marginTop: 8 }}>
            Drafts come back ready to copy, using the real client name and the real amount.
          </div>
        </Section>

        <Section title="Where the line is">
          {LUMI_LIMITS.map(([label, detail]) => (
            <Row key={label} label={label} detail={detail} />
          ))}
        </Section>

        <Section title="Try asking">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {LUMI_EXAMPLES.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onTryExample?.(q)}
                style={{
                  padding: '9px 13px',
                  borderRadius: 10,
                  background: 'var(--lt-surface)',
                  border: '1px solid var(--lt-border)',
                  color: 'var(--lt-text)',
                  fontSize: 12.5,
                  fontFamily: 'inherit',
                  cursor: onTryExample ? 'pointer' : 'default',
                  textAlign: 'left',
                  lineHeight: 1.4,
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </Section>

        <div
          style={{
            borderTop: '1px solid var(--lt-hairline)',
            paddingTop: 16,
            fontSize: 12.5,
            color: 'var(--lt-faint)',
            lineHeight: 1.6,
          }}
        >
          Lumi is included on Pro and above. Expert and Elite run on a larger model, so answers
          are longer and handle more at once. Your remaining messages are shown at the top.
        </div>
      </div>
    </div>
  )
}

/**
 * The link that opens the panel. Words, not an icon, because people read words and skip icons.
 */
export function LumiAboutLink({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: 'none',
        background: 'none',
        padding: 0,
        color: 'var(--lt-muted)',
        fontSize: 11.5,
        fontWeight: 600,
        fontFamily: 'inherit',
        cursor: 'pointer',
        textDecoration: 'underline',
        textUnderlineOffset: 3,
        whiteSpace: 'nowrap',
      }}
    >
      What can Lumi do?
    </button>
  )
}
