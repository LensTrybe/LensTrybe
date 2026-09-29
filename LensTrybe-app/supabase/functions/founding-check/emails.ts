// Emails for founding-check. Pure functions: plain data in, html out. The subjects are
// exported here so the preview and the real send use the same words.
import { layout, heading, para, strong, list, button } from './email.ts'

const FROM_PREVIEW = 'LensTrybe <noreply@mail.lenstrybe.com>'
const HUB = 'https://lenstrybe.com/dashboard/founding'
const WHY = "You're getting this because you're a LensTrybe founding creative. Questions? Just reply to this email."

export const WARN_SUBJECT = 'Your LensTrybe founding deal needs a quick action'
export const NUDGE_SUBJECT = "Got a minute? We'd love your feedback"

// A founding responsibility is due and unmet: the grace clock has started.
export function warnEmail(name: string, outstanding: string[], graceEnds: string) {
  return layout({
    preheader: WARN_SUBJECT,
    blocks: [
      heading('Founding deal, action needed', `Hi ${name}, a quick heads-up`),
      para("To keep your founding deal (12 months free Trybe Complete, then $49/mo for life), there's a little left to do:"),
      list(outstanding),
      para(`Please sort it by ${strong(graceEnds)} to keep your deal. Everything is tracked in your Founding Hub.`, { html: true }),
      button('Open your Founding Hub', HUB),
    ],
    why: WHY,
  })
}

// Monthly feedback nudge. Never affects the deal.
// unsubscribe: the address's unsubscribe page (Spam Act), when there is one.
export function nudgeEmail(name: string, unsubscribe?: string | null) {
  return layout({
    unsubscribe,
    preheader: NUDGE_SUBJECT,
    blocks: [
      heading('Founding creatives', `Hi ${name}, got a minute?`),
      para("We'd love this month's feedback. What's working, what's annoying, what's missing? A sentence or two is plenty, and it goes straight into what we build next."),
      para("This is just a friendly nudge. It doesn't affect your founding deal."),
      button('Share feedback', HUB),
    ],
    why: WHY,
  })
}

export function previews() {
  return [
    {
      id: 'warning', name: 'Founding deal at risk: responsibilities outstanding, 14 days to fix', audience: 'creative',
      subject: WARN_SUBJECT, from: FROM_PREVIEW,
      html: warnEmail('Coastline Photo', ['Complete your profile to 100%', 'Run your first 3 jobs through LensTrybe (1 of 3 done)'], '13 October 2026'),
    },
    {
      id: 'feedback-nudge', name: 'Monthly founding feedback nudge', audience: 'creative',
      subject: NUDGE_SUBJECT, from: FROM_PREVIEW,
      html: nudgeEmail('Coastline Photo', 'https://lenstrybe.com/unsubscribe/8f3c1d2e-example'),
    },
  ]
}
