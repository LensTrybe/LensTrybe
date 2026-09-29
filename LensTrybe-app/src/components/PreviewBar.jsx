import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { PREVIEW, PREVIEW_AREA } from '../backend/supabaseClient'

// While the workspace or portal preview is open: a small bar saying it is sample data, with the way
// out. Leaving the preview area reloads the page, so the public site never runs on sample data.
export default function PreviewBar() {
  const { pathname, search, hash } = useLocation()
  const inArea = PREVIEW_AREA(pathname)
  useEffect(() => { if (PREVIEW && !inArea) location.replace(pathname + search + hash) }, [inArea, pathname, search, hash])
  if (!PREVIEW || !inArea) return null
  const portal = pathname.startsWith('/portal/')
  return (
    <div className={'previewbar' + (portal ? ' pv-portal' : '')} role="note">
      <span><b>Preview</b> with sample {portal ? 'client' : 'business'} data. Nothing here is real or saved to LensTrybe.</span>
      <a href={portal ? '/jobs' : '/join'} className="pv-go">{portal ? 'Post a job' : 'Join as a creative'}</a>
      <a href="/" className="pv-out">Leave preview</a>
    </div>
  )
}
