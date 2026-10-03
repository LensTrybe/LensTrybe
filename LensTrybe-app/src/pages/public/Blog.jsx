import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Aurora from '../../components/Aurora'
import Still from '../../components/Still'
import Icon from '../../components/Icon'
import { mountLens } from '../../lib/lens'
import { applySeo } from '../../lib/seo'
import { outside, waitlistTo } from '../../lib/region'
import { renderMarkdown, renderInline, titleHtml } from '../../lib/markdown'
import { AUDIENCES, CTA, ctaFor, dateAU, hubHead, itemPath, plain, postHead, readTime, wasUpdated } from '../../lib/blog-head'
import { loadLatest, loadPost, loadPosts, loadRelated } from '../../lib/blog'
import BlogPills from '../../components/BlogPills'
import { Subscribe } from './Edit'

// The Lens, LensTrybe's guides (4 Oct 2026; the addresses stay /blog). A post: the dark lens opener with the title, then the article
// on the light aurora body, its questions, one call to action, three more posts for the same
// audience, and the audience's sign-up panel. Posts live in edit_issues (kind = 'post').

// Internal links in a post's HTML move inside the app instead of reloading the page
function useInternalLinks() {
  const navigate = useNavigate()
  return e => {
    const a = e.target.closest('a'); if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target) return
    const href = a.getAttribute('href') || ''
    if (href.startsWith('/') && !href.startsWith('//')) { e.preventDefault(); navigate(href) }
  }
}

// Where a call to action goes for this visitor: outside South East Queensland, the waitlist
const ctaHref = cta => (outside() && (cta.href === '/jobs' || cta.href.startsWith('/join')) ? waitlistTo(cta.as) : cta.href)

// The lens behind every blog opener
function useLens(deps) {
  const cv = useRef(null)
  useEffect(() => { if (!cv.current) return; const l = mountLens(cv.current); l.layout({ cy: .5, r: .3 }); return () => l.destroy() }, deps)
  return cv
}

// A post or an Edit issue as a card (hub, related posts)
const label = p => (AUDIENCES[p.audience]?.label || 'The Trybe Edit') + (p.category ? ' · ' + p.category : '')
const Cover = ({ p }) => (p.hero_url ? <img src={p.hero_url} alt={p.hero_alt || ''} loading="lazy" decoding="async" /> : <Still seed={p.seed || 7} mood={p.mood || 'dusk'} />)
export function PostCard({ p }) {
  return (
    <Link className="acard bcard lg" to={itemPath(p)}>
      <div className="img"><Cover p={p} /></div>
      <div><small>{label(p)}</small><b>{plain(p.title)}</b><span>{dateAU(p.publish_at)}</span></div>
    </Link>
  )
}
// The newest one, large
function Featured({ p }) {
  return (
    <Link className="ecover bfeat lg rv" to={itemPath(p)}>
      <div className="cimg"><Cover p={p} /><span className="ctag">{p.kind === 'issue' ? 'Issue #' + p.n : AUDIENCES[p.audience]?.label}</span></div>
      <div className="cbody">
        <small className="blab">{label(p)}</small>
        <h2 dangerouslySetInnerHTML={{ __html: titleHtml(p.title) }} />
        {p.dek && <p className="dek">{p.dek}</p>}
        <div className="cmeta"><span>{dateAU(p.publish_at)}</span></div>
        <span className="btn k">{p.kind === 'issue' ? 'Read the issue' : 'Read the post'} <Icon name="arrow" size={14} /></span>
      </div>
    </Link>
  )
}

// The client side's panel: no newsletter, just the job board
export function JobPanel() {
  const to = outside() ? waitlistTo('client') : '/jobs'
  return (
    <div className="closer bpanel lg rv">
      <div><p className="eb g">Hiring a photographer or videographer?</p><h2>Post the job. <em>They come to you.</em></h2><p className="lede">{CTA.clients.line}</p></div>
      <div className="ctas"><Link className="btn" to={to}>Post your job free <Icon name="arrow" size={14} /></Link></div>
    </div>
  )
}

