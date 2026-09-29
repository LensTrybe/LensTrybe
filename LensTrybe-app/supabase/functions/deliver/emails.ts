// Emails for deliver. Pure functions: plain data in, { subject, html } out.
import { layout, heading, para, strong, facts, button } from './email.ts'

const FROM_PREVIEW = 'LensTrybe <noreply@mail.lenstrybe.com>'

export type FavouritesData = {
  clientName: string | null      // the delivery's client name, or null
  clientPlain: string            // client name made plain for the subject and preheader (falls back to 'Your client')
  title: string | null           // the delivery's title, or null
  count: string                  // e.g. '24 favourites'
  dashUrl: string
}

// Sent to the creative when their client submits favourites from a gallery.
export function favouritesEmail(d: FavouritesData): { subject: string, html: string } {
  const subject = `${d.clientPlain} sent their favourites`
  const html = layout({
    preheader: `${d.clientPlain} picked ${d.count}.`,
    blocks: [
      heading('Client favourites', 'Your client sent their favourites'),
      para(`${strong(d.clientName ?? 'Your client')} picked ${strong(d.count)} from ${strong(d.title ?? 'your gallery')}.`, { html: true }),
      facts([
        ['Gallery', d.title ?? 'Your gallery'],
        ['Client', d.clientName ?? 'Your client'],
        ['Picked', d.count],
      ]),
      button('View their picks', d.dashUrl),
      para('Their picks are marked in the gallery, so you know exactly what to edit or print.', { small: true }),
    ],
    why: "You're getting this because a client picked favourites from a gallery you delivered on LensTrybe.",
  })
  return { subject, html }
}

export function previews() {
  const m = favouritesEmail({ clientName: 'Jo Harper', clientPlain: 'Jo Harper', title: 'Harper wedding, Maleny', count: '24 favourites', dashUrl: 'https://lenstrybe.com/dashboard/portfolio-design/deliver' })
  return [{ id: 'favourites', name: 'Client sent their favourites from a gallery (to the creative)', audience: 'creative', subject: m.subject, from: FROM_PREVIEW, html: m.html }]
}
