// Previews of the emails hq-api sends (the templates themselves are mail() in shared.ts).
import { mail } from './shared.ts'
import { esc } from './email.ts'
export function previews() {
  return [
    { id: 'staff-invite', name: 'HQ staff invite', audience: 'staff', from: 'LensTrybe HQ <noreply@mail.lenstrybe.com>', subject: 'Your LensTrybe HQ invite',
      html: mail(`Amy, you're invited to LensTrybe HQ`, [
        `${esc('Michael Manoli')} has set up a LensTrybe HQ login for you, as support. HQ is where the LensTrybe team runs the platform.`,
        'Choose your password from the link below, then set up two-factor with an authenticator app (Google Authenticator, 1Password, Authy or similar). Have it ready on your phone.',
        'The link works once, only for this email address, and expires in 48 hours.',
      ], { label: 'Set up my HQ login', url: 'https://hq.lenstrybe.com/invite#t=example' }) },
    { id: 'support-reply', name: 'Reply to a support request (sent from HQ)', audience: 'anyone', from: 'LensTrybe Support <noreply@mail.lenstrybe.com>', subject: 'Re: Logo not showing on invoices',
      html: mail('Hi Sam', ['Thanks for the screenshot. Your logo was saved as a HEIC file, which PDFs can\'t show. Upload it again as a PNG or JPG from Brand kit and it will appear on every new invoice.', 'Invoices you already sent keep the old version, so resend any that matter.', '<span style="color:#9a9aa8;">The LensTrybe Team</span>'], undefined,
        `You're getting this because you contacted LensTrybe support. Reply to this email to keep the conversation going.`, 'LensTrybe Support') },
  ]
}
