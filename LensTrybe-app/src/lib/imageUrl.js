// Ask Supabase Storage for an image at the size it is actually going to be displayed.
//
// A creative uploads what came out of Lightroom. Until now that exact file was served to
// a phone showing it in a 150px circle. A real object in the portfolio bucket measured
// 1,689,402 bytes as stored, 590,876 through the transform at 600px wide, and 20,714 as
// WebP at the same width. The last number is the one that matters: 1.65MB down to 20KB,
// eighty times smaller, on a connection where that is the difference between a profile
// that loads and one the client backs out of.
//
// WebP costs nothing to ask for. Supabase reads the browser's Accept header and converts
// on the fly, so every modern phone gets it without the URL saying anything about it.
//
// Transformations are enabled on this project. If they are ever turned off, the render
// endpoint stops answering and images break, so this is worth knowing before anyone
// changes the plan.

// What a stored public URL looks like:
//   https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
// What the transforming endpoint wants:
//   https://<ref>.supabase.co/storage/v1/render/image/public/<bucket>/<path>?width=…
const PUBLIC_OBJECT = '/storage/v1/object/public/'
const RENDER_IMAGE = '/storage/v1/render/image/public/'

// Retina phones have two or three device pixels per CSS pixel. Asking for exactly the
// CSS width gives a soft image on every phone sold in the last decade. Two is the
// sensible trade: sharp on a 2x screen, very slightly soft on a 3x screen, and a
// quarter of the bytes of asking for 3x.
const DPR = 2

// 70 is where the eye stops noticing on a photograph. Below about 60 the sky and skin
// tones start to band, which on a photography marketplace is the one thing worth
// protecting.
const DEFAULT_QUALITY = 70

// Above this there is no point asking for a smaller file, and a lightbox wants the
// detail anyway.
const MAX_WIDTH = 2000

/**
 * Rewrite a Supabase public image URL to be delivered at a given display width.
 *
 * @param {string|null|undefined} url  a stored public URL, or anything else
 * @param {number} width              the CSS pixel width it will be displayed at
 * @param {number} [quality]          1 to 100, defaults to 70
 * @returns {string|null|undefined}   the rewritten URL, or the input unchanged
 *
 * Anything that is not a Supabase public object URL comes back untouched: external
 * avatars, data: URIs, signed URLs, blob: previews from a file picker and the bundled
 * assets all still work. So this is safe to wrap around any src, known or not.
 */
export function imageUrl(url, width, quality = DEFAULT_QUALITY) {
  if (!url || typeof url !== 'string') return url
  if (!url.includes(PUBLIC_OBJECT)) return url
  if (!width || !Number.isFinite(width)) return url

  // An SVG has no pixel dimensions to resize and the transformer rasterises it, which
  // makes a 3KB logo into a 40KB PNG. Leave them alone.
  if (/\.svg($|\?)/i.test(url)) return url

  const target = Math.min(MAX_WIDTH, Math.round(width * DPR))
  const [base, query] = url.split('?')
  const rendered = base.replace(PUBLIC_OBJECT, RENDER_IMAGE)
  const params = new URLSearchParams(query || '')
  params.set('width', String(target))
  params.set('quality', String(Math.max(20, Math.min(100, Math.round(quality)))))
  return `${rendered}?${params.toString()}`
}

/**
 * The same thing for a CSS background-image, which needs the url() wrapper.
 * Returns undefined for a missing source so it can be spread into a style object.
 */
export function backgroundImage(url, width, quality = DEFAULT_QUALITY) {
  const u = imageUrl(url, width, quality)
  return u ? `url(${JSON.stringify(u)})` : undefined
}
