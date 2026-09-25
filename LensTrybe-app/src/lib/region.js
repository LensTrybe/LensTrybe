// Where the visitor is, as the front door worked it out (middleware.js sets lt-region on the way
// to the waitlist; /?seq=1 or the "I'm in South East Queensland" link sets lt-seq). The app reads
// the cookies so an out-of-area visitor who taps the logo after landing on the waitlist gets the
// waitlist again, not the hero, without a round trip to the edge.
export const REGION_NAMES = { QLD: 'South East Queensland', 'QLD-R': 'regional Queensland', NSW: 'New South Wales', VIC: 'Victoria', ACT: 'the ACT', SA: 'South Australia', WA: 'Western Australia', TAS: 'Tasmania', NT: 'the Northern Territory', AU: 'your area', INTL: 'outside Australia' }
export const STATE_OF = { 'QLD-R': 'QLD', QLD: 'QLD', NSW: 'NSW', VIC: 'VIC', ACT: 'ACT', SA: 'SA', WA: 'WA', TAS: 'TAS', NT: 'NT' }
const get = n => { try { const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + n + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : '' } catch { return '' } }
export const inSEQ = () => get('lt-seq') === '1'
export const regionCookie = () => get('lt-region')
export const regionName = code => REGION_NAMES[code] || 'your area'
export const isOutside = code => !!code && code !== 'QLD'
export function claimSEQ() { try { document.cookie = 'lt-seq=1; Path=/; Max-Age=' + 365 * 86400 + '; SameSite=Lax'; document.cookie = 'lt-region=; Path=/; Max-Age=0' } catch { /* private mode */ } }
// True when the visitor is outside South East Queensland and has not claimed to be inside it.
// The app hides actions (join, post a job, the ask) for them and points at the waitlist instead.
export const outside = () => !inSEQ() && isOutside(regionCookie())
// The waitlist for this visitor's area, as a client or a creative
export const waitlistTo = (as) => '/waitlist?region=' + encodeURIComponent(regionCookie() || 'AU') + (as ? '&as=' + as : '')
