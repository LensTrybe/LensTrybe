import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { PREVIEW, PREVIEW_AREA } from '../backend/supabaseClient'

// While the workspace or portal preview is open: a small bar saying it is sample data, with the way
// out. The preview is a closed box (backend/previewGuard.js): anything that would leave it, a link,
// a new tab, a page outside the workspace or portal, a request to the real site, is stopped, and the
// bar says so for a moment. Only the two buttons on the bar leave, and they load the real site fresh.
export default function PreviewBar() {
  const { pathname, search, hash } = useLocation()
  const nav = useNavigate()
  const how = useNavigationType()
  const inArea = PREVIEW_AREA(pathname)
  const last = useRef(inArea ? pathname + search + hash : (pathname.startsWith('/portal') ? '/portal/harper-leo' : '/app/today'))
  const [note, setNote] = useState(false)

  useEffect(() => {
    if (!PREVIEW) return
    const on = () => { setNote(true); clearTimeout(on.t); on.t = setTimeout(() => setNote(false), 3200) }
    window.addEventListener('lt-preview-blocked', on)
    return () => { window.removeEventListener('lt-preview-blocked', on); clearTimeout(on.t) }
  }, [])

  // A page inside the app tried to go somewhere outside the preview: go straight back. The browser's
  // own back button is the visitor leaving, so that loads the real page fresh (never on sample data).
  useEffect(() => {
    if (!PREVIEW) return
    if (inArea) { last.current = pathname + search + hash; return }
    if (how === 'POP') { location.replace(pathname + search + hash); return }
    nav(last.current, { replace: true })
    window.dispatchEvent(new CustomEvent('lt-preview-blocked'))
  }, [inArea, pathname, search, hash, nav, how])

  if (!PREVIEW || !inArea) return null
  const portal = pathname.startsWith('/portal/')
  return (
    <div className={'previewbar' + (portal ? ' pv-portal' : '') + (note ? ' pv-note' : '')} role="note" aria-live="polite">
      <span>{note ? <><b>Just a preview.</b> Links and sending stay inside it, nothing goes anywhere.</> : <><b>Preview</b> with sample {portal ? 'client' : 'business'} data. Nothing here is real or saved to LensTrybe.</>}</span>
      <a href={portal ? '/jobs' : '/join'} className="pv-go" data-preview-exit="">{portal ? 'Post a job' : 'Join as a creative'}</a>
      <a href="/" className="pv-out" data-preview-exit="">Leave preview</a>
    </div>
  )
}