// The creative side's panel: The Trybe Edit
export function EditPanel() {
  return (
    <div className="closer bpanel lg rv">
      <div><p className="eb g">The Trybe Edit</p><h2>A monthly read <em>for creatives.</em></h2><p className="lede">A new issue on the 1st of every month. Unsubscribe any time.</p></div>
      <Subscribe />
    </div>
  )
}

function NotFound() {
  const cv = useLens([])
  useEffect(() => { applySeo({ title: 'Post not found · LensTrybe', path: '/blog', noindex: true }) }, [])
  return (
    <section className="hiw blogpost dark darkhero" style={{ minHeight: '70vh' }}>
      <canvas className="gl" ref={cv} aria-hidden="true" />
      <div className="in"><p className="eb">The Lens</p><h1><span className="ln"><span>That post <em>isn't here.</em></span></span></h1><p className="sub">It may have moved, or it isn't published yet.</p><div className="ctas"><Link className="btn w" to="/blog">Back to The Lens <Icon name="arrow" size={14} /></Link></div></div>
    </section>
  )
}

export function BlogPost() {
  const { slug } = useParams()
  const [post, setPost] = useState(undefined) // undefined = loading, null = not found
  const [related, setRelated] = useState([])
  useEffect(() => { let on = true; setPost(undefined); loadPost(slug).then(p => { if (on) setPost(p) }).catch(() => { if (on) setPost(null) }); return () => { on = false } }, [slug])
  useEffect(() => { if (!post) return; let on = true; loadRelated(post).then(r => { if (on) setRelated(r) }).catch(() => {}); return () => { on = false } }, [post])
  useEffect(() => { if (post) applySeo(postHead(post)) }, [post])
  const html = useMemo(() => (post ? renderMarkdown(post.body_md) : ''), [post])
  const go = useInternalLinks()
  const cv = useLens([slug, !!post])
  if (post === null) return <NotFound />
  if (!post) return <section className="hiw blogpost dark darkhero" style={{ minHeight: '70vh' }}><canvas className="gl" ref={cv} aria-hidden="true" /></section>
  const aud = AUDIENCES[post.audience] || AUDIENCES.creatives
  const cta = ctaFor(post)
  const faq = (Array.isArray(post.faq) ? post.faq : []).filter(f => f && f.q && f.a)
  return (
    <>
      <section className="hiw blogpost dark darkhero">
        <canvas className="gl" ref={cv} aria-hidden="true" />
        <div className="in">
          <nav className="crumb" aria-label="Breadcrumb"><Link to="/blog">The Lens</Link><i aria-hidden="true">›</i><Link to={aud.path}>{aud.label}</Link></nav>
          {post.category && <p className="eb">{post.category}</p>}
          <h1><span className="ln"><span dangerouslySetInnerHTML={{ __html: titleHtml(post.title) }} /></span></h1>
          {post.dek && <p className="sub">{post.dek}</p>}
          <div className="imeta">
            <span><time dateTime={post.publish_at}>{dateAU(post.publish_at)}</time></span>
            {wasUpdated(post) && <span>Updated <time dateTime={post.updated_at}>{dateAU(post.updated_at)}</time></span>}
            <span>{readTime(post.body_md)} read</span>
            <span>By LensTrybe</span>
          </div>
        </div>
      </section>
      <div className="lt">
        <Aurora />
        <article className="sec bpost" style={{ paddingTop: 'clamp(36px,5vw,60px)' }}><div className="wrap bwrap">
          {post.draft && <p className="draftbar" role="status"><b>Draft, not public.</b> Only admins can see this page. {post.approved ? 'It goes live ' + dateAU(post.publish_at) + '.' : 'Set approved to true to publish it.'}</p>}
          {post.hero_url && <figure className="bhero"><img src={post.hero_url} alt={post.hero_alt || ''} decoding="async" /></figure>}
          <div className="prose" onClick={go} dangerouslySetInnerHTML={{ __html: html }} />
          {faq.length > 0 && <section className="bfaq" aria-labelledby="faq">
            <p className="eb g">Questions</p>
            <h2 id="faq">Asked <em>and answered.</em></h2>
            {faq.map((f, i) => <details key={i} className="lg"><summary>{f.q}</summary><div className="ans" onClick={go} dangerouslySetInnerHTML={{ __html: renderInline(f.a) }} /></details>)}
          </section>}
          <div className="closer bcta lg">
            <div><p className="eb g">{aud.label}</p><h2>{cta.h[0]} <em>{cta.h[1]}</em></h2><p className="lede">{cta.line}</p></div>
            <div className="ctas"><Link className="btn" to={ctaHref(cta)}>{cta.label} <Icon name="arrow" size={14} /></Link></div>
          </div>
        </div></article>
        {related.length > 0 && <section className="sec" style={{ paddingTop: 0 }}><div className="wrap">
          <div className="stephead rv"><div><p className="eb g">{aud.label}</p><h2>Keep <em>reading.</em></h2></div></div>
          <div className="agrid rv">{related.map(p => <PostCard key={p.slug} p={p} />)}</div>
        </div></section>}
        {post.audience === 'creatives' && <section className="sec" style={{ paddingTop: 0 }}><div className="wrap bwrap"><EditPanel /></div></section>}
      </div>
    </>
  )
}

