import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { checkFiles, fmtSize, isImage, kindOf, signAttachments } from '../lib/attachments'
import '../styles/attach.css'

// The three pieces of "attach a file to a message", shared by the workspace thread and the client
// portal: the paperclip (a plain file input, so a phone offers the camera and the photo library
// and a computer offers the file picker), the strip of files waiting to go, and the attachments
// inside a sent message (photos as tiles, everything else as a row that opens in a new tab).

export function AttachButton({ onFiles, count = 0, disabled, className = '' }) {
  const ref = useRef(null)
  const pick = e => { const fs = Array.from(e.target.files || []); e.target.value = ''; if (fs.length) onFiles(fs) }
  return <>
    <input ref={ref} type="file" multiple onChange={pick} style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} />
    <button type="button" className={'attbtn ' + className} onClick={() => ref.current?.click()} disabled={disabled} title="Attach photos or files" aria-label="Attach photos or files"><Icon name="clip" size={16} />{count > 0 && <i>{count}</i>}</button>
  </>
}

// Use with AttachButton: keeps the list, applies the limits, tells the user what was wrong.
export function useAttach(toast) {
  const [files, setFiles] = useState([])
  const add = fs => { const err = checkFiles(fs, files.length); if (err) return toast?.(err); setFiles(f => [...f, ...fs]) }
  const remove = i => setFiles(f => f.filter((_, j) => j !== i))
  const clear = () => setFiles([])
  return { files, add, remove, clear, setFiles }
}

function Thumb({ file }) {
  const [url, setUrl] = useState(null)
  useEffect(() => { if (!isImage(file)) return; const u = URL.createObjectURL(file); setUrl(u); return () => { URL.revokeObjectURL(u); setUrl(null) } }, [file])
  return url ? <img src={url} alt="" /> : <b>{kindOf(file)}</b>
}

export function Pending({ files, onRemove, busy, progress }) {
  if (!files.length) return null
  return (
    <div className="attpend" aria-label="Files to send">
      {files.map((f, i) => <div key={f.name + i} className={'attchip' + (busy ? ' busy' : '')}>
        <span className="th"><Thumb file={f} /></span>
        <span className="nm"><b>{f.name}</b><small>{busy && progress?.[i] != null ? (progress[i] >= 1 ? 'Sent' : 'Sending') : fmtSize(f.size)}</small></span>
        {!busy && <button type="button" className="rm" onClick={() => onRemove(i)} aria-label={'Remove ' + f.name}><Icon name="x" size={11} /></button>}
      </div>)}
    </div>
  )
}

// Signed links for the paths in view. ctx = { threadId, token? }
function useSigned(paths, ctx) {
  const [urls, setUrls] = useState({})
  const key = paths.join('|')
  useEffect(() => { let on = true; if (!paths.length) return; signAttachments(paths, ctx).then(u => on && setUrls(x => ({ ...x, ...u }))).catch(() => {}); return () => { on = false } }, [key, ctx.threadId, ctx.token]) // eslint-disable-line react-hooks/exhaustive-deps
  return urls
}

export function Attachments({ items, ctx }) {
  const list = Array.isArray(items) ? items.filter(a => a && a.path) : []
  const urls = useSigned(list.map(a => a.path), ctx)
  if (!list.length) return null
  const pics = list.filter(isImage), files = list.filter(a => !isImage(a))
  return (
    <div className="atts">
      {pics.length > 0 && <div className={'attpics n' + Math.min(pics.length, 4)}>{pics.map(a => <a key={a.path} href={urls[a.path] || undefined} target="_blank" rel="noreferrer" className={urls[a.path] ? '' : 'wait'} title={a.name} onClick={e => { if (!urls[a.path]) e.preventDefault() }}>{urls[a.path] ? <img src={urls[a.path]} alt={a.name} /> : <span />}</a>)}</div>}
      {files.map(a => <a key={a.path} href={urls[a.path] || undefined} target="_blank" rel="noreferrer" className={'attfile' + (urls[a.path] ? '' : ' wait')} onClick={e => { if (!urls[a.path]) e.preventDefault() }}><span className="k">{kindOf(a)}</span><span className="nm"><b>{a.name}</b><small>{fmtSize(a.size)}{urls[a.path] ? '' : ' · opening'}</small></span><Icon name="out" size={13} /></a>)}
    </div>
  )
}
