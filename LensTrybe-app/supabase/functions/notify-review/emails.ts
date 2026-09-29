// Emails for notify-review. Pure functions: plain data in, { subject, html } out.
import { layout, heading, para, quote, button, C } from './email.ts'

const FROM_PREVIEW = 'LensTrybe <noreply@mail.lenstrybe.com>'

export type NewReviewData = {
  rating: number         // 0 to 5, whole stars
  reviewerName: string   // plain reviewer name, or 'A client'
  comment: string        // the review text, or ''
}

// Star row: filled stars in green, empty ones dimmed. Not one of the email.ts blocks, so built
// here from C colours only.
function stars(n: number) {
  const r = Math.max(0, Math.min(5, Math.round(n || 0)))
  return `<span style="font-size:18px;letter-spacing:2px;color:${C.green};">${'&#9733;'.repeat(r)}<span style="color:${C.foot};">${'&#9733;'.repeat(5 - r)}</span></span>`
}

// Sent to the creative when someone leaves them a review.
export function newReviewEmail(d: NewReviewData): { subject: string, html: string } {
  const { rating, reviewerName, comment } = d
  const subject = `You got a new ${rating ? rating + '-star ' : ''}review`
  const html = layout({
    preheader: `${reviewerName} left you a review on LensTrybe`,
    blocks: [
      heading('New review', 'You have a new review'),
      para(`${reviewerName} just left a review on your LensTrybe profile.`),
      para(stars(rating), { html: true }),
      para(`from ${reviewerName}`, { small: true }),
      comment ? quote(`“${comment}”`) : para('No written comment was left.'),
      button('View your reviews', 'https://lenstrybe.com/dashboard/business/reviews'),
    ],
    why: "You're getting this because someone left a review on your LensTrybe profile.",
  })
  return { subject, html }
}

export function previews() {
  return [
    { id: 'with-comment', name: 'New 5-star review with a comment (to the creative)', data: { rating: 5, reviewerName: 'Jo Harper', comment: 'Sam was calm, kind and so organised on our wedding day in Maleny.\nThe photos are beyond anything we hoped for.' } },
    { id: 'no-comment', name: 'New 4-star review with no comment (to the creative)', data: { rating: 4, reviewerName: 'Jo Harper', comment: '' } },
  ].map((p) => {
    const m = newReviewEmail(p.data)
    return { id: p.id, name: p.name, audience: 'creative', subject: m.subject, from: FROM_PREVIEW, html: m.html }
  })
}
