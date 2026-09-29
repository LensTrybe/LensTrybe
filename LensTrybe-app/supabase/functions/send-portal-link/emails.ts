// Emails for send-portal-link. Pure functions: plain data in, { subject, html } out.
import { layout, heading, para, strong, esc, button } from './email.ts'

const FROM_PREVIEW = 'LensTrybe <noreply@mail.lenstrybe.com>'

export type PortalLinkData = {
  creativeName: string   // plain business name, or 'Your creative'
  clientName: string     // plain client name, or ''
  portalUrl: string
  subject: string        // built by the caller (length-limited there)
}

// Sent to a client with the link to the portal a creative made for them.
export function portalLinkEmail(d: PortalLinkData): { subject: string, html: string } {
  const html = layout({
    preheader: `${d.creativeName} has created a project portal for you`,
    blocks: [
      heading('Client portal', 'Your client portal is ready'),
      para(`${d.clientName ? `Hi ${esc(d.clientName)}, ` : ''}${strong(d.creativeName)} has created a project portal for you. Use the link below to view your project details, messages, files and more.`, { html: true }),
      button('Open my portal', d.portalUrl),
      para('Keep this email. It contains your unique portal link.', { small: true }),
    ],
    why: `You're getting this because ${d.creativeName} created a client portal for you on LensTrybe.`,
  })
  return { subject: d.subject, html }
}

export function previews() {
  const base = { creativeName: 'Coastline Photo', portalUrl: 'https://lenstrybe.com/portal/c4e81f2a-6b9d-4a37-8e05-1f3d7a9b2c60', subject: 'Coastline Photo has shared a project portal with you' }
  return [
    { id: 'portal-link', name: 'Client portal link sent to a client', data: { ...base, clientName: 'Jo Harper' } },
    { id: 'portal-link-no-name', name: 'Client portal link sent to a client with no name on file', data: { ...base, clientName: '' } },
  ].map((p) => {
    const m = portalLinkEmail(p.data)
    return { id: p.id, name: p.name, audience: 'client', subject: m.subject, from: FROM_PREVIEW, html: m.html }
  })
}
