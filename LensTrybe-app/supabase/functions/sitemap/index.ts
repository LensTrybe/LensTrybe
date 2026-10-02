// sitemap: the dynamic sitemaps for lenstrybe.com (2 Oct 2026). Vercel proxies
// /sitemap-creatives.xml and /sitemap-edit.xml here (vercel.json), so Google reads them on
// lenstrybe.com. Public data only: listed creatives' ids and published Trybe Edit issues.
// No JWT, because a crawler has none; nothing here is private.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const SITE = 'https://lenstrybe.com'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const day = (t: string | null) => (t ? new Date(t).toISOString().slice(0, 10) : null)
const xml = (urls: { loc: string; lastmod?: string | null; freq?: string; pri?: string }[]) =>
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}${u.freq ? `<changefreq>${u.freq}</changefreq>` : ''}${u.pri ? `<priority>${u.pri}</priority>` : ''}</url>`).join('\n') +
  '\n</urlset>\n'

Deno.serve(async (req) => {
  const type = new URL(req.url).searchParams.get('type') || 'creatives'
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  let urls: { loc: string; lastmod?: string | null; freq?: string; pri?: string }[] = []
  if (type === 'edit') {
    const { data } = await sb.from('edit_issues').select('slug, publish_at').order('n', { ascending: false }).limit(5000)
    const now = Date.now()
    urls = (data || []).filter((r) => r.slug && (!r.publish_at || new Date(r.publish_at).getTime() <= now))
      .map((r) => ({ loc: `${SITE}/edit/${encodeURIComponent(r.slug)}`, lastmod: day(r.publish_at), freq: 'monthly', pri: '0.6' }))
  } else {
    const { data } = await sb.from('profiles').select('id, created_at')
      .eq('is_listed', true).eq('account_type', 'creative').or('is_admin.is.null,is_admin.eq.false').or('pending_deletion.is.null,pending_deletion.eq.false').limit(45000)
    urls = (data || []).map((r) => ({ loc: `${SITE}/creatives/${r.id}`, lastmod: day(r.created_at), freq: 'weekly', pri: '0.7' }))
  }
  return new Response(xml(urls), { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
})
