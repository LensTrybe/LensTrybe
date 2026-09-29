// The Workspace and Client portal previews are a closed box (Michael, 29 Sep: "an interactive
// dashboard that links to nothing"). Visitors can click, type, upload and reply to their heart's
// content; everything happens in the sample store in their own browser. This makes sure of it:
// while the preview runs, no request leaves the page (only the page's own files, fonts, and
// pictures a visitor picked themselves), no link or new tab goes anywhere, and nothing can open a
// connection. Whatever was stopped raises 'lt-preview-blocked', which the preview bar turns into a
// short note.

const FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//

const say = () => { try { window.dispatchEvent(new CustomEvent('lt-preview-blocked')) } catch { /* old browser */ } }

// Own files (GET only), fonts, and data:/blob: (pictures and files the visitor picked) are fine.
function allowed(url, method = 'GET') {
  let u
  try { u = new URL(String(url), location.href) } catch { return false }
  if (u.protocol === 'data:' || u.protocol === 'blob:') return true
  if (FONTS.test(u.href)) return String(method).toUpperCase() === 'GET'
  return u.origin === location.origin && String(method).toUpperCase() === 'GET'
}

export function lockDown(inArea) {
  if (typeof window === 'undefined' || window.__ltPreviewLocked) return
  window.__ltPreviewLocked = true

  const realFetch = window.fetch.bind(window)
  window.fetch = (input, init) => {
    const url = typeof input === 'string' || input instanceof URL ? input : input?.url
    const method = init?.method || (typeof input === 'object' && input?.method) || 'GET'
    if (allowed(url, method)) return realFetch(input, init)
    say()
    return Promise.reject(new TypeError('Preview: nothing is sent anywhere'))
  }

  const open = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (!allowed(url, method)) { say(); throw new TypeError('Preview: nothing is sent anywhere') }
    return open.call(this, method, url, ...rest)
  }
  if (navigator.sendBeacon) navigator.sendBeacon = () => { say(); return true }
  const stop = name => { if (window[name]) window[name] = function () { say(); throw new TypeError('Preview: no connections') } }
  stop('WebSocket'); stop('EventSource')

  window.open = () => { say(); return null }

  // Links: stay inside the preview. A download link (a file the page made) and the preview bar's own
  // way out (data-preview-exit) still work.
  document.addEventListener('click', e => {
    const a = e.target?.closest?.('a[href]')
    if (!a || a.hasAttribute('data-preview-exit') || a.hasAttribute('download')) return
    const href = a.getAttribute('href') || ''
    if (href.startsWith('#')) return
    let u
    try { u = new URL(a.href, location.href) } catch { return }
    if (u.protocol === 'blob:' || u.protocol === 'data:') return
    if (u.origin === location.origin && inArea(u.pathname) && a.target !== '_blank') return
    e.preventDefault(); e.stopImmediatePropagation(); say()
  }, true)

  // Forms that would post somewhere.
  document.addEventListener('submit', e => {
    const f = e.target
    if (f?.getAttribute?.('action')) { e.preventDefault(); say() }
  }, true)
}
