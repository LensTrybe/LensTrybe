// Brand kit maths: colour, contrast, fonts, logos and the little zip that bundles the assets.
// Everything here runs in the browser; nothing needs the backend.

// ── colour ────────────────────────────────────────────────────────────────
export const hex2rgb = h => { const x = h.replace('#', ''); const n = parseInt(x.length === 3 ? x.split('').map(c => c + c).join('') : x, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
export const rgb2hex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
export const lum = h => { const [r, g, b] = hex2rgb(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) }
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
export const rgb2hsl = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6 } return [h, s, l] }
export const hsl2rgb = ([h, s, l]) => { if (s === 0) return [l * 255, l * 255, l * 255]; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; const f = t => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p }; return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255] }
export const shade = (h, dl) => { const [hh, s, l] = rgb2hsl(hex2rgb(h)); return rgb2hex(hsl2rgb([hh, s, Math.max(0, Math.min(1, l + dl))])) }
// nudge a colour darker or lighter until it clears the ratio against bg
export const fixContrast = (h, bg, min = 4.5) => { let c = h; const dir = lum(bg) > 0.5 ? -0.03 : 0.03; for (let i = 0; i < 30 && contrast(c, bg) < min; i++) c = shade(c, dir); return c }
// the accent as it lands on the dark portal and gallery: lifted just enough to read, never changed by hand
export const portalAccent = h => fixContrast(h, '#0b0b10', 4.5)
export const onColour = h => lum(h) > 0.4 ? '#14111a' : '#ffffff' // text colour that sits on the accent

export const PAPERS = [['white', 'Bright white', '#ffffff', '#14111a'], ['cream', 'Warm cream', '#faf6ee', '#1a1612'], ['grey', 'Soft grey', '#f3f3f5', '#14111a'], ['dark', 'Dark', '#14111a', '#f4f2f7']]
export const paperOf = id => PAPERS.find(p => p[0] === id) || PAPERS[0]

