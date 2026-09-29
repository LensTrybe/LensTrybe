// Emails sent by delete-account, in the LensTrybe "Night" design (see email.ts).
// All go to the account's own email, from LensTrybe, reply-to connect@lenstrybe.com.
import { layout, heading, para, strong, facts, code, button, planName, FROM } from './email.ts'

const SITE = 'https://lenstrybe.com'

// The account was reactivated inside the 30-day window.
export function reactivatedEmail(d: { name: string, kind: 'creative' | 'client', planRestored: boolean, hadPaid: boolean, restoredTier: string }) {
  const planLine = d.kind !== 'creative' ? ''
    : d.planRestored ? ` Your ${planName(d.restoredTier)} plan is back in place.`
    : d.hadPaid ? ' Your paid plan ended while your account was scheduled for deletion, so you are on the Trybe Free plan. You can choose a plan again any time from Settings.'
    : ''
  return {
    subject: 'Welcome back to LensTrybe',
    html: layout({
      preheader: 'Your account has been reactivated.',
      blocks: [
        heading('Account reactivated', 'Welcome back'),
        para(`Hi ${d.name}, your LensTrybe account has been reactivated and will not be deleted.${d.kind === 'creative' ? ' Your profile is visible again.' : ''}${planLine}`),
        button('Go to your dashboard', `${SITE}${d.kind === 'creative' ? '/dashboard' : '/client-dashboard'}`),
        para("If you didn't reactivate your account, reply to this email straight away and change your password.", { small: true }),
      ],
      why: 'You got this because your LensTrybe account was reactivated.',
    }),
  }
}

// The 6-digit code that confirms a deletion request.
export function deletionCodeEmail(d: { name: string, code: string, ttlMinutes: number }) {
  return {
    subject: 'Your LensTrybe account deletion code',
    html: layout({
      preheader: `Your code is ${d.code}`,
      blocks: [
        heading('Confirm deletion', 'Confirm account deletion'),
        para(`Hi ${d.name}, use this code to confirm you want to delete your LensTrybe account. It expires in ${d.ttlMinutes} minutes.`),
        code(d.code),
        para("If you didn't ask to delete your account, ignore this email and nothing will change. We also recommend changing your password.", { small: true }),
      ],
      why: 'You got this because someone asked to delete the LensTrybe account that uses this email address.',
    }),
  }
}

// Deletion confirmed and scheduled 30 days out.
export function deletionScheduledEmail(d: { name: string, kind: 'creative' | 'client', when: string }) {
  return {
    subject: 'Your LensTrybe account is scheduled for deletion',
    html: layout({
      preheader: `Your account will be deleted on ${d.when}.`,
      blocks: [
        heading('Deletion scheduled', 'Your account is scheduled for deletion'),
        para(`Hi ${d.name}, your LensTrybe account and everything in it will be permanently deleted on ${d.when}.${d.kind === 'creative' ? ' Your profile is now hidden and any paid plan has been cancelled.' : ''}`),
        facts([['Deletion date', d.when]]),
        para(`${strong('Changed your mind?')} Sign in before this date and choose Reactivate. Everything will be exactly as you left it.`, { html: true }),
        para(`${strong('Want a copy of your data?')} Sign in and choose Download my data before the deletion date.`, { html: true }),
        button('Sign in to reactivate', `${SITE}/login`),
        para("If you didn't request this, sign in now, reactivate your account and change your password.", { small: true }),
      ],
      why: 'You got this because a deletion was requested for your LensTrybe account.',
    }),
  }
}

export function previews() {
  const list = [
    { id: 'code', name: 'Account deletion code', audience: 'anyone', ...deletionCodeEmail({ name: 'Coastline Photo', code: '482913', ttlMinutes: 15 }) },
    { id: 'scheduled-creative', name: 'Deletion scheduled, creative account', audience: 'creative', ...deletionScheduledEmail({ name: 'Coastline Photo', kind: 'creative', when: '29 October 2026' }) },
    { id: 'scheduled-client', name: 'Deletion scheduled, client account', audience: 'client', ...deletionScheduledEmail({ name: 'Jo', kind: 'client', when: '29 October 2026' }) },
    { id: 'reactivated-plan-back', name: 'Reactivated, paid plan restored (creative)', audience: 'creative', ...reactivatedEmail({ name: 'Coastline Photo', kind: 'creative', planRestored: true, hadPaid: true, restoredTier: 'expert' }) },
    { id: 'reactivated-plan-ended', name: 'Reactivated, paid plan had ended (creative)', audience: 'creative', ...reactivatedEmail({ name: 'Coastline Photo', kind: 'creative', planRestored: false, hadPaid: true, restoredTier: 'basic' }) },
    { id: 'reactivated-client', name: 'Reactivated, client account', audience: 'client', ...reactivatedEmail({ name: 'Jo', kind: 'client', planRestored: false, hadPaid: false, restoredTier: 'basic' }) },
  ]
  return list.map((p) => ({ ...p, from: FROM }))
}
