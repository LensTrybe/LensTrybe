// Builds the three Supabase login emails (Dashboard > Authentication > Emails > Templates).
//   deno run -A supabase/auth-templates/build.ts   writes confirm-signup.html, reset-password.html, change-email.html
// Supabase fills {{ .ConfirmationURL }} in; leave it exactly as written.
import { layout, heading, para, button, fallbackLink } from './email.ts'
const LINK = '{{ .ConfirmationURL }}'
export const TEMPLATES = [
  { file: 'confirm-signup', subject: 'Confirm your email for LensTrybe', html: layout({ preheader: 'One tap and your LensTrybe account is ready.', why: "You're getting this because someone signed up to LensTrybe with this address.", blocks: [
    heading('Confirm your email', "You're almost in"), para('Confirm your email address to activate your LensTrybe account.'), button('Confirm my email', LINK), fallbackLink(LINK),
    para("If you didn't create a LensTrybe account, you can ignore this email.", { small: true })] }) },
  { file: 'reset-password', subject: 'Reset your LensTrybe password', html: layout({ preheader: 'Choose a new password for your LensTrybe account.', why: "You're getting this because someone asked to reset the password for this LensTrybe account.", blocks: [
    heading('Password reset', 'Reset your password'), para('Click below to choose a new password for your LensTrybe account.'), button('Reset my password', LINK), fallbackLink(LINK),
    para("If you didn't request this, you can safely ignore this email. Your password won't change.", { small: true })] }) },
  { file: 'change-email', subject: 'Confirm your new email for LensTrybe', html: layout({ preheader: 'Confirm this address to finish changing your email.', why: "You're getting this because someone asked to move a LensTrybe account to this address.", blocks: [
    heading('Email change', 'Confirm your new email'), para('Confirm this address to finish updating the email on your LensTrybe account.'), button('Confirm new email', LINK), fallbackLink(LINK),
    para("If you didn't request this change, contact us at connect@lenstrybe.com.", { small: true })] }) },
]
export function previews() { return TEMPLATES.map(t => ({ id: t.file, name: 'Supabase login email: ' + t.subject, audience: 'anyone', from: 'LensTrybe <noreply@mail.lenstrybe.com> (set in Supabase SMTP)', subject: t.subject, html: t.html.replaceAll(LINK, 'https://lenstrybe.com/auth/v1/verify?token=example') })) }
// At the swap (lenstrybe.com runs Next): the same emails with the button pointing at lenstrybe.com
// instead of the Supabase project's own address, which made iCloud file the confirm email as junk
// (29 Sep). Next's /auth/confirm and /reset-password swap the token for a session. Paste these
// three (swap-*.html) into Supabase on launch day, not before: the old site has neither page.
const SWAP_LINK: Record<string, string> = {
  'confirm-signup': 'https://lenstrybe.com/auth/confirm?token_hash={{ .TokenHash }}&type=email',
  'reset-password': 'https://lenstrybe.com/reset-password?token_hash={{ .TokenHash }}&type=recovery',
  'change-email': 'https://lenstrybe.com/auth/confirm?token_hash={{ .TokenHash }}&type=email_change',
}
export const SWAP = TEMPLATES.map(t => ({ ...t, file: 'swap-' + t.file, html: t.html.replaceAll(LINK, SWAP_LINK[t.file].replaceAll('&', '&amp;')) }))

if (import.meta.main) for (const t of [...TEMPLATES, ...SWAP]) await Deno.writeTextFile(new URL(`./${t.file}.html`, import.meta.url), t.html)
