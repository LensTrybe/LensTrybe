// Where an Add to calendar link lands when there is no longer a booking behind it.
//
// The link in a client's confirmation email reads the booking when it is clicked, not when
// it was sent, so a cancelled or deleted shoot cannot still be added to someone's calendar.
// Without this page they got their calendar app's own words for that, which on a Mac is
// "No events were added. No valid events were found to add to your calendar." True, and
// useless: it reads like our file is broken rather than like the booking is off.
//
// No sign in. The person holding this link is a client, and may well not have an account.

const GREEN = '#1DB954'

export default function BookingUnavailablePage() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#0a0a0f',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: '#14141c',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 18,
          padding: '36px 32px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 800, color: GREEN, letterSpacing: '-0.02em', marginBottom: 22 }}>
          LensTrybe
        </div>

        <div style={{ fontSize: 21, fontWeight: 800, color: '#ffffff', lineHeight: 1.3, marginBottom: 10 }}>
          This booking is no longer available
        </div>

        <p style={{ margin: '0 0 8px', fontSize: 14.5, lineHeight: 1.65, color: '#9a9aa8' }}>
          The booking behind this link has been cancelled or removed, so there is nothing to
          add to your calendar.
        </p>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: '#9a9aa8' }}>
          If you were expecting this shoot to go ahead, reply to the email your creative sent
          you and they will sort it out.
        </p>

        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            marginTop: 26,
            paddingTop: 18,
            fontSize: 12.5,
            color: '#6a6a78',
            lineHeight: 1.6,
          }}
        >
          Anything you already saved to your calendar stays there. Your calendar keeps its own
          copy, so you may want to remove it yourself.
        </div>
      </div>
    </div>
  )
}
