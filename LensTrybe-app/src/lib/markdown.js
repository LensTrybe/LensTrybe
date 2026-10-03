// The blog's markdown renderer (4 Oct 2026). One file for the browser and for the pre-render
// function (api/render.js), so a post's HTML is the same in both. Pure: no React, no Supabase,
// no window, so Node can import it too.
//
// What a post can use: ## and ### headings (they get ids for linking), paragraphs, lists, tables
// (wrapped so they scroll sideways on a phone), links, bold, italic, blockquotes and images.
// Raw HTML in the markdown is shown as text, never run. Links to javascript: or data: are dropped.
import { Marked, Renderer } from 'marked'

export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const safeUrl = u => { const s = String(u || '').trim(); return /^(https?:\/\/|\/|#|mailto:)/i.test(s) ? s : '' }
const slug = t => String(t).toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section'

function renderer() {
  const r = new Renderer()
  const used = new Map()
  r.html = ({ text, block }) => (block ? '<p>' + esc(text.trim()) + '</p>\n' : esc(text))
  // an image on its own line stands alone (a <figure> cannot sit inside a <p>)
  r.paragraph = function ({ tokens }) {
    const inner = this.parser.parseInline(tokens)
    return tokens.length === 1 && tokens[0].type === 'image' ? inner + '\n' : '<p>' + inner + '</p>\n'
  }
  r.heading = function ({ tokens, depth }) {
    const inner = this.parser.parseInline(tokens)
    const base = slug(inner); const n = used.get(base) || 0; used.set(base, n + 1)
    const lvl = Math.min(Math.max(depth, 2), 4) // a stray # becomes an h2: the page's h1 is the title
    return `<h${lvl} id="${n ? base + '-' + (n + 1) : base}">${inner}</h${lvl}>\n`
  }
  r.table = function (token) { return '<div class="tbl" role="region" aria-label="Table" tabindex="0">' + Renderer.prototype.table.call(this, token) + '</div>\n' }
  r.link = function ({ href, title, tokens }) {
    const inner = this.parser.parseInline(tokens); const u = safeUrl(href)
    if (!u) return inner
    const ext = /^https?:\/\//i.test(u) && !/^https?:\/\/(www\.)?lenstrybe\.com(\/|$)/i.test(u)
    return `<a href="${esc(u)}"${title ? ` title="${esc(title)}"` : ''}${ext ? ' target="_blank" rel="noopener"' : ''}>${inner}</a>`
  }
  r.image = ({ href, title, text }) => {
    const u = safeUrl(href); if (!u) return ''
    const img = `<img src="${esc(u)}" alt="${esc(text)}" loading="lazy" decoding="async">`
    return title ? `<figure>${img}<figcaption>${esc(title)}</figcaption></figure>` : img
  }
  return r
}

// A post's body as HTML
export function renderMarkdown(md) {
  return new Marked({ gfm: true, breaks: false, renderer: renderer() }).parse(String(md || ''))
}
// A short piece (an FAQ answer) as inline HTML
export function renderInline(md) {
  return new Marked({ gfm: true, renderer: renderer() }).parseInline(String(md || ''))
}
// A title: the accent phrase is marked *like this* and becomes the serif <em>; everything else is text.
export function titleHtml(t) {
  return esc(t).replace(/\*([^*]+)\*/g, '<em>$1</em>')
}
