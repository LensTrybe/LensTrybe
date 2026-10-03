// The LensTrybe blog (4 Oct 2026): weekly posts for clients and for creatives, kept in the
// edit_issues table beside The Trybe Edit (kind = 'post' for posts, kind = 'issue' for issues).
// The table's policy shows the public approved rows past their publish time; an admin's session
// can also read drafts so they can be previewed, so every list here filters to published rows
// itself, and a single post comes back with draft: true when it is not public yet.
import { supabase } from '../backend/supabaseClient'
import { LIVE } from './mode'
import { POSTS } from '../data/blog'
import { ISSUES } from '../data/edit'
import { loadEditIssues } from './account'

export { AUDIENCES, plain, readTime, isDraft } from './blog-head'
import { isDraft } from './blog-head'
// /blog/clients, /blog/creatives and /blog/edit are hub pages, never post slugs (the table checks it too)
export const RESERVED = ['clients', 'creatives', 'edit', 'confirm']

const POST = 'slug, kind, audience, title, dek, category, body_md, faq, hero_url, hero_alt, meta_title, meta_description, cta_label, cta_href, mood, seed, publish_at, updated_at, approved'
const CARD = 'slug, kind, audience, title, dek, category, hero_url, hero_alt, mood, seed, publish_at, updated_at'

const published = q => q.eq('approved', true).lte('publish_at', new Date().toISOString())

// Published posts, newest first, for one audience or both
export async function loadPosts({ audience, limit = 60 } = {}) {
  if (!LIVE) return POSTS.filter(p => !audience || p.audience === audience).slice(0, limit)
  let q = published(supabase.from('edit_issues').select(CARD).eq('kind', 'post')).order('publish_at', { ascending: false }).limit(limit)
  if (audience) q = q.eq('audience', audience)
  const { data, error } = await q
  if (error) throw new Error('Could not load the blog.')
  return data || []
}

// One post by its slug. Null when there is no such post (or it is a draft and this is not an admin).
export async function loadPost(slug) {
  if (!LIVE) return POSTS.find(p => p.slug === slug) || null
  const { data, error } = await supabase.from('edit_issues').select(POST).eq('kind', 'post').eq('slug', slug).maybeSingle()
  if (error) throw new Error('Could not load that post.')
  return data ? { ...data, draft: isDraft(data) } : null
}

// Three more posts for the same audience, newest first, not this one
export async function loadRelated(post, n = 3) {
  const list = await loadPosts({ audience: post.audience, limit: n + 1 })
  return list.filter(p => p.slug !== post.slug).slice(0, n)
}

// The hub's /blog: posts and Edit issues together, newest first
export async function loadLatest(limit = 30) {
  const [posts, issues] = await Promise.all([loadPosts({ limit }), LIVE ? loadEditIssues().catch(() => []) : Promise.resolve(ISSUES)])
  const all = [...posts, ...(issues || []).map(i => ({ ...i, kind: 'issue' }))]
  return all.sort((a, b) => new Date(b.publish_at) - new Date(a.publish_at)).slice(0, limit)
}
