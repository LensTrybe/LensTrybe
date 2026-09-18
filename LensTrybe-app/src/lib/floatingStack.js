// The floating button that sits in the bottom right corner of every dashboard page.
//
// There used to be three of them stacked up the right edge: notifications, Lumi and the
// quick-note button. Three circles is a column of clutter sitting on top of whatever row
// of the page happened to be underneath, and on a phone it covered real content. They are
// now one button that fans the three out when you tap it.
//
// Geometry lives here rather than in each component, because a corner shared by four
// elements positioned from four different files is how they end up half on top of each
// other. Reading from one place means moving one forces you to look at the others.

/** The button you tap. */
export const DOCK_SIZE = 56

/** The three that fan out of it. Smaller, so the anchor stays the obvious target. */
export const DOCK_ITEM = 48

/** Distance from the anchor's centre to each item's centre. */
const RADIUS = 88

/** How far the anchor sits from the corner. */
export const DOCK_EDGE = { desktop: 24, mobile: 16 }

/**
 * Where each fanned item lands, as a right and bottom offset in pixels.
 *
 * The three sit on a quarter circle from straight up (90 degrees) round to straight in
 * from the side (180 degrees), which keeps every one of them inside the screen on a 390px
 * phone and clear of the thumb that just tapped the anchor.
 *
 * Both the anchor and the items are positioned from the same two edges, so the maths is
 * plain addition: take the anchor's centre, step out along the arc, then step back by half
 * an item to get from its centre to its corner.
 */
export function fanAt(degrees, edge) {
  const rad = (degrees * Math.PI) / 180
  const centreRight = edge + DOCK_SIZE / 2 + RADIUS * Math.cos(rad) * -1
  const centreBottom = edge + DOCK_SIZE / 2 + RADIUS * Math.sin(rad)
  return {
    right: Math.round(centreRight - DOCK_ITEM / 2),
    bottom: Math.round(centreBottom - DOCK_ITEM / 2),
  }
}

/** The angles the three tools sit at, nearest the thumb first. */
export const FAN_ANGLES = [90, 135, 180]

/**
 * Where a panel opened from the dock should start, so it clears the anchor rather than
 * sitting on top of it. Notifications and the quick note both use this.
 */
export function panelBottom(edge) {
  return edge + DOCK_SIZE + 12
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
export function glassCircle(size = DOCK_SIZE) {
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
export const FLOAT_PINK = '#FF2D78'

/**
 * The events the dock fires and the three tools listen for. Each tool owns its own panel
 * and its own data, the dock only knows how to ask for one to open.
 */
export const DOCK_EVENTS = {
  lumi: 'lt:open-lumi',
  notes: 'lt:open-notes',
  notifications: 'lt:open-notifications',
}

/** NotificationBell announces its unread count on this, so the dock can badge the anchor. */
export const UNREAD_EVENT = 'lt:notif-unread'

/** The dock asks for that count on mount, because it mounts after the first announcement. */
export const UNREAD_PING = 'lt:notif-ping'
