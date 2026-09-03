// Shared "Site Styles" theme engine for the creative's website (their profile).
// The builder writes profile.site_theme (jsonb); the public renderer resolves it
// into concrete tokens. Falls back to the legacy site_* columns, then the shared
// Brand Kit, then sensible defaults — so nothing breaks before a theme is set.

export const FONT_OPTIONS = [
  'Inter', 'Playfair Display', 'Montserrat', 'Poppins', 'Raleway', 'Lato', 'Nunito', 'DM Sans', 'Merriweather', 'Cormorant Garamond',
]

const SERIF = new Set(['Playfair Display', 'Merriweather', 'Cormorant Garamond'])

export const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&family=Lato:wght@400;700;900&family=Merriweather:wght@400;700;900&family=Montserrat:wght@400;500;600;700;800&family=Nunito:wght@400;600;700;800&family=Playfair+Display:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700;800&family=Raleway:wght@400;500;600;700;800&display=swap'

export function fontStack(name) {
  const n = name || 'Inter'
  const q = n.includes(' ') ? `"${n}"` : n
  return `${q}, ${SERIF.has(n) ? 'serif' : 'sans-serif'}`
}

export function isDarkColor(hex) {
  if (!hex || typeof hex !== 'string') return false
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length !== 6) return false
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5
}

function hexToRgba(hex, a) {
  let h = (hex || '').trim().replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length !== 6) return `rgba(0,0,0,${a})`
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

// Named preset starting points. Each is a full theme object.
export const THEME_PRESETS = [
  { id: 'clean', name: 'Clean', theme: { colors: { primary: '#1DB954', background: '#ffffff', text: '', heading: '' }, fonts: { heading: 'Playfair Display', body: 'Inter', baseSize: 17, headingWeight: 700 }, buttons: { radius: 10, style: 'solid' }, corners: { radius: 16 } } },
  { id: 'editorial', name: 'Editorial', theme: { colors: { primary: '#8a6d3b', background: '#f6f1e7', text: '', heading: '' }, fonts: { heading: 'Cormorant Garamond', body: 'Lato', baseSize: 18, headingWeight: 600 }, buttons: { radius: 2, style: 'outline' }, corners: { radius: 4 } } },
  { id: 'bold', name: 'Bold', theme: { colors: { primary: '#ff2d78', background: '#0f0f14', text: '', heading: '' }, fonts: { heading: 'Montserrat', body: 'Inter', baseSize: 17, headingWeight: 800 }, buttons: { radius: 999, style: 'solid' }, corners: { radius: 18 } } },
  { id: 'minimal', name: 'Minimal', theme: { colors: { primary: '#111111', background: '#ffffff', text: '', heading: '' }, fonts: { heading: 'Inter', body: 'Inter', baseSize: 16, headingWeight: 700 }, buttons: { radius: 0, style: 'solid' }, corners: { radius: 0 } } },
  { id: 'warm', name: 'Warm', theme: { colors: { primary: '#c0562f', background: '#fbf7f4', text: '', heading: '' }, fonts: { heading: 'Playfair Display', body: 'Nunito', baseSize: 17, headingWeight: 700 }, buttons: { radius: 14, style: 'solid' }, corners: { radius: 20 } } },
  { id: 'noir', name: 'Noir', theme: { colors: { primary: '#e8c07d', background: '#121212', text: '', heading: '' }, fonts: { heading: 'Playfair Display', body: 'Montserrat', baseSize: 17, headingWeight: 600 }, buttons: { radius: 6, style: 'outline' }, corners: { radius: 10 } } },
]

export const DEFAULT_THEME = THEME_PRESETS[0].theme

// Deep-ish merge with defaults so partial themes are safe.
export function normalizeTheme(raw) {
  const t = raw && typeof raw === 'object' ? raw : {}
  return {
    preset: t.preset || 'custom',
    colors: { ...DEFAULT_THEME.colors, ...(t.colors || {}) },
    fonts: { ...DEFAULT_THEME.fonts, ...(t.fonts || {}) },
    buttons: { ...DEFAULT_THEME.buttons, ...(t.buttons || {}) },
    corners: { ...DEFAULT_THEME.corners, ...(t.corners || {}) },
  }
}

// Resolve a profile (+ optional Brand Kit) into concrete render tokens.
export function resolveTheme(profile = {}, brand = null) {
  const t = normalizeTheme(profile.site_theme)
  const primary = t.colors.primary || profile.site_primary_color || (brand && (brand.primary_color || brand.accent_color)) || '#1DB954'
  const background = t.colors.background || profile.site_background_color || (brand && brand.background_color) || '#ffffff'
  const dark = isDarkColor(background)
  const ink = t.colors.text || (dark ? '#f5f4f7' : '#17151c')
  const heading = t.colors.heading || ink
  const soft = t.colors.text ? hexToRgba(t.colors.text, 0.66) : (dark ? 'rgba(245,244,247,0.66)' : '#6a6870')
  const surface = t.colors.surface || (dark ? 'rgba(255,255,255,0.05)' : '#ffffff')
  const surfaceBorder = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'
  const line = dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)'
  const fieldBg = dark ? 'rgba(255,255,255,0.06)' : '#ffffff'
  const headingFont = fontStack(t.fonts.heading || profile.site_heading_font || (brand && (brand.heading_font || brand.font)) || 'Playfair Display')
  const bodyFont = fontStack(t.fonts.body || profile.site_body_font || (brand && (brand.body_font || brand.font)) || 'Inter')
  const baseSize = Number(t.fonts.baseSize) || 17
  const headingWeight = Number(t.fonts.headingWeight) || 700
  const btnRadius = Number.isFinite(Number(t.buttons.radius)) ? Number(t.buttons.radius) : 10
  const btnStyle = t.buttons.style || 'solid'
  const radius = Number.isFinite(Number(t.corners.radius)) ? Number(t.corners.radius) : 16
  const logo = profile.site_logo_url || (brand && brand.logo_url) || null
  return { accent: primary, primary, background, bg: background, dark, ink, heading, soft, surface, surfaceBorder, line, fieldBg, headingFont, bodyFont, baseSize, headingWeight, btnRadius, btnStyle, radius, logo }
}
