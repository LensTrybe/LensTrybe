// Emails for send-contract. Pure functions: plain data in, { subject, html } out.
import { layout, heading, para, strong, button, esc, C } from './email.ts'

const FROM_PREVIEW = 'LensTrybe <noreply@mail.lenstrybe.com>'

export type ContractEmailData = {
  business: string           // business name shown in the body (falls back to 'Your creative')
  subjectName: string        // business name for the subject, already made plain (falls back to 'Your Creative')
  projectName?: string | null
  subjectProject?: string    // project name for the subject, already made plain, or ''
  isUploaded: boolean        // an uploaded file (download link) rather than a written contract (attachment)
  downloadUrl?: string       // uploaded contracts: the file link
  attachmentIsPdf?: boolean  // written contracts: a PDF copy is attached (else an HTML copy)
  signUrl?: string           // written contracts not yet signed: the review-and-sign link, or ''
}

export function contractEmail(d: ContractEmailData): { subject: string, html: string } {
  const subject = `Contract from ${d.subjectName}${d.projectName ? ' - ' + (d.subjectProject ?? '') : ''}`
  const blocks = [
    heading('New contract', 'You have a new contract'),
    para(`${strong(d.business)} has sent you a contract${d.projectName ? ` for ${strong(d.projectName)}` : ''}.`, { html: true }),
  ]
  if (d.isUploaded) {
    blocks.push(para('Click the button below to download your contract.'))
    blocks.push(button('Download Contract', d.downloadUrl || ''))
  } else if (d.attachmentIsPdf) {
    blocks.push(para('A PDF copy of the contract is attached to this email.'))
  } else {
    blocks.push(para('A copy of the contract is attached to this email. Open it in your browser to read or print it.'))
  }
  if (d.signUrl) {
    blocks.push(button('Review and sign', d.signUrl))
    // Same words as before ("Or copy this link:"), so not the fallbackLink block.
    blocks.push(para(`Or copy this link: <span style="word-break:break-all;color:${C.green};">${esc(d.signUrl)}</span>`, { html: true, small: true }))
  }
  const html = layout({
    preheader: `${d.business} has sent you a contract${d.projectName ? ` for ${d.projectName}` : ''}.`,
    blocks,
    why: 'Sent via LensTrybe · lenstrybe.com',
  })
  return { subject, html }
}

export function previews() {
  const base = { business: 'Coastline Photo', subjectName: 'Coastline Photo', projectName: 'Harper wedding, Maleny', subjectProject: 'Harper wedding, Maleny' }
  const list: { id: string, name: string, data: Partial<ContractEmailData> }[] = [
    { id: 'written-pdf-sign', name: 'Written contract sent to a client, PDF attached, with a sign link', data: { isUploaded: false, attachmentIsPdf: true, signUrl: 'https://lenstrybe.com/sign/9b2e4f10-7c3a-4d85-b6e1-2f8a0c9d5e47' } },
    { id: 'written-html', name: 'Written contract sent to a client, PDF failed so an HTML copy is attached (already signed, no sign link)', data: { isUploaded: false, attachmentIsPdf: false, signUrl: '' } },
    { id: 'uploaded', name: 'Uploaded contract file sent to a client (download button)', data: { isUploaded: true, downloadUrl: 'https://lqafxisymvrazipaozfk.supabase.co/storage/v1/object/public/contracts/coastline/harper-wedding-contract.pdf' } },
    { id: 'no-project', name: 'Written contract sent to a client with no project name', data: { isUploaded: false, attachmentIsPdf: true, projectName: '', subjectProject: '', signUrl: 'https://lenstrybe.com/sign/9b2e4f10-7c3a-4d85-b6e1-2f8a0c9d5e47' } },
  ]
  return list.map((p) => {
    const m = contractEmail({ ...base, ...p.data } as ContractEmailData)
    return { id: p.id, name: p.name, audience: 'client', subject: m.subject, from: FROM_PREVIEW, html: m.html }
  })
}