// The hub: /blog (everything, newest first), /blog/clients and /blog/creatives.
// /blog/edit is The Trybe Edit's own front (EditHome) with the same pills.
const SUBS = {
  all: 'Practical guides for South East Queensland businesses hiring photographers and videographers, and for the creatives running their own business. Plus The Trybe Edit, our monthly read for creatives.',
  clients: 'Practical guides for South East Queensland businesses hiring photographers and videographers.',
  creatives: 'Practical guides for photographers and videographers running their own business.',
}
export function BlogHub({ which = 'all' }) {
  const [items, setItems] = useState(null)
  useEffect(() => {
    let on = true; setItems(null)
    const load = which === 'all' ? loadLatest() : loadPosts({ audience: which })
    load.then(d => { if (on) setItems(d) }).catch(() => { if (on) setItems([]) })
    return () => { on = false }
  }, [which])
  useEffect(() => { if (items) applySeo(hubHead(which, items)) }, [items, which])
  const cv = useLens([which])
  const [first, ...rest] = items || []
  return (
    <>
      <section className="hiw bloghub dark darkhero">
        <canvas className="gl" ref={cv} aria-hidden="true" />
        <div className="in">
          <BlogPills on={which === 'all' ? null : which} />
          {which === 'all' ? <p className="eb">The Lens · by LensTrybe</p> : <Link className="eb" to="/blog">The Lens · by LensTrybe</Link>}
          <h1><span className="ln"><span>Straight answers</span></span><span className="ln"><span>for <em>creative work.</em></span></span></h1>
          <p className="sub">{SUBS[which]}</p>
        </div>
      </section>
      <div className="lt">
        <Aurora />
        <section className="sec" style={{ paddingTop: 'clamp(40px,6vw,72px)' }}><div className="wrap">
          {!items ? <div className="bempty" aria-busy="true" /> : !first ? (
            <div className="stephead rv"><div><p className="eb g">{which === 'all' ? 'The Lens' : AUDIENCES[which].label}</p><h2>The first posts <em>are on the way.</em></h2></div></div>
          ) : <>
            <Featured p={first} />
            {rest.length > 0 && <div className="agrid rv" style={{ marginTop: 'clamp(16px,2vw,24px)' }}>{rest.map(p => <PostCard key={p.kind + p.slug} p={p} />)}</div>}
          </>}
        </div></section>
        <section className="sec" style={{ paddingTop: 0 }}><div className="wrap bpanels">
          {which !== 'creatives' && <JobPanel />}
          {which !== 'clients' && <EditPanel />}
        </div></section>
      </div>
    </>
  )
}
