// Emails for send-review-request. Pure functions: plain data in, { subject, html } out.
import { layout, heading, para, quote, button, esc, C } from './email.ts'

const FROM_PREVIEW = 'LensTrybe <noreply@mail.lenstrybe.com>'

export type ReviewRequestData = {
  businessName: string   // plain business name, or 'your creative'
  clientName: string     // plain client name, or ''
  message: string        // the creative's own note, or ''
  reviewUrl: string
}

// Sent to a client when a creative asks them for a review.
export function reviewRequestEmail(d: ReviewRequestData): { subject: string, html: string } {
  const { businessName, reviewUrl } = d
  const greeting = d.clientName ? `Hi ${d.clientName},` : 'Hi there,'
  const subject = `${businessName} would love your feedback`
  const html = layout({
    preheader: `Leave ${businessName} a quick review on LensTrybe`,
    blocks: [
      heading('Review request', `${greeting} how was working with ${businessName}?`),
      para(`${businessName} would love a quick review of your experience. Your words help other clients know what to expect.`),
      ...(d.message
        ? [para(`A note from ${businessName}`, { small: true }), quote(d.message)]
        : [para(`It only takes a minute, and it helps ${businessName} reach more clients on LensTrybe.`)]),
      button('Leave a review', reviewUrl),
      // Same words as before ("Or paste this link into your browser:"), so not the fallbackLink block.
      para(`Or paste this link into your browser: <span style="word-break:break-all;color:${C.green};">${esc(reviewUrl)}</span>`, { html: true, small: true }),
    ],
    why: `You're getting this because ${businessName} asked you for a review on LensTrybe.`,
  })
  return { subject, html }
}

export function previews() {
  const base = { businessName: 'Coastline Photo', clientName: 'Jo Harper', reviewUrl: 'https://lenstrybe.com/creatives/5d2b8e41-9f6c-4a03-b7e2-8c1a4f0d6e95' }
  return [
    { id: 'with-note', name: 'Review request sent to a client, with a personal note', data: { ...base, message: 'Hi Jo, it was such a joy capturing your day in Maleny.\nIf you have a minute, a quick review would mean the world to us.' } },
    { id: 'no-note', name: 'Review request sent to a client, no note', data: { ...base, message: '' } },
  ].map((p) => {
    const m = reviewRequestEmail(p.data)
    return { id: p.id, name: p.name, audience: 'client', subject: m.subject, from: FROM_PREVIEW, html: m.html }
  })
}
