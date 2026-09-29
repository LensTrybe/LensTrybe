// Emails for deliver-expiry-reminders. Pure functions: plain data in, html out.
// The subjects stay in index.ts (plain strings at the send call); previews() repeats them.
import { layout, heading, para, strong, button, esc } from './email.ts'

const FROM_PREVIEW = 'LensTrybe <noreply@mail.lenstrybe.com>'

// To the client, about 3 days before their gallery link expires.
export function reminderEmail(clientName: string | null, businessName: string, title: string | null, url: string, expiryLabel: string) {
  const galleryName = title || 'from ' + (businessName || 'your creative')
  return layout({
    preheader: `Your gallery will expire on ${expiryLabel}.`,
    blocks: [
      heading('Your gallery is expiring soon', `Hi ${clientName || 'there'}, download your files before they go`),
      para(`Your gallery ${strong(galleryName)} will expire on ${strong(expiryLabel)}. Please download anything you would like to keep before then.`, { html: true }),
      button('View & download your files', url),
    ],
    why: 'Delivered via LensTrybe.',
  })
}

// To the creative, a week before an expired gallery's files are removed.
export function purgeWarningEmail(businessName: string, title: string | null, clientName: string | null, purgeLabel: string) {
  return layout({
    preheader: `The files in ${title || 'your gallery'} will be removed on ${purgeLabel}.`,
    blocks: [
      heading('Gallery files being removed', `Hi ${businessName || 'there'}, one of your galleries is about to be cleared`),
      para(`The files in ${strong(title || 'your gallery')}${clientName ? ` for ${esc(clientName)}` : ''} will be removed on ${strong(purgeLabel)}, 30 days after it expired.`, { html: true }),
      para('If your client still needs them, open Deliver and extend the gallery. That keeps the files and puts the link back up. If you have your own copies, there is nothing to do, and clearing them frees up your storage allowance.'),
      para('The delivery itself stays in your account either way, so your record of the job is not going anywhere.'),
      button('Open Deliver', 'https://lenstrybe.com/dashboard/portfolio-design/deliver'),
    ],
    why: "You're getting this because a gallery you delivered on LensTrybe expired and its files are about to be removed.",
  })
}

export function previews() {
  return [
    {
      id: 'client-expiry-reminder', name: 'Gallery link expires in about 3 days (to the client)', audience: 'client',
      subject: 'Your gallery from Coastline Photo expires soon', from: FROM_PREVIEW,
      html: reminderEmail('Jo Harper', 'Coastline Photo', 'Harper wedding, Maleny', 'https://lenstrybe.com/deliver/7e3f9a12-4c6b-4d80-9b21-6a5c0e8f3d17', '14 March 2027'),
    },
    {
      id: 'client-expiry-reminder-untitled', name: 'Gallery link expires in about 3 days, gallery has no title (to the client)', audience: 'client',
      subject: 'Your gallery from Coastline Photo expires soon', from: FROM_PREVIEW,
      html: reminderEmail(null, 'Coastline Photo', null, 'https://lenstrybe.com/deliver/7e3f9a12-4c6b-4d80-9b21-6a5c0e8f3d17', '14 March 2027'),
    },
    {
      id: 'creative-purge-warning', name: 'Expired gallery files removed in 7 days (to the creative)', audience: 'creative',
      subject: 'Your gallery files are about to be removed', from: FROM_PREVIEW,
      html: purgeWarningEmail('Coastline Photo', 'Harper wedding, Maleny', 'Jo Harper', '13 April 2027'),
    },
  ]
}
