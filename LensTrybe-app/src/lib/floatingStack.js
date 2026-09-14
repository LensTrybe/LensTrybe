// The floating buttons that sit in the bottom right corner of every dashboard page.
//
// Their positions live here rather than in each component, because three buttons pinned to
// the same corner by three different files is how they end up half on top of each other.
// Reading from one place means moving one button forces you to look at the others.
//
// Stacked from the bottom up, with a 12px gap between each:
//
//   Notes   bottom 212   (52px)   jot a note from anywhere
//   Lumi    bottom 148   (52px)   the AI assistant
//   Bell    bottom  88   (48px)   notifications
//
// On a phone the bell moves into the top bar, so only Lumi and Notes are down there and
// they sit closer to the corner.
//
// NotificationBell styles itself in its own scoped style block and matches these numbers.

export const FLOAT_SIZE = 52

// The right offset for a 52px button. Anything narrower has to be nudged out further so
// every circle sits on the same centre line, otherwise a 48px button beside a 52px one
// looks a couple of pixels off even though both are 24px from the edge.
export const FLOAT_RIGHT = { desktop: 24, mobile: 16 }

/** The right offset that puts a button of any width on the shared centre line. */
export function rightFor(size, mobile = false) {
  const base = mobile ? FLOAT_RIGHT.mobile : FLOAT_RIGHT.desktop
  return base + (FLOAT_SIZE - size) / 2
}

export const FLOAT_BOTTOM = {
  bell: { desktop: 88 },
  lumi: { desktop: 148, mobile: 16 },
  notes: { desktop: 212, mobile: 80 },
}

const GREEN = '#1DB954'

/**
 * The liquid glass look the floating buttons share: translucent, blurred, with a bright
 * top edge for the lit lip of the glass and a soft shadow underneath so it lifts off the
 * page. Deliberately not a filled gradient, which read as a sticker sitting on top of the
 * app rather than part of it.
 *
 * Findability comes from the green rim and the green icon rather than from a solid fill.
 * Against both the light and the dark dashboard that is enough to catch the eye without
 * shouting, and the blur keeps it legible over a photo grid or a busy table.
 */
export function glassCircle(size = FLOAT_SIZE) {
  return {
    width: size,
    height: size,
    borderRadius: '50%',
    background: 'var(--lt-glass-bg)',
    border: `1px solid ${GREEN}66`,
    backdropFilter: 'blur(18px) saturate(180%)',
    WebkitBackdropFilter: 'blur(18px) saturate(180%)',
    boxShadow: [
      '0 10px 30px -12px rgba(0,0,0,0.45)',
      `0 0 18px -6px ${GREEN}59`,
      'inset 0 1px 0 rgba(255,255,255,0.38)',
      'inset 0 -1px 0 rgba(0,0,0,0.06)',
    ].join(', '),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    transition: 'transform .14s ease, box-shadow .14s ease, border-color .14s ease',
  }
}

export const FLOAT_ICON = GREEN
