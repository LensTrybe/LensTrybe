// Emails for send-delivery. Pure functions: plain data in, { subject, html } out.
import { layout, heading, para, strong, quote, button, notice, esc, C } from './email.ts'

const FROM_PREVIEW = 'LensTrybe <noreply@mail.lenstrybe.com>'

export type DeliveryEmailData = {
  business: string          // business name, or 'Your creative'
  subjectName: string       // business name for the subject, already made plain (falls back to 'your creative')
  title: string             // delivery title, or 'your project'
  clientName: string        // client name, or 'there'
  message: string           // the creative's note, or ''
  isProtected: boolean      // the gallery has a password
  fileCount: number | null  // number of files, or null when unknown
  deliveryUrl: string
}

// Sent to a client when a creative delivers a gallery.
export function deliveryEmail(d: DeliveryEmailData): { subject: string, html: string } {
  const { fileCount } = d
  const fileLine = fileCount != null && fileCount > 0 ? `${fileCount} file${fileCount === 1 ? '' : 's'} ready to view and download.` : 'Your files are ready to view and download.'
  const subject = `Your files are ready from ${d.subjectName}`
  const html = layout({
    preheader: `${d.business} has delivered ${d.title}.`,
    blocks: [
      heading('Your gallery is ready', `Hi ${d.clientName}, your files are ready`),
      para(`${strong(d.business)} has delivered ${strong(d.title)}.`, { html: true }),
      para(fileLine),
      d.message ? quote(d.message) : '',
      button('View & download your files', d.deliveryUrl),
      // Same words as before ("Or copy this link:"), so not the fallbackLink block.
      para(`Or copy this link:<br><a href="${esc(d.deliveryUrl)}" style="color:${C.green};word-break:break-all;">${esc(d.deliveryUrl)}</a>`, { html: true, small: true }),
      d.isProtected ? notice(`🔒 This gallery is password protected. ${d.business} will send you the password separately.`, 'amber') : '',
    ],
    why: 'Delivered via LensTrybe · lenstrybe.com',
  })
  return { subject, html }
}

export function previews() {
  const base = {
    business: 'Coastline Photo', subjectName: 'Coastline Photo', title: 'Harper wedding, Maleny', clientName: 'Jo Harper',
    deliveryUrl: 'https://lenstrybe.com/deliver/7e3f9a12-4c6b-4d80-9b21-6a5c0e8f3d17',
  }
  return [
    { id: 'gallery', name: 'Gallery delivered to a client, with a note', data: { ...base, message: 'Hi Jo and Tom,\nWhat a day. Here are your 412 edited images. Enjoy!\nSam', isProtected: false, fileCount: 412 } },
    { id: 'gallery-protected', name: 'Password protected gallery delivered to a client, no note', data: { ...base, message: '', isProtected: true, fileCount: 1 } },
  ].map((p) => {
    const m = deliveryEmail(p.data)
    return { id: p.id, name: p.name, audience: 'client', subject: m.subject, from: FROM_PREVIEW, html: m.html }
  })
}
