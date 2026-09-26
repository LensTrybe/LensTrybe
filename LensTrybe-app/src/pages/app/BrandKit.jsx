import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Still from '../../components/Still'
import { useFlows } from '../../lib/flows'
import { LIVE } from '../../lib/mode'
import * as live from '../../lib/live'
import { LOOKS, PAIRINGS, FONTS, LAYOUTS, PAPERS, TONES, paperOf, fam, loadFont, contrast, fixContrast, onColour, lum, shade, portalAccent, paletteFromImage, whiteLogo, squareMark, monogram, zip, download, signatureHtml, brandFor } from '../../lib/brand'

// Brand kit: one place that decides how the creative looks everywhere a client sees them. Four tabs on
// the left (Look, Documents, Everywhere, Share), one live preview on the right that shows every surface
// the kit lands on, on a phone or a desktop. Nothing here needs the backend.
const SWATCH = ['#8DF3D6', '#1DB954', '#FF2D78', '#C6A5E5', '#F5B942', '#4A9EFF', '#E8572A', '#14111a']
const SURF = [['inv', 'Invoice'], ['q', 'Quote'], ['c', 'Contract'], ['portal', 'Portal'], ['gal', 'Gallery'], ['booking', 'Booking page'], ['profile', 'Profile'], ['email', 'Email'], ['receipt', 'Receipt']]
const TABS = [['look', 'Look'], ['docs', 'Documents'], ['every', 'Everywhere'], ['share', 'Share']]
const POS = [['tl', 'Top left'], ['tr', 'Top right'], ['c', 'Centre'], ['bl', 'Bottom left'], ['br', 'Bottom right']]
const ago = t => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago' }

