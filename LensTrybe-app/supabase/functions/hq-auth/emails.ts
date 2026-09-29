// Previews of the emails hq-auth sends (the template is mail() in shared.ts).
import { mail } from './shared.ts'
export function previews() {
  return [
    { id: 'reset', name: 'HQ password reset', audience: 'staff', from: 'LensTrybe HQ <noreply@mail.lenstrybe.com>', subject: 'Reset your LensTrybe HQ password',
      html: mail('Reset your HQ password', [
        'Hi Michael, someone asked to reset the password for your LensTrybe HQ login.',
        "The link works once, for one hour. You'll still need the code from your authenticator app.",
        "If it wasn't you, ignore this email and tell Michael.",
      ], { label: 'Choose a new password', url: 'https://hq.lenstrybe.com/reset#t=example' }) },
  ]
}
