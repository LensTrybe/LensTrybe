// Pre-rendering for crawlers and link previews (5 Oct 2026). The site is one page app, so every
// address serves the same index.html, and a crawler that does not run JavaScript (Facebook,
// LinkedIn, iMessage, Slack, and Google's first pass) reads the home page's title on every page.
// vercel.json sends the addresses below here instead. For each one this replaces the head's title,
// description, canonical, Open Graph and Twitter tags before serving the same index.html, so React
// still mounts over it. Edge-cached for five minutes. Nothing here reads private data.
//
// The Lens posts (/blog/:slug) and the hub pages join this file in the blog build's step 4.
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SITE = 'https://lenstrybe.com'
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Pages with fixed wording. Keep in step with PAGES in src/lib/seo.js.
const PAGES = {
  '/tour': { title: 'A tour of LensTrybe', description: 'Nine minutes, 28 short recordings of the real workspace. See what LensTrybe does for a photographer or videographer, one part at a time.', image: '/og-tour.png', noindex: true },
}

// The built index.html is copied to api/shell.html at the end of `npm run build` (api/_copy-shell.mjs)
// and bundled beside this function (vercel.json includeFiles), so it is found whatever Vercel uses as
// the working directory. dist/index.html is the fallback for a local run.
const here = dirname(fileURLToPath(import.meta.url))
const CANDIDATES = [join(here, 'shell.html'), join(here, '..', 'dist', 'index.html'), join(process.cwd(), 'dist', 'index.html')]
let shell = null
function index() {
  if (shell) return shell
  const f = CANDIDATES.find(existsSync)
  if (!f) throw new Error('index.html not found; looked in ' + CANDIDATES.join(', '))
  return (shell = readFileSync(f, 'utf8'))
}

// Swap the head tags index.html already carries for the page's own
function head(html, p, path) {
  const url = SITE + path, img = SITE + p.image
  const set = (re, tag) => { html = re.test(html) ? html.replace(re, tag) : html.replace('</head>', tag + '\n</head>') }
  set(/<title>[^<]*<\/title>/, `<title>${esc(p.title)}</title>`)
  set(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(p.description)}" />`)
  for (const [k, v] of [['og:title', p.title], ['og:description', p.description], ['og:url', url], ['og:image', img]])
    set(new RegExp(`<meta property="${k}" content="[^"]*"\\s*\\/?>`), `<meta property="${k}" content="${esc(v)}" />`)
  for (const [k, v] of [['twitter:title', p.title], ['twitter:description', p.description], ['twitter:image', img]])
    set(new RegExp(`<meta name="${k}" content="[^"]*"\\s*\\/?>`), `<meta name="${k}" content="${esc(v)}" />`)
  set(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(url)}" />`)
  if (p.noindex) set(/<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex, follow" />')
  return html
}

export default function handler(req, res) {
  const path = (new URL(req.url, SITE).pathname.replace(/\/+$/, '') || '/')
  try {
    const p = PAGES[path]
    const html = p ? head(index(), p, path) : index()
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400')
    res.status(200).send(html)
  } catch (e) {
    // The build did not bundle index.html beside this function. Say so in the logs and send the
    // visitor to the plain app at /index.html, which is always served as a static file.
    console.error('[render]', e?.message || e)
    res.setHeader('Cache-Control', 'no-store')
    res.redirect(302, '/index.html')
  }
}
