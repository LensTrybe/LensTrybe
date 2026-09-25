import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { TokenShell, TokenState, Loading, NotOurs } from './TokenShell'
import { loadDelivery, unlockDelivery, trackDownload, sendFavourites, isUuid } from '../../lib/live'

// /deliver/:token — the gallery. Photos in a grid with hearts, videos, other files, download one or
// everything as a zip, send favourites back. Password galleries unlock here. The deliver function
// signs every file link for an hour, so nothing in the bucket is reachable without the token.
const isImg = f => /^image\//.test(f?.type || '') || /\.(jpe?g|png|gif|webp|avif|heic)$/i.test(f?.name || '')
const isVid = f => /^video\//.test(f?.type || '') || /\.(mp4|mov|avi|webm|m4v)$/i.test(f?.name || '')
const fmtSize = n => { n = Number(n) || 0; return n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1048576).toFixed(1) + ' MB' }
const save = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name || 'file'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000) }

export default function DeliverLive() {
  const { token } = useParams()
  const [d, setD] = useState(undefined), [pw, setPw] = useState(''), [busy, setBusy] = useState(''), [err, setErr] = useState(''), [fav, setFav] = useState(new Set()), [dirty, setDirty] = useState(false), [zip, setZip] = useState(0), [lb, setLb] = useState(-1), [note, setNote] = useState('')
  useEffect(() => { let on = true; if (!isUuid(token)) return setD(null); loadDelivery(token).then(x => { if (!on) return; setD(x); if (x && !x.locked) setFav(new Set(x.delivery?.favourites || [])) }).catch(() => on && setD(null)); return () => { on = false } }, [token])
  const files = useMemo(() => (d && !d.locked ? d.delivery?.files || [] : []), [d])
  const pics = useMemo(() => files.filter(isImg), [files]), vids = useMemo(() => files.filter(isVid), [files]), other = useMemo(() => files.filter(f => !isImg(f) && !isVid(f)), [files])
  const lbItems = useMemo(() => [...pics, ...vids], [pics, vids])
  useEffect(() => { if (lb < 0) return; const k = e => { if (e.key === 'Escape') setLb(-1); if (e.key === 'ArrowRight') setLb(i => (i + 1) % lbItems.length); if (e.key === 'ArrowLeft') setLb(i => (i - 1 + lbItems.length) % lbItems.length) }; addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [lb, lbItems.length])
  if (d === undefined) return <Loading text="Opening your gallery." />
  if (d === null) return <NotOurs what="gallery link" />
  const c = d.creative || {}, g = d.delivery || {}, name = c.business_name || 'Your creative'
  const unlock = async () => { if (!pw || busy) return; setBusy('unlock'); setErr(''); try { const r = await unlockDelivery(token, pw); setD({ ...d, ...r, locked: false }); setFav(new Set(r.delivery?.favourites || [])) } catch (e) { setErr(e.message) } finally { setBusy('') } }
  const one = async f => { trackDownload(token, f.name, pw); try { const b = await (await fetch(f.url)).blob(); save(b, f.name) } catch { window.open(f.url, '_blank') } }
  const all = async () => {
    if (!files.length || busy) return; setBusy('zip'); setZip(0); trackDownload(token, '__all__', pw)
    try { const { default: JSZip } = await import('jszip'); const z = new JSZip(); let n = 0; for (const f of files) { try { z.file(f.name || 'file-' + (n + 1), await (await fetch(f.url)).blob()) } catch { /* skip */ } n++; setZip(Math.round(n / files.length * 100)) } save(await z.generateAsync({ type: 'blob' }), (g.title || 'gallery') + '.zip') }
    catch { for (const f of files) { await one(f); await new Promise(r => setTimeout(r, 400)) } }
    finally { setBusy(''); setZip(0) }
  }
  const heart = f => { setFav(s => { const n = new Set(s); n.has(f.path) ? n.delete(f.path) : n.add(f.path); return n }); setDirty(true) }
  const picks = async () => { setBusy('fav'); setErr(''); try { await sendFavourites(token, [...fav], pw); setDirty(false); setNote('Sent ' + fav.size + (fav.size === 1 ? ' favourite' : ' favourites') + ' to ' + name + '.') } catch (e) { setErr(e.message) } finally { setBusy('') } }
  const gone = !!g.files_purged_at, expired = !!d.expired
  const meta = [(g.file_count ?? files.length) + (g.file_count === 1 ? ' file' : ' files'), g.client_name ? 'for ' + g.client_name : null, g.expires_at ? 'until ' + new Date(g.expires_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : null].filter(Boolean).join(' · ')
  return (
    <TokenShell creative={c} sub="Your gallery" wide>
      {d.locked ? <TokenState kicker="Password protected" title={g.title || 'Your gallery'}>
        <p className="sub">{name} put a password on this one. It is in the message that came with the link.</p>
        <div className="field" style={{ marginTop: 14, maxWidth: 360 }}><label htmlFor="g-pw">Password</label><input id="g-pw" type="password" value={pw} onChange={e => { setPw(e.target.value); setErr('') }} onKeyDown={e => e.key === 'Enter' && unlock()} autoFocus /></div>
        {err && <p className="fine" style={{ color: 'var(--pink-t)' }}>{err}</p>}
        <button className="btn p" style={{ alignSelf: 'flex-start', marginTop: 12 }} onClick={unlock} disabled={!pw || !!busy}>{busy ? 'Checking' : 'Open gallery'} <Icon name="arrow" size={14} /></button>
      </TokenState> : <>
        <div className={'ghero lg' + (g.cover_url ? ' cover' : '')} style={g.cover_url ? { backgroundImage: 'url(' + g.cover_url + ')' } : undefined}><div className="in"><p className="eb">{name}</p><h1>{g.title || 'Your files'}</h1><p className="sub">{meta}</p></div></div>
        {gone ? <div className="tsys">This gallery has been removed. Ask {name} if you need the files again.</div> : expired ? <div className="tsys">This link has expired. Ask {name} to renew it and the same link will work again.</div> : <>
          {g.message && <div className="pjob lg" style={{ padding: 18 }}><p className="gmsg">{g.message}</p></div>}
          {files.length > 0 && <div className="gbar lg"><button className="btn p" onClick={all} disabled={!!busy}>{busy === 'zip' ? 'Preparing zip ' + zip + '%' : 'Download all (' + files.length + ')'} <Icon name="deliver" size={14} /></button><span className="fine">{fav.size ? fav.size + (fav.size === 1 ? ' favourite' : ' favourites') + ' picked' : 'Tap the heart on a photo to pick a favourite'}</span>{dirty && <button className="btn g" onClick={picks} disabled={!!busy}>{busy === 'fav' ? 'Sending' : 'Send my picks to ' + name.split(' ')[0]}</button>}</div>}
          {note && <div className="tsys">{note}</div>}{err && <div className="tsys" style={{ color: 'var(--pink-t)' }}>{err}</div>}
          {pics.length > 0 && <section className="gsec"><p className="eb g">Photos · {pics.length}</p><div className="ggrid">{pics.map(f => <div key={f.path} className="gt" onClick={() => setLb(lbItems.indexOf(f))}>{f.url ? <img src={f.url} alt={f.name} loading="lazy" decoding="async" /> : <span />}<button type="button" className={'gh' + (fav.has(f.path) ? ' on' : '')} onClick={e => { e.stopPropagation(); heart(f) }} aria-label={fav.has(f.path) ? 'Remove favourite' : 'Favourite'}>{fav.has(f.path) ? '♥' : '♡'}</button><button type="button" className="gd" onClick={e => { e.stopPropagation(); one(f) }}><Icon name="deliver" size={13} /></button></div>)}</div></section>}
          {vids.length > 0 && <section className="gsec"><p className="eb g">Videos · {vids.length}</p><div className="ggrid vid">{vids.map(f => <div key={f.path} className="gv lg"><video src={f.url} controls preload="metadata" playsInline /><div className="r"><span>{f.name}</span><button type="button" className="lnk" onClick={() => one(f)}>Download</button></div></div>)}</div></section>}
          {other.length > 0 && <section className="gsec"><p className="eb g">Files · {other.length}</p><div className="gfiles">{other.map(f => <button type="button" key={f.path} className="pcard lg" onClick={() => one(f)}><i className="pk"><Icon name="doc" size={13} /></i><div><b>{f.name}</b><small>{f.size ? fmtSize(f.size) : (f.type || 'File')}</small></div><span className="pbtn">Download</span></button>)}</div></section>}
          {!files.length && <div className="tsys">No files in this gallery yet.</div>}
        </>}
        {lb >= 0 && lbItems[lb] && <div className="glb" onClick={() => setLb(-1)}>
          <button type="button" className="x" aria-label="Close" onClick={() => setLb(-1)}><Icon name="x" size={18} /></button>
          {lbItems.length > 1 && <button type="button" className="nv l" aria-label="Previous" onClick={e => { e.stopPropagation(); setLb(i => (i - 1 + lbItems.length) % lbItems.length) }}><Icon name="back" size={20} /></button>}
          <figure onClick={e => e.stopPropagation()}>{isVid(lbItems[lb]) ? <video src={lbItems[lb].url} controls autoPlay playsInline /> : <img src={lbItems[lb].url} alt={lbItems[lb].name} />}<figcaption><span>{lbItems[lb].name}</span><span>{lb + 1} / {lbItems.length}</span><button type="button" className={'gh' + (fav.has(lbItems[lb].path) ? ' on' : '')} onClick={() => heart(lbItems[lb])}>{fav.has(lbItems[lb].path) ? '♥ Favourite' : '♡ Favourite'}</button><button type="button" onClick={() => one(lbItems[lb])}>Download</button></figcaption></figure>
          {lbItems.length > 1 && <button type="button" className="nv r" aria-label="Next" onClick={e => { e.stopPropagation(); setLb(i => (i + 1) % lbItems.length) }}><Icon name="chev" size={20} /></button>}
        </div>}
      </>}
      <p className="fine" style={{ textAlign: 'center', marginTop: 18 }}>Delivered by {name} through <Link to="/" style={{ color: 'var(--green-t)' }}>LensTrybe</Link>. Links to files last an hour; reload for fresh ones.</p>
    </TokenShell>
  )
}
