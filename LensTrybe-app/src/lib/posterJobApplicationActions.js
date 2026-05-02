import { supabase } from './supabaseClient'

export function posterThreadClientFields(user, profile, clientAccount) {
  const fromClientAccount = clientAccount
    ? `${clientAccount.first_name ?? ''} ${clientAccount.last_name ?? ''}`.trim()
    : ''
  const client_name =
    profile?.business_name ??
    profile?.full_name ??
    (fromClientAccount || null) ??
    user?.email ??
    ''
  const client_email = clientAccount?.email ?? user?.email ?? ''
  return { client_name, client_email }
}

export function isApplicationPending(app) {
  const s = app?.status
  return s == null || s === '' || s === 'pending'
}

/**
 * @param {object} opts
 * @param {() => Promise<void>} [opts.reloadPostedJobs]
 * @param {() => Promise<void>} [opts.reloadBrowseJobs]
 * @param {() => Promise<void>} [opts.reloadThreads]
 */
export async function acceptJobApplication({
  app,
  job,
  user,
  profile,
  clientAccount,
  showToast,
  reloadPostedJobs,
  reloadBrowseJobs,
  reloadThreads,
}) {
  if (!user?.id) return

  const { client_name, client_email } = posterThreadClientFields(user, profile, clientAccount)

  const { error: e1 } = await supabase.from('job_applications').update({ status: 'accepted' }).eq('id', app.id)
  if (e1) {
    showToast(e1.message, 'error')
    return
  }

  const { error: e2 } = await supabase.from('job_applications').update({ status: 'closed' }).eq('job_id', job.id).neq('id', app.id)
  if (e2) {
    showToast(e2.message, 'error')
    return
  }

  const { error: e3 } = await supabase.from('job_listings').update({ status: 'filled' }).eq('id', job.id)
  if (e3) {
    showToast(e3.message, 'error')
    return
  }

  const { data: thread, error: te } = await supabase
    .from('message_threads')
    .insert({
      creative_id: app.creative_id,
      client_user_id: user.id,
      client_name,
      client_email,
      subject: `Job: ${job.title}`,
    })
    .select()
    .single()

  if (te || !thread) {
    showToast(te?.message ?? 'Could not create message thread', 'error')
    return
  }

  const { error: me } = await supabase.from('messages').insert({
    thread_id: thread.id,
    sender_type: 'client',
    sender_name: client_name,
    body: `Hi ${app.creative_name}, I'd like to accept your application for "${job.title}" at AUD ${Number(app.price ?? 0).toFixed(2)}. Looking forward to working with you!`,
  })
  if (me) {
    showToast(me.message, 'error')
    return
  }

  const { data: creativeProfile } = await supabase.from('profiles').select('business_email').eq('id', app.creative_id).eq('is_admin', false).maybeSingle()
  if (creativeProfile?.business_email) {
    try {
      await supabase.functions.invoke('send-message-notification', {
        body: {
          to: creativeProfile.business_email,
          toName: app.creative_name,
          fromName: client_name,
          subject: `Your application for "${job.title}" has been accepted!`,
          messageBody: `Great news! ${client_name} has accepted your application for "${job.title}" at AUD ${Number(app.price ?? 0).toFixed(2)}.\n\nLog in to LensTrybe to view your messages and get started.`,
          threadSubject: `Job: ${job.title}`,
        },
      })
    } catch {
      /* non-blocking */
    }
  }

  await reloadPostedJobs?.()
  await reloadBrowseJobs?.()
  await reloadThreads?.()
  showToast('Application accepted — message thread created')
}

export async function declineJobApplication({ app, showToast, reloadPostedJobs }) {
  const { error } = await supabase.from('job_applications').update({ status: 'declined' }).eq('id', app.id)
  if (error) {
    showToast(error.message, 'error')
    return
  }
  await reloadPostedJobs?.()
  showToast('Application declined')
}
