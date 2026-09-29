// A picked photo made small enough to keep in the demo store (the workspace and portal previews keep
// everything in the visitor's own browser): longest side 640px, JPEG. Resolves to a data: URL, or
// null if the browser can't read the file.
export function shrink(file, max = 640) {
  return new Promise(res => {
    if (!file || !/^image\//.test(file.type)) return res(null)
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      try { res(c.toDataURL('image/jpeg', 0.78)) } catch { res(null) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); res(null) }
    img.src = url
  })
}