export default function BrandKit() {
  const F = useFlows(); const { s, toast } = F
  const [b, setB] = useState(s.brand); const file = useRef(), lightFile = useRef(), overFile = useRef()
  const [tab, setTab] = useState('look'), [doc, setDoc] = useState('inv'), [dev, setDev] = useState('phone'), [dirty, setDirty] = useState(false), [od, setOd] = useState('inv'), [logoInfo, setLogoInfo] = useState(null), [busy, setBusy] = useState(false)
  useEffect(() => { if (!dirty) setB(s.brand) }, [s.brand, dirty])
  useEffect(() => { loadFont(b.head); loadFont(b.body) }, [b.head, b.body])
  const set = (k, v) => { setB(x => ({ ...x, [k]: v })); setDirty(true) }
  const setM = o => { setB(x => ({ ...x, ...o })); setDirty(true) }
  const setV = (k, v) => set('voice', { ...(b.voice || {}), [k]: v })
  const setOver = (kind, k, v) => set('over', { ...(b.over || {}), [kind]: { ...((b.over || {})[kind] || {}), [k]: v } })
  const [saving, setSaving] = useState(false)
  const saveLive = async () => { if (saving) return; setSaving(true); try { const nb = await live.saveBrandKit(F.me.id, b); F.set('brandHistory', h => [{ at: Date.now(), b: s.brand, note: 'Edited' }, ...(h || [])].slice(0, 10)); F.set('brand', nb); setB(nb); setDirty(false); toast('Saved. Quotes, invoices, emails, your profile and website use it from now.') } catch (e) { toast(e.message) } finally { setSaving(false) } }
  const save = () => { if (LIVE) return saveLive(); F.set('brandHistory', h => [{ at: Date.now(), b: s.brand, note: b.look && b.look !== s.brand.look ? 'Look: ' + (LOOKS.find(l => l.id === b.look)?.n || b.look) : 'Edited' }, ...(h || [])].slice(0, 20)); F.set('brand', b); if (b.everywhere) F.patch('profile', { h: b.tag }); setDirty(false); toast('Saved. Every document, email and page uses it from now.') }
  const PP = paperOf(b.paper), acc = b.accent
  // ── logo intelligence ──
  const analyse = async src => { try { const info = await paletteFromImage(src); const mark = await squareMark(src); setLogoInfo(info); setM({ mark, logoDark: info.dark > 0.55 ? 1 : 0 }); if (info.colours[0] && info.dark < 0.55) toast('Logo in. I pulled ' + info.colours.length + ' colours out of it, pick one for the accent.') } catch { toast('Logo in.') } }
  const pick = (ref, then) => { ref.current.onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => then(r.result); r.readAsDataURL(f); e.target.value = '' }; ref.current.click() }
  const pickLogo = () => pick(file, src => { setM({ logo: src, logoLight: '' }); analyse(src) })
  useEffect(() => { if (b.logo && !logoInfo) paletteFromImage(b.logo).then(setLogoInfo).catch(() => {}) }, []) // eslint-disable-line
  const makeWhite = async () => { setBusy(true); const w = await whiteLogo(b.logo).catch(() => null); setBusy(false); if (!w) return toast('That logo has no transparent background, so a white version needs a file from you.'); set('logoLight', w); toast('White version made for dark backgrounds.') }
  const useMono = () => { const m = monogram(b.name, acc, PP[3], b.head); setM({ logo: '', mark: m, logoLight: '' }); toast('Monogram set as the mark. It updates with your name and accent.') }
  // ── contrast ──
  const checks = useMemo(() => [
    ['Total line on the ' + PP[1].toLowerCase() + ' paper', acc, PP[2], 3],
    ['Text on your accent buttons', onColour(acc), acc, 4.5],
    ['Links on the dark portal · lifted to ' + portalAccent(acc).toUpperCase(), portalAccent(acc), '#0b0b10', 4.5],
    ['Sign-off line on paper', acc, PP[2], 4.5],
  ].map(([l, fg, bg, min]) => { const r = contrast(fg, bg); let fix = acc; if (fg === acc) fix = fixContrast(acc, bg, min); else if (bg === acc) { let c = acc; const dir = lum(fg) > 0.5 ? -0.03 : 0.03; for (let i = 0; i < 30 && contrast(onColour(c), c) < min; i++) c = shade(c, dir); fix = c } return { l, fg, bg, min, r, fix } }), [acc, PP])
  const fails = checks.filter(c => c.r < c.min)
  // ── looks, pairings ──
  const applyLook = L => { setM({ look: L.id, head: L.head, body: L.body, accent: L.accent, paper: L.paper, layout: L.layout, radius: L.radius, voice: { ...(b.voice || {}), tone: L.tone } }); toast(L.n + ' applied. Now make it yours.') }
  const applyPair = P => { setM({ head: P[1], body: P[2] }); loadFont(P[1]); loadFont(P[2]) }
  // ── share ──
  const slug = (s.site?.domain || 'you.lenstrybe.com').split('.')[0]
  const brandUrl = 'https://lenstrybe.com/brand/' + slug
  const sigHtml = signatureHtml(b, s.profile, s.settings)
  const copy = (t, m) => { navigator.clipboard?.writeText(t)?.catch(() => {}); toast(m) }
  const sheetHtml = () => `<!doctype html><html><head><meta charset="utf-8"><title>${b.name} · brand sheet</title><link href="https://fonts.googleapis.com/css2?family=${b.head.replace(/ /g, '+')}:wght@400;600&family=${b.body.replace(/ /g, '+')}:wght@400;600&display=swap" rel="stylesheet"><style>body{margin:0;padding:48px;font-family:${fam(b.body)};color:#14111a;background:#fff}h1{font-family:${fam(b.head)};font-size:34px;margin:0 0 4px}.sub{color:#6b6877;margin:0 0 32px}.row{display:flex;gap:16px;margin:0 0 28px;flex-wrap:wrap}.sw{width:120px;height:120px;border-radius:14px;display:flex;align-items:flex-end;padding:10px;box-sizing:border-box;font-size:11px;font-weight:600;border:1px solid #eee}.lbl{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#8b8a9a;font-weight:700;margin:0 0 10px}.spec{font-size:26px;margin:0 0 6px;font-family:${fam(b.head)}}.body{font-size:14px;color:#4a4756;max-width:520px}.logos{display:flex;gap:16px;align-items:center}.logos div{padding:18px;border-radius:12px;border:1px solid #eee}.dark{background:#14111a}.tone span{display:inline-block;padding:5px 10px;border-radius:99px;border:1px solid #ddd;margin-right:6px;font-size:12px}img{height:44px}.foot{margin-top:40px;font-size:11px;color:#8b8a9a}@media print{body{padding:24px}}</style></head><body><h1>${b.name}</h1><p class="sub">${b.tag || ''}</p><p class="lbl">Logo</p><div class="logos">${b.logo ? `<div><img src="${b.logo}"></div>` : ''}${b.logoLight ? `<div class="dark"><img src="${b.logoLight}"></div>` : ''}${b.mark ? `<div><img src="${b.mark}"></div>` : ''}</div><p class="lbl" style="margin-top:28px">Colour</p><div class="row"><div class="sw" style="background:${acc};color:${onColour(acc)}">Accent ${acc.toUpperCase()}</div><div class="sw" style="background:${PP[2]};color:${PP[3]}">Paper ${PP[2].toUpperCase()}</div><div class="sw" style="background:${PP[3]};color:${PP[2]}">Ink ${PP[3].toUpperCase()}</div></div><p class="lbl">Type</p><p class="spec">${b.head} for headings</p><p class="body">${b.body} for everything else. Layout: ${b.layout}. Corners: ${b.radius}px.</p><p class="lbl" style="margin-top:28px">Voice</p><p class="tone">${(b.voice?.tone || []).map(t => '<span>' + t + '</span>').join('')}</p><p class="body">Opens with “${b.voice?.greet || 'Hi'}”, signs off “${b.voice?.signoff || ''}”.${b.voice?.banned ? ' Never: ' + b.voice.banned + '.' : ''}</p><p class="lbl" style="margin-top:28px">On documents</p><p class="body">${b.foot}<br>${b.terms}<br>${b.lic}</p><p class="foot">Brand sheet · ${b.name} · made with LensTrybe</p></body></html>`
  const downloadAssets = () => { const files = [['brand-sheet.html', sheetHtml()], ['colours.txt', `Accent ${acc}\nPaper ${PP[2]}\nInk ${PP[3]}\nHeadings ${b.head}\nBody ${b.body}\n`], ['email-signature.html', sigHtml]]; if (b.logo) files.push(['logo.' + (b.logo.startsWith('data:image/svg') ? 'svg' : 'png'), b.logo]); if (b.logoLight) files.push(['logo-white.png', b.logoLight]); if (b.mark) files.push(['mark.' + (b.mark.startsWith('data:image/svg') ? 'svg' : 'png'), b.mark]); download(zip(files), b.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-brand-kit.zip'); toast('Brand kit downloaded: ' + files.length + ' files.') }
  const printSheet = () => { const w = window.open('', '_blank'); if (!w) return; w.document.write(sheetHtml()); w.document.close(); setTimeout(() => w.print(), 600) }
  const restore = h => { setB(h.b); setDirty(true); toast('Restored the version from ' + ago(h.at) + '. Save to keep it.') }
  const Tg = ({ k, l, hint }) => <label className="brow"><span>{l}{hint && <small>{hint}</small>}</span><span className={'sw2' + (b[k] ? ' on' : '')} onClick={() => set(k, b[k] ? 0 : 1)} role="switch" aria-checked={!!b[k]}><i /></span></label>
  const Swatches = ({ v, on, extra = [] }) => <div className="swatches">{[...extra, ...SWATCH].map(c => <button key={c} type="button" className={'swatch' + (v === c ? ' on' : '')} style={{ background: c }} onClick={() => on(c)} aria-label={c} />)}<label className="swatch custom" style={{ background: v || acc }}><input type="color" value={v || acc} onChange={e => on(e.target.value)} aria-label="Custom colour" /><Icon name="plus" size={14} /></label><code className="hex">{(v || acc).toUpperCase()}</code></div>

  return (
    <section className="view bk">
      <div className="vh">
        <div><h1>Brand kit</h1><p>One look, everywhere a client sees you: documents, portal, gallery, booking page, emails.</p></div>
        <div className="acts">{!LIVE && <button className="btn g" onClick={() => F.open({ title: 'Send a preview', sub: 'A sample invoice and portal link with this kit, to your phone or inbox.', cta: 'Send', fields: [{ k: 'to', l: 'Send to', type: 'select', value: 'phone', options: [['phone', s.settings.phone], ['email', s.settings.email]] }], submit: v => toast('Preview sent to ' + (v.to === 'phone' ? s.settings.phone : s.settings.email) + '.') })}>Send a preview</button>}<button className={'btn w' + (dirty ? '' : ' quiet')} onClick={save} disabled={saving}>{saving ? <><span className="spin" />Saving</> : dirty ? 'Save kit' : 'Saved'}</button></div>
      </div>
      <div className="grid">
        <div className="s6 side">
          <div className="tfilt seg3 bktabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>

          {tab === 'look' && <>
            <div className="card lg"><div className="h"><b>Start from a look</b><small className="lumi-by">Six complete kits. Pick one, then make it yours.</small></div>
              <div className="looks">{LOOKS.map(L => { const P = paperOf(L.paper); return <button key={L.id} type="button" className={'look' + (b.look === L.id ? ' on' : '')} style={{ background: P[2], color: P[3], '--acc': L.accent }} onClick={() => applyLook(L)}><span className="lk-band" style={{ height: L.layout === 'band' ? 14 : L.layout === 'minimal' ? 2 : 6, borderRadius: L.layout === 'band' ? L.radius / 2 : 0 }} /><b style={{ fontFamily: fam(L.head) }}>{L.n}</b><small style={{ fontFamily: fam(L.body) }}>{L.s}</small><i className="lk-dot" /></button> })}</div>
            </div>
            <div className="card lg">
              <div className="h"><b>Logo and name</b>{b.logo && <button className="lnk" onClick={() => { setM({ logo: '', logoLight: '', mark: '' }); setLogoInfo(null) }}>Remove logo</button>}</div>
              <div className="logo-row">
                <input ref={file} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" style={{ display: 'none' }} aria-hidden="true" /><input ref={lightFile} type="file" accept="image/png,image/svg+xml" style={{ display: 'none' }} aria-hidden="true" />
                <button type="button" className="logo-drop" onClick={pickLogo} style={{ fontFamily: fam(b.head) }}>{b.logo ? <img src={b.logo} alt="" style={{ height: 34, maxWidth: 120, objectFit: 'contain' }} /> : b.mark ? <img src={b.mark} alt="" style={{ height: 40, width: 40, borderRadius: 10 }} /> : <><span className="mark" style={{ background: acc }} />{b.name.split(' ')[0]}</>}<small>Tap to replace · PNG or SVG</small></button>
                <div className="fields">
                  <label className="bf"><span>Business name</span><input value={b.name} onChange={e => set('name', e.target.value)} /></label>
                  <label className="bf"><span>One line under it</span><input value={b.tag} onChange={e => set('tag', e.target.value)} /></label>
                </div>
              </div>
              <div className="logovars">
                <div className="lv"><span className="lvb light">{b.logo ? <img src={b.logo} alt="" /> : b.mark ? <img src={b.mark} alt="" /> : <span className="wordmark" style={{ fontFamily: fam(b.head), color: '#14111a' }}><i style={{ background: acc }} />{b.name.split(' ')[0]}</span>}</span><small>On white</small></div>
                <div className="lv"><span className="lvb dark">{b.logoLight ? <img src={b.logoLight} alt="" /> : b.logo ? <img src={b.logo} alt="" style={{ opacity: b.logoDark ? .25 : 1 }} /> : b.mark ? <img src={b.mark} alt="" /> : <span className="wordmark" style={{ fontFamily: fam(b.head), color: '#f4f2f7' }}><i style={{ background: acc }} />{b.name.split(' ')[0]}</span>}</span><small>On dark</small></div>
                <div className="lv"><span className="lvb light sq">{b.mark ? <img src={b.mark} alt="" /> : <img src={monogram(b.name, acc, PP[3], b.head)} alt="" style={{ opacity: .45 }} />}</span><small>Mark · avatar, favicon</small></div>
                <div className="lvt">
                  {b.logo && b.logoDark && !b.logoLight ? <p className="warn"><Icon name="eye" size={13} /> Your logo is mostly dark, so it disappears on the portal and the dark emails. <button className="lnk" onClick={makeWhite} disabled={busy}>{busy ? 'Making…' : 'Make a white version'}</button> or <button className="lnk" onClick={() => pick(lightFile, src => { set('logoLight', src); toast('Light logo in.') })}>upload one</button>.</p>
                    : b.logo ? <p className="ok"><Icon name="check" size={13} /> Reads on both. {b.logoLight ? 'Light version set for dark backgrounds.' : 'The mark was cropped from the logo for avatars and the favicon.'}</p>
                      : <p>No logo yet. <button className="lnk" onClick={useMono}>Use a monogram</button> from your initials in the accent, and swap it any time.</p>}
                  {b.logo && !b.logoLight && !b.logoDark && <button className="lnk" onClick={() => pick(lightFile, src => { set('logoLight', src); toast('Light logo in.') })}>Add a light version anyway</button>}
                </div>
              </div>
            </div>
            <div className="card lg">
              <div className="h"><b>Colour</b><small className="lumi-by">One accent. Everything else stays quiet.</small></div>
              {logoInfo?.colours?.length > 0 && <div className="fromlogo"><small>From your logo</small><div className="swatches">{logoInfo.colours.map(c => <button key={c} type="button" className={'swatch' + (acc === c ? ' on' : '')} style={{ background: c }} onClick={() => set('accent', c)} aria-label={c} />)}</div></div>}
              <Swatches v={acc} on={c => set('accent', c)} />
              <small className="lbl2">Paper</small>
              <div className="papers">{PAPERS.map(p => <button key={p[0]} type="button" className={'pap' + (b.paper === p[0] ? ' on' : '')} style={{ background: p[2], color: p[3] }} onClick={() => set('paper', p[0])}><b style={{ color: acc }}>$2,240</b><span>{p[1]}</span></button>)}</div>
              <div className="contrast">
                {checks.map(c => <div key={c.l} className={'cr' + (c.r >= c.min ? ' ok' : ' bad')}><span className="chip2" style={{ background: c.bg, color: c.fg, borderColor: c.bg === '#ffffff' ? '#e3e1e8' : c.bg }}>Aa</span><span className="cl">{c.l}<small>{c.r.toFixed(1)} : 1 · needs {c.min}</small></span>{c.r >= c.min ? <Icon name="check" size={14} /> : c.fix !== acc && contrast(c.fg === acc ? c.fix : c.fg, c.bg === acc ? c.fix : c.bg) >= c.min ? <button className="lnk" onClick={() => set('accent', c.fix)}>Fix to {c.fix.toUpperCase()}</button> : <span className="lnk" style={{ color: 'var(--amber-t)' }}>Fails</span>}</div>)}
                <p className="note2">{fails.length ? fails.length + ' of 4 checks fail. Fix nudges the accent just far enough to pass.' : 'Passes everywhere it lands. WCAG AA on every surface.'}</p>
              </div>
            </div>
            <div className="card lg">
              <div className="h"><b>Type</b></div>
              <div className="pairs">{PAIRINGS.map(P => <button key={P[0]} type="button" className={'pair' + (b.head === P[1] && b.body === P[2] ? ' on' : '')} onClick={() => applyPair(P)} onMouseEnter={() => { loadFont(P[1]); loadFont(P[2]) }}><b style={{ fontFamily: fam(P[1]) }}>{P[0]}</b><small style={{ fontFamily: fam(P[2]) }}>{P[3]}</small></button>)}</div>
              <div className="fields two">
                <label className="bf"><span>Headings</span><select value={b.head} onChange={e => set('head', e.target.value)}>{FONTS.map(f => <option key={f}>{f}</option>)}</select></label>
                <label className="bf"><span>Body</span><select value={b.body} onChange={e => set('body', e.target.value)}>{FONTS.map(f => <option key={f}>{f}</option>)}</select></label>
              </div>
              <div className="specimen" style={{ background: PP[2], color: PP[3] }}>
                <p className="t1" style={{ fontFamily: fam(b.head) }}>Tax invoice</p>
                <p className="t2" style={{ fontFamily: fam(b.body) }}>Harper and Leo · Maleny Manor · Sat 7 Nov</p>
                <p className="t3" style={{ fontFamily: fam(b.body) }}>Full day coverage, ten hours, two photographers, online gallery within eight weeks. Deposit locks the date, balance seven days before. This is the size a client reads it at.</p>
                <p className="t4" style={{ fontFamily: fam(b.body), color: acc }}>{b.foot}</p>
              </div>
            </div>
            <div className="card lg">
              <div className="h"><b>Layout</b></div>
              <div className="layouts">{LAYOUTS.map(([k, l, h]) => <button key={k} type="button" className={'lay' + (b.layout === k ? ' on' : '')} onClick={() => set('layout', k)}><span className="lay-th" style={{ background: PP[2], '--acc': acc, borderRadius: (b.radius ?? 12) / 3 }}>{k === 'band' ? <i className="bd" /> : k === 'minimal' ? <i className="rl" /> : <i className="cl2" />}<u /><u /><u className="w" /></span><b>{l}</b><small>{h}</small></button>)}</div>
              <label className="bf range"><span>Corners · {b.radius ?? 12}px</span><input type="range" min="0" max="24" value={b.radius ?? 12} onChange={e => set('radius', Number(e.target.value))} /></label>
            </div>
          </>}

          {tab === 'docs' && <>
            <div className="card lg">
              <div className="h"><b>On every document</b></div>
              <label className="bf"><span>Sign-off line</span><input value={b.foot} onChange={e => set('foot', e.target.value)} /></label>
              <label className="bf"><span>Payment terms</span><input value={b.terms} onChange={e => set('terms', e.target.value)} /></label>
              <label className="bf"><span>Licence and usage</span><input value={b.lic} onChange={e => set('lic', e.target.value)} /></label>
              <div className="brows">
                <Tg k="phone" l="Show phone" /><Tg k="site" l="Show website" /><Tg k="abn" l="Show ABN" /><Tg k="gst" l="Show GST (10%)" /><Tg k="pay" l="Show payment details" /><Tg k="emailHead" l="Same header on every email" />
              </div>
            </div>
            <div className="card lg">
              <div className="h"><b>Per document</b><div className="tfilt" style={{ padding: 0 }}>{[['inv', 'Invoice'], ['q', 'Quote'], ['c', 'Contract']].map(([k, l]) => <button key={k} className={od === k ? 'on' : ''} onClick={() => { setOd(k); setDoc(k) }}>{l}</button>)}</div></div>
              {(() => { const o = (b.over || {})[od] || {}; const has = Object.values(o).some(Boolean); return <>
                <p className="note2">{has ? 'This document strays from the base kit. ' : 'Uses the base kit. Change anything below for ' + { inv: 'invoices', q: 'quotes', c: 'contracts' }[od] + ' only. '}{has && <button className="lnk" onClick={() => set('over', { ...(b.over || {}), [od]: {} })}>Reset to base</button>}</p>
                <div className="fields two">
                  <label className="bf"><span>Number prefix</span><input value={o.prefix ?? ''} placeholder={{ inv: 'INV-', q: 'Q-', c: 'C-' }[od]} onChange={e => setOver(od, 'prefix', e.target.value)} /></label>
                  <label className="bf"><span>Layout</span><select value={o.layout || ''} onChange={e => setOver(od, 'layout', e.target.value)}><option value="">Base · {LAYOUTS.find(l => l[0] === b.layout)?.[1]}</option>{LAYOUTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                </div>
                <small className="lbl2">Accent {o.accent ? '· override' : '· base'}</small>
                <div className="swatches">{o.accent && <button type="button" className="swatch base" onClick={() => setOver(od, 'accent', '')} title="Back to base" style={{ background: acc }}><Icon name="x" size={12} /></button>}{SWATCH.map(c => <button key={c} type="button" className={'swatch' + ((o.accent || acc) === c ? ' on' : '')} style={{ background: c }} onClick={() => setOver(od, 'accent', c === acc ? '' : c)} aria-label={c} />)}<label className="swatch custom" style={{ background: o.accent || acc }}><input type="color" value={o.accent || acc} onChange={e => setOver(od, 'accent', e.target.value)} aria-label="Custom colour" /><Icon name="plus" size={14} /></label></div>
                <small className="lbl2">Logo {o.logo ? '· override' : '· base'}</small>
                <input ref={overFile} type="file" accept="image/png,image/svg+xml,image/jpeg" style={{ display: 'none' }} aria-hidden="true" />
                <div className="ovlogo">{o.logo ? <img src={o.logo} alt="" /> : b.logo ? <img src={b.logo} alt="" style={{ opacity: .5 }} /> : <span className="mark" style={{ background: acc }} />}<button className="btn g sm" onClick={() => pick(overFile, src => setOver(od, 'logo', src))}>{o.logo ? 'Change' : 'Different logo here'}</button>{o.logo && <button className="lnk" onClick={() => setOver(od, 'logo', '')}>Use base</button>}</div>
              </> })()}
            </div>
          </>}

          {tab === 'every' && <>
            <div className="card lg">
              <div className="h"><b>Watermark</b><span className={'sw2' + (b.wm ? ' on' : '')} onClick={() => set('wm', b.wm ? 0 : 1)} role="switch" aria-checked={!!b.wm}><i /></span></div>
              <div className="wmprev" style={{ borderRadius: (b.radius ?? 12) }}>
                <Still seed={7} mood="golden" />
                {b.wm ? <span className={'wmk ' + b.wmPos} style={{ opacity: b.wmOpacity ?? .4, fontSize: 10 + (b.wmSize ?? 2) * 5, fontFamily: fam(b.head) }}>{b.wmMode === 'logo' && (b.logoLight || b.logo || b.mark) ? <img src={b.logoLight || b.logo || b.mark} alt="" style={{ height: 14 + (b.wmSize ?? 2) * 10 }} /> : (b.wmText || b.name)}</span> : null}
              </div>
              {b.wm ? <>
                <div className="fields two">
                  <label className="bf"><span>Mark</span><select value={b.wmMode || 'text'} onChange={e => set('wmMode', e.target.value)}><option value="text">Text</option><option value="logo">Logo</option></select></label>
                  <label className="bf"><span>Text</span><input value={b.wmText ?? ''} placeholder={b.name} onChange={e => set('wmText', e.target.value)} disabled={b.wmMode === 'logo'} /></label>
                </div>
                <small className="lbl2">Position</small>
                <div className="wmpos">{POS.map(([k, l]) => <button key={k} type="button" className={'wmp ' + k + (b.wmPos === k ? ' on' : '')} onClick={() => set('wmPos', k)} title={l}><i /></button>)}</div>
                <div className="fields two">
                  <label className="bf range"><span>Size</span><input type="range" min="1" max="4" value={b.wmSize ?? 2} onChange={e => set('wmSize', Number(e.target.value))} /></label>
                  <label className="bf range"><span>Opacity · {Math.round((b.wmOpacity ?? .4) * 100)}%</span><input type="range" min="10" max="90" value={Math.round((b.wmOpacity ?? .4) * 100)} onChange={e => set('wmOpacity', Number(e.target.value) / 100)} /></label>
                </div>
              </> : <p className="note2">Off. Gallery previews show clean; downloads are always clean.</p>}
            </div>
            <div className="card lg">
              <div className="h"><b>Email signature</b><button className="lnk" onClick={() => copy(sigHtml, 'Signature HTML copied. Paste into Gmail or Apple Mail signature settings.')}>Copy HTML</button></div>
              <div className="sigprev" dangerouslySetInnerHTML={{ __html: sigHtml }} />
              <p className="note2">Built from the kit, your name and Settings. The same header and sign-off go on every email LensTrybe sends for you{b.emailHead ? '' : ' once “Same header on every email” is on under Documents'}.</p>
            </div>
            <div className="card lg">
              <div className="h"><b>Voice</b><small className="lumi-by">How Lumi writes when it writes as you.</small></div>
              <small className="lbl2">Tone · pick up to four</small>
              <div className="chips2">{TONES.map(t => { const on = (b.voice?.tone || []).includes(t); return <button key={t} type="button" className={'chip' + (on ? ' p' : '')} onClick={() => { const cur = b.voice?.tone || []; if (!on && cur.length >= 4) return toast('Four is plenty. Drop one first.'); setV('tone', on ? cur.filter(x => x !== t) : [...cur, t]) }}>{t}</button> })}</div>
              <div className="fields two">
                <label className="bf"><span>Opens with</span><input value={b.voice?.greet ?? ''} placeholder="Hi" onChange={e => setV('greet', e.target.value)} /></label>
                <label className="bf"><span>Signs off</span><input value={b.voice?.signoff ?? ''} placeholder="Mara x" onChange={e => setV('signoff', e.target.value)} /></label>
              </div>
              <label className="bf"><span>Never say</span><input value={b.voice?.banned ?? ''} placeholder="Kindly, Please be advised, ASAP" onChange={e => setV('banned', e.target.value)} /></label>
              <div className="voicesample"><small>How a nudge reads</small><p>{b.voice?.greet || 'Hi'} Harper, just checking you saw the quote. Happy to tweak anything, and the date is pencilled for you until Friday.<br /><br />{b.voice?.signoff || s.profile.n}</p></div>
            </div>
          </>}

          {tab === 'share' && <>
            <div className="card lg">
              <div className="h"><b>Brand assets</b></div>
              <p className="note2">One zip for second shooters, venues and printers: {b.logo ? 'logo' : 'no logo yet'}{b.logoLight ? ', white logo' : ''}{b.mark ? ', square mark' : ''}, colour codes, the email signature and a one-page brand sheet.</p>
              <div className="acts" style={{ marginTop: 10 }}><button className="btn w" onClick={downloadAssets}><Icon name="deliver" size={15} />Download the kit</button><button className="btn g" onClick={printSheet}><Icon name="doc" size={15} />Brand sheet PDF</button></div>
            </div>
            {!LIVE && <div className="card lg">
              <div className="h"><b>Brand page</b><span className={'sw2' + (b.brandPublic ? ' on' : '')} onClick={() => set('brandPublic', b.brandPublic ? 0 : 1)} role="switch" aria-checked={!!b.brandPublic}><i /></span></div>
              <p className="note2">A public page with your logo, colours and fonts, so collaborators pull the right files without emailing you.</p>
              <div className="linkrow"><code>{brandUrl}</code><button className="btn g sm" onClick={() => copy(brandUrl, 'Link copied.')}>Copy</button><a className="btn g sm" href={'/brand/' + slug} target="_blank" rel="noreferrer">Open</a></div>
              {!b.brandPublic && <p className="note2 warn2">Off: the link shows “not shared yet”. Switch it on to publish.</p>}
            </div>}
            <div className="card lg">
              <div className="h"><b>History</b><small className="lumi-by">Every save is a version.</small></div>
              {(s.brandHistory || []).length ? <div className="hist">{(s.brandHistory || []).map((h, i) => <div key={h.at} className="hr"><span className="hsw" style={{ background: h.b.accent }} /><div><b>{h.note || 'Edited'}</b><small>{ago(h.at)} · {h.b.head} / {h.b.body} · {h.b.accent.toUpperCase()}</small></div><button className="act2" onClick={() => restore(h)}>Restore</button></div>)}</div> : <p className="note2">Nothing yet. The first save starts the trail.</p>}
            </div>
            <div className="card lg">
              <div className="h"><b>Where it applies</b></div>
              <div className="brows one">
                <label className="brow"><span>Public profile and website<small>Tagline, accent and fonts on your LensTrybe page</small></span><span className={'sw2' + (b.everywhere ? ' on' : '')} onClick={() => set('everywhere', b.everywhere ? 0 : 1)} role="switch" aria-checked={!!b.everywhere}><i /></span></label>
                <label className="brow"><span>Documents, portal, gallery, emails<small>Always on</small></span><span className="sw2 on" style={{ opacity: .5 }}><i /></span></label>
              </div>
            </div>
          </>}
        </div>

        <div className="s6 side sticky">
          <div className="card lg prev">
            <div className="h"><b>How it looks</b><div className="tfilt seg3 devseg">{[['phone', 'Phone'], ['desktop', 'Desktop']].map(([k, l]) => <button key={k} className={dev === k ? 'on' : ''} onClick={() => setDev(k)}>{l}</button>)}</div></div>
            <div className="tfilt surf">{SURF.map(([k, l]) => <button key={k} className={doc === k ? 'on' : ''} onClick={() => setDoc(k)}>{l}</button>)}</div>
            <div className={'stage ' + dev}>
              <div className={'frame ' + dev}><Surface kind={doc} b={b} s={s} /></div>
            </div>
          </div>
          <div className="tlumi"><span className="lm" /><div>{fails.length ? 'The ' + acc.toUpperCase() + ' accent fails ' + fails.length + (fails.length === 1 ? ' contrast check' : ' contrast checks') + ': ' + fails.map(f => f.l.toLowerCase()).join(', ') + '. ' + (fails[0].fix !== acc ? 'Nudging it to ' + fails[0].fix.toUpperCase() + ' fixes the first without changing the feel.' : 'A darker or lighter accent fixes it.') : b.logo && b.logoDark && !b.logoLight ? 'Everything passes, but your logo needs a light version for the dark portal. One tap makes it.' : 'Passes contrast on every surface' + (b.logo || b.mark ? ', logo reads on both backgrounds' : '') + '. Nothing to fix.'}{fails.length > 0 && fails[0].fix !== acc && <div className="acts"><button className="y" onClick={() => set('accent', fails[0].fix)}>Fix it</button>{b.logo && b.logoDark && !b.logoLight && <button onClick={makeWhite}>White logo</button>}</div>}</div></div>
        </div>
      </div>
    </section>
  )
}

// ── every surface the kit lands on, drawn from the draft kit ────────────────
function Surface({ kind, b, s }) {
  const B = ['inv', 'q', 'c'].includes(kind) ? brandFor(b, kind) : { ...b, layout: b.layout || 'classic' }
  const PP = paperOf(b.paper), acc = B.accent, H = fam(b.head), Bf = fam(b.body), rad = (b.radius ?? 12) + 'px'
  const logo = (dark) => (dark ? (b.logoLight || b.mark || b.logo) : (B.logo || b.mark)) ? <img className="blogo" src={dark ? (b.logoLight || b.mark || b.logo) : (B.logo || b.mark)} alt="" /> : <span className="mark" style={{ background: acc }} />
  const head = title => B.layout === 'band' ? <div className="band" style={{ background: acc, color: onColour(acc), borderRadius: `calc(${rad} * .6)` }}><div>{logo(onColour(acc) === '#ffffff')}<b style={{ fontFamily: H }}>{b.name}</b></div><b className="bt" style={{ fontFamily: H }}>{title}</b></div>
    : <div className={'ptop' + (B.layout === 'minimal' ? ' minimal' : '')} style={B.layout === 'minimal' ? { borderBottom: '1.5px solid ' + acc } : undefined}><div>{logo(b.paper === 'dark')}<b style={{ fontFamily: H }}>{b.name}</b><small>{b.tag}</small></div><div className="meta"><b style={{ fontFamily: H, color: B.layout === 'classic' ? acc : undefined }}>{title}</b></div></div>
  const paperStyle = { '--acc': acc, '--pp': PP[2], '--pi': PP[3], '--rad': rad, fontFamily: Bf, background: PP[2], color: PP[3], borderRadius: rad }
  const wm = b.wm ? <span className={'wmk ' + (b.wmPos || 'br')} style={{ opacity: b.wmOpacity ?? .4, fontSize: 5 + (b.wmSize ?? 2) * 2, fontFamily: H }}>{b.wmMode === 'logo' && (b.logoLight || b.logo) ? <img src={b.logoLight || b.logo} alt="" style={{ height: 6 + (b.wmSize ?? 2) * 3 }} /> : (b.wmText || b.name)}</span> : null
  if (['inv', 'q', 'c'].includes(kind)) return (
    <div className={'paper docp' + (b.paper === 'dark' ? ' dark' : '')} style={paperStyle}>
      {head(kind === 'inv' ? 'Invoice' : kind === 'q' ? 'Quote' : 'Contract')}
      <div className="meta2"><small>{B.prefix}{kind === 'inv' ? '0220 · due 7 Nov' : kind === 'q' ? '0418 · valid 9 days' : '0412 · 12 clauses'}</small>{b.abn ? <small>ABN 51 824 753 556</small> : null}</div>
      <div className="to"><small>{kind === 'c' ? 'Between' : 'To'}</small><b>Harper Ellis</b><span>harper.ellis@gmail.com</span></div>
      {kind === 'c' ? <div className="clauses">{['1. The day', '2. What you get', '3. Payment', '4. If plans change'].map(c => <p key={c}><b>{c}</b> Plain English, no surprises. {b.lic}</p>)}</div>
        : <table><tbody><tr><td>{kind === 'inv' ? 'Balance · Full day wedding' : '3 listings, bundle'}</td><td>{kind === 'inv' ? '$2,240.00' : '$1,026.00'}</td></tr>{b.gst ? <tr className="q"><td>Includes GST</td><td>{kind === 'inv' ? '$203.64' : '$93.27'}</td></tr> : null}<tr className="t"><td>Total</td><td style={{ color: acc }}>{kind === 'inv' ? '$2,240.00' : '$1,026.00'}</td></tr></tbody></table>}
      {kind !== 'c' && b.pay ? <div className="payd" style={{ borderRadius: `calc(${rad} * .7)` }}><b>Pay by card or transfer</b><span>{b.name} · BSB 484-799 · Acc 118 224 553</span><span>{b.terms}</span></div> : null}
      <div className="pfoot"><span style={{ color: acc }}>{b.foot}</span><span>{[b.phone && '0412 000 000', b.site && 'maraokafor.com'].filter(Boolean).join(' · ')}</span></div>
    </div>)
  if (kind === 'portal' || kind === 'gal') { const pa = portalAccent(acc); return (
    <div className="paper ptl darkp" style={{ ...paperStyle, '--acc': pa, background: '#0b0b10', color: '#f4f2f7' }}>
      <div className="ptop"><div>{(b.logoLight || b.mark || b.logo) ? <img className="blogo" src={b.logoLight || b.mark || b.logo} alt="" /> : <span className="mark" style={{ background: pa }} />}<b style={{ fontFamily: H }}>{b.name}</b></div></div>
      <h3 style={{ fontFamily: H }}>{kind === 'gal' ? 'Harper and Leo' : 'Hi Harper and Leo'}</h3>
      <p>{kind === 'gal' ? '412 photos · 2 films · expires in 88 days' : 'Your wedding on Sat 7 Nov at Maleny Manor. Everything for the day lives here.'}</p>
      {kind === 'gal' ? <div className="tiles">{[3, 5, 7, 9, 11, 13].map(i => <span key={i} style={{ borderRadius: `calc(${rad} * .5)` }}><Still seed={i} mood={i % 2 ? 'golden' : 'dusk'} />{wm}</span>)}</div>
        : <div className="steps">{['Quote accepted', 'Contract signed', 'Deposit paid', 'Shoot day', 'Gallery'].map((x, i) => <span key={x} className={i < 3 ? 'd' : ''}><i style={i < 3 ? { background: pa, borderColor: pa } : undefined} />{x}</span>)}</div>}
      <button className="pbtn" style={{ background: pa, color: onColour(pa), borderRadius: rad }}>{kind === 'gal' ? 'Download all' : 'Open the run sheet'}</button>
    </div>) }
  if (kind === 'booking') return (
    <div className="paper ptl" style={paperStyle}>
      <div className="ptop"><div>{logo(b.paper === 'dark')}<b style={{ fontFamily: H }}>{b.name}</b></div></div>
      <h3 style={{ fontFamily: H }}>Book a date</h3><p>{b.tag}</p>
      <div className="pkgs">{[['Half day', '$1,800', '5 hours'], ['Full day', '$3,200', '10 hours, two shooters'], ['Elopement', '$1,400', '3 hours']].map(([n, p, d], i) => <div key={n} className={'pkg' + (i === 1 ? ' on' : '')} style={{ borderRadius: `calc(${rad} * .7)`, borderColor: i === 1 ? acc : undefined }}><b style={{ fontFamily: H }}>{n}</b><span style={{ color: acc }}>{p}</span><small>{d}</small></div>)}</div>
      <button className="pbtn" style={{ background: acc, color: onColour(acc), borderRadius: rad }}>Check Sat 7 Nov</button>
    </div>)
  if (kind === 'profile') return (
    <div className="paper ptl bprof" style={paperStyle}>
      <div className="pav" style={{ borderRadius: rad }}><Still seed={3} mood="golden" /></div>
      <div className="pn"><span className="markrow">{logo(b.paper === 'dark')}</span><h3 style={{ fontFamily: H, margin: 0 }}>{s.profile.n}</h3><p style={{ margin: '2px 0 0' }}>{b.everywhere ? b.tag : s.profile.h}</p></div>
      <div className="kinds">{s.profile.kinds.slice(0, 4).map(k => <span key={k} style={{ borderRadius: rad, borderColor: acc, color: acc }}>{k}</span>)}</div>
      <div className="from"><small>From</small><b style={{ fontFamily: H }}>${s.profile.from}</b></div>
      <button className="pbtn" style={{ background: acc, color: onColour(acc), borderRadius: rad }}>Ask about a date</button>
    </div>)
  // email and receipt
  const receipt = kind === 'receipt'
  return (
    <div className="paper mail" style={{ ...paperStyle, background: '#f3f2f6', color: '#14111a' }}>
      <div className="mhead" style={{ background: b.emailHead ? acc : PP[2], color: b.emailHead ? onColour(acc) : PP[3], borderRadius: `${rad} ${rad} 0 0` }}>{logo(b.emailHead ? onColour(acc) === '#ffffff' : b.paper === 'dark')}<b style={{ fontFamily: H }}>{b.name}</b></div>
      <div className="mbody" style={{ background: PP[2], color: PP[3], borderRadius: `0 0 ${rad} ${rad}` }}>
        {receipt ? <><span className="mtick" style={{ background: acc, color: onColour(acc) }}><Icon name="check" size={14} /></span><h3 style={{ fontFamily: H }}>Paid, thank you</h3><p>{b.voice?.greet || 'Hi'} Harper, $2,240.00 for INV-0220 came through just now. Your receipt is attached and the gallery link lands the moment it's ready.</p></>
          : <><h3 style={{ fontFamily: H }}>Your quote is ready</h3><p>{b.voice?.greet || 'Hi'} Harper, here's the quote for Sat 7 Nov at Maleny Manor. Tap below to read it, accept on your phone and the date is yours.</p><span className="mbtn" style={{ background: acc, color: onColour(acc), borderRadius: rad }}>Open the quote</span></>}
        <p className="msig">{b.voice?.signoff || s.profile.n}</p>
        <div className="mfoot" style={{ color: acc }}>{b.foot}</div>
      </div>
    </div>)
}
