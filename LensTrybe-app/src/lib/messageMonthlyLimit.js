import { getFeatures, normalizeSubscriptionTier } from './tierFeatures'

/** Shown when Basic/Pro hits the cap (matches DB trigger message). */
export const MONTHLY_MESSAGE_LIMIT_EXCEEDED_MESSAGE =
  'You have reached your monthly message limit. Upgrade your plan to send more messages.'

/** @param {unknown} tierRaw */
export function creativeMonthlyReplyLimit(tierRaw) {
  const t = normalizeSubscriptionTier(tierRaw)
  if (t === 'expert' || t === 'elite' || t === 'vip') return null
  return getFeatures(t).monthlyReplies
}

/**
 * @param {unknown} err
 * @returns {boolean}
 */
export function isMonthlyMessageLimitError(err) {
  const msg = String(err?.message ?? err?.details ?? '')
  const code = String(err?.code ?? '')
  return (
    msg.includes('MONTHLY_MESSAGE_LIMIT') ||
    msg.includes('monthly message limit') ||
    code === 'P0001'
  )
}

/**
 * Loads this month's creative reply usage for the signed-in user (Basic/Pro capped).
 * If the RPC is missing (migration not applied), returns unlimited so the UI still works.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function fetchMyCreativeMessageReplyUsage(supabase) {
  const { data, error } = await supabase.rpc('get_my_creative_message_reply_usage')
  if (error) {
    if (String(error.message ?? '').includes('function') && String(error.message ?? '').includes('does not exist')) {
      return { used: 0, maxAllowed: 0, unlimited: true, rpcMissing: true }
    }
    throw error
  }
  const row = Array.isArray(data) ? data[0] : data
  return {
    used: Number(row?.used ?? 0),
    maxAllowed: Number(row?.max_allowed ?? 0),
    unlimited: Boolean(row?.unlimited),
    rpcMissing: false,
  }
}

/**
 * @param {{ used: number, maxAllowed: number, unlimited: boolean }} usage
 * @param {unknown} tierRaw
 */
export function isAtOrOverCreativeReplyLimit(usage, tierRaw) {
  if (usage.unlimited) return false
  const cap = creativeMonthlyReplyLimit(tierRaw)
  if (cap == null) return false
  return usage.used >= cap
}
