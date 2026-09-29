// Emails for send-billing-email. Pure functions: plain data in, { subject, html } out.
import { layout, heading, para, strong, link, button, facts, planName, esc } from './email.ts'

export const SUB_URL = 'https://lenstrybe.com/dashboard/settings/subscription'
const FROM_PREVIEW = 'LensTrybe Billing <noreply@mail.lenstrybe.com>'
const WHY = "You're getting this because it's about the subscription on your LensTrybe account."

// The plan name people see. No tier (or the free tier) reads as plain "LensTrybe", as before.
export function tierLabel(t: unknown) {
  const s = String(t || '').toLowerCase()
  if (!s || s === 'basic') return 'LensTrybe'
  return planName(s)
}

export type BillingData = {
  kind: string
  name: string          // business name, or 'there'
  tier: unknown         // tier id from the caller (basic/pro/expert/elite)
  amountStr: string     // formatted amount, or '' when none was sent
  billing: unknown      // 'annual' | 'monthly' | other
  firstCharge: string   // formatted first payment date, or ''
}

// Returns null for an unknown kind (the caller answers 400).
export function billingEmail(d: BillingData): { subject: string, html: string } | null {
  const kind = d.kind
  const tier = tierLabel(d.tier)
  const name = d.name
  let subject = '', eyebrow = '', title = '', intro = '', ctaText = 'Manage subscription', footNote = '', firstCharge = ''
  if (kind === 'active') {
    subject = `You're on ${tier}`
    eyebrow = 'Subscription active'
    title = `You're on ${tier}`
    intro = `Hi ${esc(name)}, your subscription is active. Thanks for being part of LensTrybe.`
    footNote = 'You can view or change your plan any time from your dashboard.'
  } else if (kind === 'failed') {
    subject = 'Your LensTrybe payment did not go through'
    eyebrow = 'Action needed'
    title = 'Your payment did not go through'
    intro = `Hi ${esc(name)}, we could not process your latest ${esc(tier)} payment. Please update your card so you don't lose access to your features.`
    ctaText = 'Update payment details'
    footNote = "Updating your card now is the fastest fix. We'll also retry automatically each day for up to 7 days, after which your account moves to Trybe Free, our free plan."
  } else if (kind === 'cancelled') {
    subject = 'Your LensTrybe subscription has been cancelled'
    eyebrow = 'Subscription cancelled'
    title = 'Your subscription has been cancelled'
    intro = `Hi ${esc(name)}, your ${esc(tier)} subscription has been cancelled. You'll keep access until the end of your current billing period, then move to Trybe Free, our free plan.`
    ctaText = 'Resubscribe'
    footNote = 'Changed your mind? You can pick a plan again any time.'
  } else if (kind === 'downgraded') {
    subject = 'Your LensTrybe plan has moved to Trybe Free'
    eyebrow = 'Plan changed'
    title = 'Your plan has moved to Trybe Free'
    intro = `Hi ${esc(name)}, we tried a few times but could not collect your ${esc(tier)} payment, so your account is now on Trybe Free, our free plan. Your profile and work are safe.`
    ctaText = 'Choose a plan'
    footNote = 'You can pick a paid plan again any time to get your features back.'
  } else if (kind === 'trial_plan_changed') {
    // A plan change while still on trial. Nothing is charged today, so the only thing that
    // matters to the creative is what they will be charged and when. Say both plainly: a
    // change with no receipt and no date is exactly how a surprise charge starts.
    firstCharge = d.firstCharge
    subject = `Your plan is now ${tier}`
    eyebrow = 'Plan changed'
    title = `Your plan is now ${tier}`
    intro = `Hi ${esc(name)}, you have moved to ${esc(tier)} and your new features are available straight away.`
      + (firstCharge
        ? ` Nothing has been charged today. Your first payment will be taken on ${strong(firstCharge)}.`
        : ' Nothing has been charged today.')
    footNote = firstCharge
      ? `Changed your mind? Switch plans or cancel before ${firstCharge} and you will not be charged.`
      : 'You can change plans any time from your dashboard.'
  } else if (kind === 'founding_ended') {
    // Sent when a founding deal ends (founding_end_deal): the $49 rate and the rest of the
    // free period go; the first standard payment is 7 days later (first_charge_date).
    firstCharge = d.firstCharge
    subject = 'Your LensTrybe founding deal has ended'
    eyebrow = 'Founding deal'
    title = 'Your founding deal has ended'
    intro = `Hi ${esc(name)}, your founding deal has now ended, as set out in the ${link('Founding Creative Agreement', 'https://lenstrybe.com/founding-agreement')}. You keep your account, your work and your Founding Creative badge.`
      + (firstCharge
        ? ` Your ${esc(tier)} plan now continues at the standard price, and your first payment will be taken on ${strong(firstCharge)}.`
        : ` To keep your ${esc(tier)} features, choose a plan in your dashboard.`)
    ctaText = firstCharge ? 'Manage subscription' : 'Choose a plan'
    footNote = firstCharge
      ? `Don't want to continue on ${tier}? Switch to Trybe Free, our free plan, or cancel before ${firstCharge} and you won't be charged.`
      : 'Your profile and work are safe, and you can pick a plan any time.'
  } else {
    return null
  }

  const period = String(d.billing || '') === 'annual' ? ' a year' : String(d.billing || '') === 'monthly' ? ' a month' : ''
  const details = d.amountStr
    ? facts([
      ['Plan', tier],
      ['Amount', d.amountStr + (kind === 'founding_ended' || kind === 'trial_plan_changed' ? period : '')],
      ['First payment', firstCharge],
    ])
    : facts([['Plan', tier]])

  const html = layout({
    preheader: subject,
    blocks: [
      heading(eyebrow, title),
      para(intro, { html: true }),
      details,
      button(ctaText, kind === 'failed' ? `${SUB_URL}?card=update` : SUB_URL),
      para(`${footNote} Questions about your subscription? Just reply to this email and the LensTrybe team will help.`, { small: true }),
    ],
    why: WHY,
  })
  return { subject, html }
}

