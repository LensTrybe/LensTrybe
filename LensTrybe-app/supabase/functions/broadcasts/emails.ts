// Emails for broadcasts. Pure functions: plain data in, html out.
// Marketing (Spam Act): every send carries the unsubscribe link; the one-click
// List-Unsubscribe headers are added at the send site in index.ts.
import { layout, heading, para, lines, button } from './email.ts'

const SITE = 'https://lenstrybe.com'
const FROM_PREVIEW = 'LensTrybe <noreply@mail.lenstrybe.com>'

function absoluteUrl(u: string) {
  return u.startsWith('/') ? SITE + u : u
}

// title and body are what the admin typed (already trimmed by index.ts). Blank lines split
// paragraphs, single line breaks are kept.
export function emailHtml(title: string, body: string, ctaLabel: string | null, ctaUrl: string | null, unsubUrl: string) {
  return layout({
    preheader: title,
    blocks: [
      heading('From the LensTrybe team', title),
      ...body.split(/\n\n+/).map((p) => para(lines(p), { html: true })),
      ctaLabel && ctaUrl ? button(ctaLabel, absoluteUrl(ctaUrl)) : '',
    ],
    why: "You're getting this because you signed up for LensTrybe emails. Questions? Just reply to this email.",
    unsubscribe: unsubUrl,
  })
}

export function previews() {
  const unsub = `${SITE}/unsubscribe/00000000-0000-0000-0000-000000000000`
  const title = 'Client portals now show your whole gallery'
  const body = "Hi everyone,\n\nFrom today, the client portal shows every gallery you have delivered to a client in one place, so Jo can find her Maleny wedding photos without digging through old emails.\n\nNothing to switch on. It's live on every Trybe Essential, Trybe Complete and Trybe Studio account now."
  return [
    { id: 'with-button', name: 'Broadcast email with a button', audience: 'anyone', subject: title, from: FROM_PREVIEW, html: emailHtml(title, body, 'Open your portals', '/dashboard/portals', unsub) },
    { id: 'no-button', name: 'Broadcast email, text only', audience: 'anyone', subject: 'We are closed over Christmas', from: FROM_PREVIEW, html: emailHtml('We are closed over Christmas', 'Support is off from 24 Dec to 2 Jan.\nReplies may take a little longer until then.', null, null, unsub) },
  ]
}
