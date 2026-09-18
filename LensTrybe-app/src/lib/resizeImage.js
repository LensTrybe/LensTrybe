// Shrink an image in the browser before it is uploaded.
//
// Serving transforms (see lib/imageUrl) fixes what a visitor downloads. It does not fix
// what a creative uploads over their own phone connection, or what sits in the storage
// bill afterwards. A photographer picking twelve frames straight out of Lightroom is
// pushing tens of megabytes up a mobile connection, and the originals are kept forever
// at a resolution nothing on the site ever asks for.
//
// 2400px on the long edge is the line. It is larger than any display use on the site, it
// still looks right on a 27 inch screen at full width, and it takes a 24 megapixel camera
// original down by roughly an order of magnitude.
//
// What is deliberately NOT touched:
//   - anything that is not an image, so contracts and receipts upload as they are
//   - SVG, which has no pixels to resize and would be rasterised
//   - GIF, because the canvas keeps only the first frame and a still GIF is a broken GIF
//   - files already under the threshold, which come back as the original File

const MAX_EDGE = 2400
const QUALITY = 0.82

// Below this there is nothing worth doing and re-encoding only loses detail.
const SKIP_UNDER_BYTES = 400 * 1024

function isResizable(file) {
  if (!file || !file.type) return false
  if (!file.type.startsWith('image/')) return false
  if (file.type === 'image/svg+xml') return false
  if (file.type === 'image/gif') return false
  return true
}

/**
 * Resize a File down to MAX_EDGE on its long edge.
 *
 * @param {File} file
 * @param {{ maxEdge?: number, quality?: number }} [opts]
 * @returns {Promise<File>} the resized file, or the original when resizing does not
 *                          apply or fails
 *
 * Never rejects. An upload failing because a canvas could not decode an unusual JPEG is
 * a worse outcome than uploading the original, so every failure path returns the input.
 */
export async function resizeImage(file, opts = {}) {
  const maxEdge = opts.maxEdge || MAX_EDGE
  const quality = opts.quality || QUALITY

  if (!isResizable(file)) return file
  if (file.size <= SKIP_UNDER_BYTES) return file

  let bitmap = null
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }

  try {
    const { width, height } = bitmap
    const longest = Math.max(width, height)
    if (longest <= maxEdge) { bitmap.close?.(); return file }

    const scale = maxEdge / longest
    const w = Math.round(width * scale)
    const h = Math.round(height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) { bitmap.close?.(); return file }
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()

    // The format is deliberately left alone, and the name with it. Converting a PNG to
    // a JPEG here would save more bytes, but every call site builds its storage path
    // from the file name before the upload, so changing the extension would store a
    // file called .png holding JPEG bytes. Format conversion is the serving layer's job
    // anyway: lib/imageUrl asks for WebP on the way out, which beats anything that could
    // be done here and does not touch what is kept.
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, file.type, quality))
    if (!blob) return file

    // If the resize somehow made it bigger, which happens with flat graphics saved as
    // PNG, keep what we were given.
    if (blob.size >= file.size) return file

    return new File([blob], file.name, { type: file.type, lastModified: Date.now() })
  } catch {
    try { bitmap?.close?.() } catch { /* ignore */ }
    return file
  }
}
