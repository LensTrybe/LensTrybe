// Emails sent by purge-deleted-accounts (daily cron), in the LensTrybe "Night" design (see email.ts).
// Both go to the account's own email, from LensTrybe, reply-to connect@lenstrybe.com.
import { layout, heading, para, button, FROM } from './email.ts'

// Seven days before the scheduled deletion.
export function deletionReminderEmail(when: string) {
  return {
    subject: 'Your LensTrybe account will be deleted soon',
    html: layout({
      preheader: `Your account will be deleted on ${when}.`,
      blocks: [
        heading('Reminder', 'Your account will be deleted soon'),
        para(`Your LensTrybe account and everything in it will be permanently deleted on ${when}. If you want to keep it, sign in and choose Reactivate. You can also download a copy of your data from the same screen.`),
        button('Sign in to reactivate', 'https://lenstrybe.com/login'),
        para('If you are happy for your account to be deleted, you do not need to do anything.', { small: true }),
      ],
      why: 'You got this because your LensTrybe account is scheduled for deletion.',
    }),
  }
}

// After the account and its data have been removed.
export function accountDeletedEmail() {
  return {
    subject: 'Your LensTrybe account has been deleted',
    html: layout({
      preheader: 'Your account and data have been permanently deleted.',
      blocks: [
        heading('Account deleted', 'Your account has been deleted'),
        para('As requested, your LensTrybe account and all of its data have now been permanently deleted. Thanks for being part of LensTrybe. You are always welcome back.'),
        para('This is the last email you will receive about this account.', { small: true }),
      ],
      why: 'You got this because you asked for your LensTrybe account to be deleted.',
    }),
  }
}

export function previews() {
  return [
    { id: 'reminder', name: 'Seven-day reminder before an account is deleted', audience: 'anyone', from: FROM, ...deletionReminderEmail('29 October 2026') },
    { id: 'deleted', name: 'Account has been permanently deleted', audience: 'anyone', from: FROM, ...accountDeletedEmail() },
  ]
}