export function previews() {
  const base = { name: 'Coastline Photo', tier: 'expert', amountStr: '', billing: '', firstCharge: '' }
  const list: { id: string, name: string, kind: string, data: Partial<BillingData> }[] = [
    { id: 'active', name: 'Subscription active (payment taken or plan upgraded)', kind: 'active', data: { amountStr: '$74.99' } },
    { id: 'failed', name: 'Payment failed, update your card', kind: 'failed', data: { amountStr: '$74.99' } },
    { id: 'cancelled', name: 'Subscription cancelled by the creative', kind: 'cancelled', data: {} },
    { id: 'downgraded', name: 'Moved to Trybe Free after failed payments', kind: 'downgraded', data: {} },
    { id: 'trial-plan-changed', name: 'Plan changed during the free trial, with first payment date', kind: 'trial_plan_changed', data: { amountStr: '$749.90', billing: 'annual', firstCharge: '14 March 2027' } },
    { id: 'trial-plan-changed-nodate', name: 'Plan changed during the free trial, no first payment date known', kind: 'trial_plan_changed', data: { tier: 'pro', amountStr: '$24.99', billing: 'monthly' } },
    { id: 'founding-ended', name: 'Founding deal ended, standard price from a set date', kind: 'founding_ended', data: { amountStr: '$74.99', billing: 'monthly', firstCharge: '6 October 2026' } },
    { id: 'founding-ended-noplan', name: 'Founding deal ended, no plan continues', kind: 'founding_ended', data: {} },
  ]
  return list.map((p) => {
    const m = billingEmail({ ...base, ...p.data, kind: p.kind } as BillingData)!
    return { id: p.id, name: p.name, audience: 'creative', subject: m.subject, from: FROM_PREVIEW, html: m.html }
  })
}
