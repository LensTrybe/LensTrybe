import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import Aurora from '../../components/Aurora'
import Icon from '../../components/Icon'
import { mountLens } from '../../lib/lens'
import { CREATIVES } from '../../data/creatives'
import { LIVE } from '../../lib/mode'
import { loadCreatives } from '../../lib/live'
import { applySeo, SITE } from '../../lib/seo'
import { kindBySlug, placeBySlug, placeShort, placePre, at, matching, livePages, MIN_FOR } from '../../lib/places'
import { Card } from './Directory'
import { logImpressions, withUtm } from '../../lib/analytics'

// A local page for search (2 Oct 2026): "Wedding photographers in Brisbane" and the like, listing
// the real creatives there, with links on to nearby pages. See lib/places.js for how a creative is
// matched to a place and when a page is listed in search.
export default function Local() {
  const { kind: ks, place: ps } = useParams()
  const kind = kindBySlug(ks), place = placeBySlug(ps)
  const cv = useRef(null)
  const [all, setAll] = useState(LIVE ? null : CREATIVES)
  useEffect(() => { if (!LIVE) return; let on = true; loadCreatives().then(l => on && setAll(l)).catch(() => on && setAll([])); return () => { on = false } }, [])
  useEffect(() => { if (!cv.current) return; const l = mountLens(cv.current); l.layout({ cy: .5, r: .3 }); return () => l.destroy() }, [])
  const list = useMemo(() => kind && place ? matching(all, kind, place) : [], [all, kind, place])
  const pages = useMemo(() => livePages(all || []), [all])
  useEffect(() => { if (LIVE && all != null && list.length) void logImpressions(list.map(x => x.id)) }, [all, list])

  const title = kind && place ? kind.label + ' ' + at(place) : ''
  const path = kind && place ? '/' + kind.slug + '/' + place.slug : '/'
  useEffect(() => {
    if (!kind || !place || all == null) return
    const n = list.length, word = kind.label.toLowerCase()
    const lead = 'Find ' + word + ' ' + at(place) + '. '
    const body = n ? 'See their work, packages and reviews, check your date and ask for a quote on LensTrybe.' : 'Post your job on LensTrybe for free and local creatives reply with a real quote.'
    const description = lead + body + ((lead + body).length < 132 ? ' Free to ask, no commission.' : '')
    applySeo({
      title: title + ' · LensTrybe', description, path, noindex: n < MIN_FOR(kind),
      image: list.find(x => x.cover)?.cover,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'CollectionPage', '@id': SITE + path, url: SITE + path, name: title, description, inLanguage: 'en-AU', isPartOf: { '@type': 'WebSite', name: 'LensTrybe', url: SITE + '/' },
            mainEntity: { '@type': 'ItemList', numberOfItems: n, itemListElement: list.slice(0, 50).map((x, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + '/creatives/' + x.id, name: x.n })) } },
          { '@type': 'BreadcrumbList', itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'LensTrybe', item: SITE + '/' },
            { '@type': 'ListItem', position: 2, name: 'Find a creative', item: SITE + '/creatives' },
            { '@type': 'ListItem', position: 3, name: title, item: SITE + path },
          ] },
        ],
      },
    })
  }, [kind, place, all, list, title, path])

  if (!kind || !place) return <Navigate to={withUtm('/creatives')} replace />

  const n = list.length
  // links on: other kinds in this place, then this kind in other places (only pages worth landing on)
  const here = pages.filter(p => p.place.slug === place.slug && p.kind.slug !== kind.slug)
  const elsewhere = pages.filter(p => p.kind.slug === kind.slug && p.place.slug !== place.slug)
  const broader = kind.spec ? '/' + (kind.type === 'Photographer' ? 'photographers' : 'videographers') + '/' + place.slug : null

  return (
    <>
      <section className="hiw dirhero dark darkhero">
        <canvas className="gl" ref={cv} aria-hidden="true" />
        <div className="in">
          <p className="eb">{placeShort(place)} · {kind.type === 'Photographer' ? 'Photography' : 'Video'}</p>
          <h1><span className="ln"><span>{kind.label}</span></span> <span className="ln"><span>{placePre(place)} <em>{placeShort(place)}.</em></span></span></h1>
          <p className="sub">{intro(kind, place)}</p>
          <div className="ctas">
            <button type="button" className="btn w" onClick={() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' })}>See who's here <Icon name="arrow" size={14} /></button>
            <Link className="btn g" to="/jobs">Post a job for free</Link>
          </div>
        </div>
      </section>

      <div className="lt">
        <Aurora />
        <section className="sec" id="results" style={{ paddingTop: 'clamp(28px,4vw,48px)' }}><div className="wrap">
          <style>{CSS}</style>
          <div className="rbar">
            <span>{all == null ? 'Loading creatives…' : <><b>{n}</b> {n === 1 ? kind.one : kind.label.toLowerCase()} {at(place)}</>}</span>
            {broader && <Link className="lcl-more" to={broader}>All {kind.type === 'Photographer' ? 'photographers' : 'videographers'} {at(place)} <Icon name="arrow" size={12} /></Link>}
          </div>

          {all != null && (n
            ? <div className="cgrid">{list.map((x, i) => <Card key={x.id} x={x} i={i} />)}</div>
            : <div className="empty lg">There are no {kind.label.toLowerCase()} listed {at(place)} yet. Post your job for free and creatives who cover {place.name} can reply with a quote, or <Link to="/creatives" style={{ color: 'var(--green-t)', fontWeight: 600 }}>browse everyone</Link>.</div>)}

          <div className="lcl-grid">
            <div className="lcl-box lg">
              <h2>Hiring {at(place)}?</h2>
              <p>Tell us what you need, where and when. {kind.label} who do that work reply with a real price, and you choose. Posting is free, your contact details stay private until you pick someone, and LensTrybe never takes a cut of what you pay.</p>
              <Link className="btn k" to="/jobs">Post a job <Icon name="arrow" size={14} /></Link>
            </div>
            <div className="lcl-box lg">
              <h2>Are you {/^[aeiou]/.test(kind.one) ? 'an' : 'a'} {kind.one} {at(place)}?</h2>
              <p>Get a page clients can find, reply to local jobs, and run quotes, invoices, contracts and delivery in one place. A flat monthly plan, never a commission, and a free plan to start.</p>
              <Link className="btn g" to="/join/creative">Join as a creative</Link>
            </div>
          </div>

          {(here.length > 0 || elsewhere.length > 0) && (
            <nav className="lcl-links" aria-label="More creatives">
              {here.length > 0 && <div><h3>More {at(place)}</h3><div className="lcl-chips">{here.map(p => <Link key={p.path} to={p.path}>{p.kind.label}</Link>)}</div></div>}
              {elsewhere.length > 0 && <div><h3>{kind.label} nearby</h3><div className="lcl-chips">{elsewhere.map(p => <Link key={p.path} to={p.path}>{placeShort(p.place)}</Link>)}</div></div>}
            </nav>
          )}
        </div></section>
      </div>
    </>
  )
}

