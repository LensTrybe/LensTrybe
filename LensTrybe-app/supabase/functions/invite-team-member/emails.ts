// Emails sent by invite-team-member, in the LensTrybe "Night" design (see email.ts).
import { layout, heading, para, strong, facts, button, FROM } from './email.ts'

// To the invited person: a studio asks them to join its team. Reply-to is the studio.
// The subject is built in index.ts.
export function teamInviteHtml(d: { studioName: string, memberRole: string, email: string, joinUrl: string }) {
  return layout({
    preheader: `${d.studioName} has invited you to their team on LensTrybe`,
    blocks: [
      heading('Team invitation', "You've been invited!"),
      para(`${strong(d.studioName)} has invited you to join their team on LensTrybe as a ${strong(d.memberRole)}.`, { html: true }),
      facts([['Studio', d.studioName], ['Role', d.memberRole], ['Email', d.email]]),
      button('Accept invitation', d.joinUrl),
      para("This invitation expires in 14 days. If you weren't expecting it, you can safely ignore this email.", { small: true }),
    ],
    why: `You got this because ${d.studioName} invited this email address to their team on LensTrybe.`,
  })
}

export function previews() {
  return [
    {
      id: 'invite', name: 'Team invitation, sent to the invited person', audience: 'anyone',
      subject: "You've been invited to join Coastline Photo on LensTrybe", from: FROM,
      html: teamInviteHtml({ studioName: 'Coastline Photo', memberRole: 'second shooter', email: 'alex.nguyen@gmail.com', joinUrl: 'https://lenstrybe.com/team/accept/9f2c4e7a1b3d5f6071829a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d' }),
    },
  ]
}