// ── fonts ─────────────────────────────────────────────────────────────────
export const FONTS = ['Inter', 'DM Sans', 'Manrope', 'Work Sans', 'Sora', 'Space Grotesk', 'Montserrat', 'Raleway', 'Lato', 'Poppins', 'Nunito', 'Playfair Display', 'Instrument Serif', 'Cormorant Garamond', 'EB Garamond', 'Libre Baskerville', 'Lora', 'Merriweather', 'Fraunces', 'JetBrains Mono']
export const SERIF = ['Playfair Display', 'Instrument Serif', 'Cormorant Garamond', 'EB Garamond', 'Libre Baskerville', 'Lora', 'Merriweather', 'Fraunces']
export const fam = f => `'${f}', ${SERIF.includes(f) ? 'serif' : f === 'JetBrains Mono' ? 'monospace' : 'sans-serif'}`
const loaded = new Set(['Inter', 'Instrument Serif'])
export const loadFont = f => { if (!f || loaded.has(f)) return; loaded.add(f); const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=' + f.replace(/ /g, '+') + ':ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap'; document.head.appendChild(l) }
export const PAIRINGS = [
  ['Editorial', 'Playfair Display', 'Inter', 'Magazine serif over a quiet sans'],
  ['Modern', 'Space Grotesk', 'DM Sans', 'Geometric and clean'],
  ['Humanist', 'Lora', 'Work Sans', 'Warm, readable, friendly'],
  ['Studio', 'Sora', 'Manrope', 'Rounded, contemporary'],
  ['Classic', 'EB Garamond', 'Lato', 'Old-style serif, timeless'],
  ['Mono accent', 'JetBrains Mono', 'Inter', 'Technical, precise'],
]

// ── looks: complete starting points ───────────────────────────────────────
export const LOOKS = [
  { id: 'editorial', n: 'Editorial', s: 'Magazine serif, black on white', head: 'Playfair Display', body: 'Inter', accent: '#14111a', paper: 'white', layout: 'minimal', radius: 4, tone: ['Polished', 'Calm'] },
  { id: 'coastal', n: 'Coastal', s: 'Mint on warm cream, soft edges', head: 'Fraunces', body: 'DM Sans', accent: '#1DB98A', paper: 'cream', layout: 'classic', radius: 14, tone: ['Warm', 'Casual'] },
  { id: 'noir', n: 'Noir', s: 'Dark paper, one bright line', head: 'Instrument Serif', body: 'Inter', accent: '#8DF3D6', paper: 'dark', layout: 'band', radius: 10, tone: ['Understated', 'Direct'] },
  { id: 'studio', n: 'Studio', s: 'Geometric sans, electric blue', head: 'Space Grotesk', body: 'Manrope', accent: '#2F6BFF', paper: 'grey', layout: 'band', radius: 8, tone: ['Direct', 'Bold'] },
  { id: 'warm', n: 'Warm', s: 'Terracotta, humanist type', head: 'Lora', body: 'Work Sans', accent: '#C8552B', paper: 'cream', layout: 'classic', radius: 12, tone: ['Warm', 'Playful'] },
  { id: 'bold', n: 'Bold', s: 'Hot pink, heavy sans', head: 'Sora', body: 'Sora', accent: '#E0207A', paper: 'white', layout: 'band', radius: 18, tone: ['Bold', 'Playful'] },
]
export const LAYOUTS = [['classic', 'Classic', 'Logo left, title right'], ['band', 'Band', 'Full-width accent header'], ['minimal', 'Minimal', 'Thin rule, nothing else']]
export const TONES = ['Warm', 'Casual', 'Polished', 'Playful', 'Direct', 'Understated', 'Bold', 'Calm']

// ── logo intelligence ────────────────────────────────────────────────────
const img = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src })
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
// dominant colours: quantise to a coarse grid, count, drop near-white/near-black/greys, return the strongest
export async function paletteFromImage(src, n = 4) {
  const i = await img(src); const c = cv(64, 64); const x = c.getContext('2d'); x.drawImage(i, 0, 0, 64, 64)
  const d = x.getImageData(0, 0, 64, 64).data; const m = new Map(); let dark = 0, tot = 0
  for (let p = 0; p < d.length; p += 4) { if (d[p + 3] < 128) continue; tot++; const r = d[p], g = d[p + 1], b = d[p + 2]; if (lum(rgb2hex([r, g, b])) < 0.2) dark++; const [, s, l] = rgb2hsl([r, g, b]); if (s < 0.18 || l < 0.12 || l > 0.92) continue; const k = [r >> 4, g >> 4, b >> 4].join(','); const e = m.get(k) || { c: 0, r: 0, g: 0, b: 0 }; e.c++; e.r += r; e.g += g; e.b += b; m.set(k, e) }
  const out = [...m.values()].sort((a, b) => b.c - a.c).map(e => rgb2hex([e.r / e.c, e.g / e.c, e.b / e.c]))
  const uniq = []; for (const h of out) { if (!uniq.some(u => contrast(u, h) < 1.25)) uniq.push(h); if (uniq.length >= n) break }
  return { colours: uniq, dark: tot ? dark / tot : 0, coverage: tot / 4096 }
}
// a white version of the logo: keep the alpha, paint every pixel white (works for logos on transparent backgrounds)
export async function whiteLogo(src) {
  const i = await img(src); const c = cv(i.width, i.height); const x = c.getContext('2d'); x.drawImage(i, 0, 0)
  const im = x.getImageData(0, 0, c.width, c.height); const d = im.data; let opaque = 0
  for (let p = 0; p < d.length; p += 4) { if (d[p + 3] > 8) opaque++; d[p] = d[p + 1] = d[p + 2] = 255 }
  if (opaque / (c.width * c.height) > 0.92) return null // no transparency: a white square is no use
  x.putImageData(im, 0, 0); return c.toDataURL('image/png')
}
// the square mark: trim transparent edges, then centre-crop the widest square
export async function squareMark(src, size = 256) {
  const i = await img(src); const c = cv(i.width, i.height); const x = c.getContext('2d'); x.drawImage(i, 0, 0)
  const d = x.getImageData(0, 0, c.width, c.height).data; let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0
  for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) if (d[(y * c.width + xx) * 4 + 3] > 8) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y }
  if (x1 <= x0) { x0 = 0; y0 = 0; x1 = c.width; y1 = c.height }
  const w = x1 - x0, h = y1 - y0, s = Math.min(w, h); const sx = x0 + (w - s) / 2, sy = y0 + (h - s) / 2
  const o = cv(size, size); o.getContext('2d').drawImage(c, sx, sy, s, s, 0, 0, size, size); return o.toDataURL('image/png')
}
export const monogram = (name, accent, ink = '#14111a', font = 'Inter') => { const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join(''); return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="28" fill="${accent}"/><text x="60" y="76" text-anchor="middle" font-family="${font}, sans-serif" font-size="52" font-weight="600" fill="${onColour(accent)}" letter-spacing="-2">${ini}</text></svg>`) }

// ── the tiny zip (stored, no compression) ─────────────────────────────────
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return t })()
const crc32 = u8 => { let c = -1; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0 }
const b64 = s => { const bin = atob(s.split(',')[1]); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u }
export const toBytes = v => typeof v === 'string' ? (v.startsWith('data:') ? b64(v) : new TextEncoder().encode(v)) : v
export function zip(files) { // [[name, string|dataURL|Uint8Array]]
  const parts = [], cd = []; let off = 0; const le = (n, w) => { const a = []; for (let i = 0; i < w; i++) a.push((n >>> (8 * i)) & 255); return a }
  for (const [name, val] of files) {
    const data = toBytes(val), nm = new TextEncoder().encode(name), crc = crc32(data)
    const head = new Uint8Array([0x50, 0x4b, 3, 4, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...le(crc, 4), ...le(data.length, 4), ...le(data.length, 4), ...le(nm.length, 2), 0, 0, ...nm])
    parts.push(head, data)
    cd.push(new Uint8Array([0x50, 0x4b, 1, 2, 20, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...le(crc, 4), ...le(data.length, 4), ...le(data.length, 4), ...le(nm.length, 2), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...le(off, 4), ...nm]))
    off += head.length + data.length
  }
  const cdLen = cd.reduce((t, c) => t + c.length, 0)
  const end = new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...le(files.length, 2), ...le(files.length, 2), ...le(cdLen, 4), ...le(off, 4), 0, 0])
  return new Blob([...parts, ...cd, end], { type: 'application/zip' })
}
export const download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000) }

// ── email signature ───────────────────────────────────────────────────────
export const signatureHtml = (b, p, st) => `<table cellpadding="0" cellspacing="0" style="font-family:${b.body},Arial,sans-serif;font-size:13px;color:#14111a"><tr>${b.mark || b.logo ? `<td style="padding-right:14px;vertical-align:top"><img src="${b.mark || b.logo}" width="44" height="44" style="border-radius:10px;display:block" alt=""></td>` : ''}<td style="vertical-align:top"><div style="font-family:${b.head},Georgia,serif;font-size:16px;font-weight:600">${p.n}</div><div style="color:#6b6877;margin-top:2px">${b.name}${b.tag ? ' · ' + b.tag : ''}</div><div style="margin-top:6px"><a href="tel:${st.phone}" style="color:${b.accent};text-decoration:none">${st.phone}</a>${b.site ? ` · <a href="https://${st.site || 'lenstrybe.com'}" style="color:${b.accent};text-decoration:none">${st.site || b.name.toLowerCase().replace(/[^a-z]/g, '') + '.com'}</a>` : ''}</div>${b.foot ? `<div style="color:#8b8a9a;margin-top:8px;font-size:12px">${b.foot}</div>` : ''}</td></tr></table>`

// brand as it applies to one document type, base plus any override
export const brandFor = (b, kind) => { const o = (b.over || {})[kind] || {}; return { ...b, accent: o.accent || b.accent, logo: o.logo || b.logo, layout: o.layout || b.layout || 'classic', prefix: o.prefix || { inv: 'INV-', q: 'Q-', c: 'C-' }[kind] || '' } }