// The opening line, in the page's own words for the kind and the place
function intro(kind, place) {
  const who = kind.label.toLowerCase(), where = placeShort(place)
  const what = 'Looking for ' + (/^[aeiou]/.test(kind.one) ? 'an ' : 'a ') + kind.one + ' ' + at(place) + '? '
  return what + 'Browse ' + who + ' based in and around ' + (placePre(place) === 'in' ? '' : 'the ') + where + ', see their work, packages and reviews, and ask for a quote. Free to ask, and no commission, ever.'
}

const CSS = `
.pub .lcl-more{font-size:13.5px;font-weight:600;color:var(--green-t);display:inline-flex;align-items:center;gap:6px}
.pub .lcl-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:clamp(40px,6vw,64px)}
.pub .lcl-box{border-radius:24px;padding:clamp(22px,3vw,30px);display:flex;flex-direction:column;align-items:flex-start;gap:12px}
.pub .lcl-box h2{font-size:clamp(22px,2.4vw,28px);letter-spacing:-.02em;line-height:1.15;margin:0}
.pub .lcl-box p{margin:0 0 6px;color:var(--ink-2);line-height:1.6;font-size:15px}
.pub .lcl-links{display:grid;gap:22px;margin-top:clamp(32px,5vw,52px)}
.pub .lcl-links h3{font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2);margin:0 0 10px}
.pub .lcl-chips{display:flex;flex-wrap:wrap;gap:8px}
.pub .lcl-chips a{padding:8px 14px;border-radius:999px;border:1px solid var(--line-2);background:rgba(255,255,255,.6);font-size:13.5px;font-weight:500;color:var(--ink)}
.pub .lcl-chips a:hover{border-color:var(--ink)}
@media (max-width:760px){.pub .lcl-grid{grid-template-columns:1fr}}
`
