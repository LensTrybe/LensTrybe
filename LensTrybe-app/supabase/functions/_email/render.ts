// Render every email's previews to HTML files for review.
//   deno run -A supabase/functions/_email/render.ts [slug ...]
// Writes /home/claude/emails/out/<slug>__<id>.html and /home/claude/emails/out/<slug>.json
const root = new URL('..', import.meta.url).pathname
const out = '/home/claude/emails/out'
await Deno.mkdir(out, { recursive: true })
const want = Deno.args
const slugs: string[] = []
for await (const e of Deno.readDir(root)) {
  if (!e.isDirectory || e.name.startsWith('_')) continue
  try { await Deno.stat(`${root}${e.name}/emails.ts`) } catch { continue }
  if (!want.length || want.includes(e.name)) slugs.push(e.name)
}
let bad = 0
if (!want.length || want.includes('auth-templates')) slugs.push('auth-templates')
for (const slug of slugs.sort()) {
  try {
    const m = await import(slug === 'auth-templates' ? `${root}../auth-templates/build.ts` : `${root}${slug}/emails.ts`)
    if (typeof m.previews !== 'function') throw new Error('no previews() export')
    const list = await m.previews()
    for (const p of list) {
      if (!p.id || !p.subject || !p.html) throw new Error('preview missing id/subject/html')
      if (/—|–/.test(p.subject + p.html.replace(/<style[\s\S]*?<\/style>/g, ''))) console.warn(`  ${slug}/${p.id}: contains an en or em dash`)
      if (/\b(Basic|Pro|Expert|Elite) (plan|tier)\b/.test(p.html)) console.warn(`  ${slug}/${p.id}: old plan name?`)
      await Deno.writeTextFile(`${out}/${slug}__${p.id}.html`, p.html)
    }
    await Deno.writeTextFile(`${out}/${slug}.json`, JSON.stringify(list.map((p: any) => ({ slug, id: p.id, name: p.name, audience: p.audience, subject: p.subject, from: p.from, file: `${slug}__${p.id}.html` })), null, 2))
    console.log(`ok ${slug}: ${list.length}`)
  } catch (e) { bad++; console.error(`FAIL ${slug}: ${e instanceof Error ? e.message : e}`) }
}
if (bad) Deno.exit(1)
