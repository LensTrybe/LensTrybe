// Demo copy for the blog (4 Oct 2026). Two placeholder posts so the hub, the pills and a post page
// can be seen in demo mode. They are layout samples, not articles: real posts are written by the
// writing chat and live in the edit_issues table (kind = 'post'). Never published anywhere.
export const POSTS = [
  {
    kind: 'post', audience: 'clients', slug: 'sample-post-for-clients', category: 'Sample',
    title: 'A sample post for clients, *in demo mode.*',
    dek: 'A placeholder that shows how a client post looks. Real posts appear here once they are published.',
    meta_title: 'A sample post for clients', meta_description: 'A placeholder post shown in demo mode.',
    mood: 'golden', seed: 7, approved: true, publish_at: '2026-10-02T07:00:00+10:00', updated_at: '2026-10-02T07:00:00+10:00',
    body_md: `This is sample text. It shows the reading layout, not real advice.

## A section heading

A paragraph with **bold**, *italic* and [a link to the job board](/jobs).

### A smaller heading

- A list item
- Another list item

| Shoot | From | Typical |
|---|---:|---:|
| Sample row one | $000 | $000 |
| Sample row two | $000 | $000 |

> A pull quote, as a sample.`,
    faq: [{ q: 'Is this a real post?', a: 'No. It is a placeholder for demo mode.' }],
  },
  {
    kind: 'post', audience: 'creatives', slug: 'sample-post-for-creatives', category: 'Sample',
    title: 'A sample post for creatives, *in demo mode.*',
    dek: 'A placeholder that shows how a creative post looks. Real posts appear here once they are published.',
    meta_title: 'A sample post for creatives', meta_description: 'A placeholder post shown in demo mode.',
    mood: 'dusk', seed: 12, approved: true, publish_at: '2026-10-03T07:00:00+10:00', updated_at: '2026-10-03T07:00:00+10:00',
    body_md: [
      'This is sample text. It shows the reading layout, not real advice.',
      '## A section heading',
      'A paragraph with [a link to pricing](/pricing).',
      '1. A numbered item',
      '2. Another numbered item',
      '| Sample | Column two | Column three | Column four | Column five |\n|---|---:|---:|---:|---:|\n| A wide sample row | $000 | $000 | $000 | $000 |',
    ].join('\n\n'),
    faq: [],
  },
]
