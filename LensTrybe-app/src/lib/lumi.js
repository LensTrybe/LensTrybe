// Lumi, for real (item 18, Michael 29 Sep: a real chat with history; Trybe Free 5 messages a
// month, Essential 50, Complete 200, Studio 500). Everything goes through the lumi-chat Edge
// Function, which checks the plan, spends one message atomically, reads only this creative's
// own rows and keeps the conversation. The old dashboard uses the same function.
import { useEffect, useState } from 'react'
import { supabase } from '../backend/supabaseClient'

async function call(body) {
  const { data, error } = await supabase.functions.invoke('lumi-chat', { body })
  if (!error) return data
  let server = null
  try { server = await error?.context?.json?.() } catch { /* not JSON */ }
  const e = new Error(server?.error || error.message || 'lumi_failed')
  e.code = server?.error || 'lumi_failed'; e.limit = server?.limit
  throw e
}

// What to say when a message can't be sent. Plain words, no codes.
export function lumiError(e) {
  if (e?.code === 'monthly_limit_reached') return `That's all ${e.limit} Lumi messages for this month. They reset on the 1st, or a bigger plan gives you more.`
  if (e?.code === 'daily_limit_reached') return `That's today's ${e.limit} Lumi messages. Lumi is back tomorrow.`
  if (e?.code === 'tier_locked') return 'Lumi isn\'t on your plan.'
  if (e?.code === 'message_too_long') return 'That message is too long for Lumi. Try a shorter one.'
  return 'Lumi couldn\'t answer just now. Your message wasn\'t counted, try again in a moment.'
}

// page is the path they are on, so Lumi can answer about the screen in front of them.
export const lumiSend = (message, conversationId, page) => call({ message, conversationId: conversationId || undefined, page })
export const lumiList = () => call({ action: 'load_conversations' }).then(d => d?.conversations || [])
export const lumiDelete = id => call({ action: 'delete_conversation', conversationId: id })
export const lumiRename = (id, title) => call({ action: 'rename_conversation', conversationId: id, title })
export const lumiPin = (id, pinned) => call({ action: 'pin_conversation', conversationId: id, pinned })
export const lumiUsage = () => call({ action: 'usage' }).then(d => d?.usage || null)

// Messages used this month, shared by the dock and the Lumi page so both stay in step.
let usageNow = null
const subs = new Set()
export function setLumiUsage(u) { if (u) { usageNow = u; subs.forEach(f => f(u)) } }
export function useLumiUsage() {
  const [u, setU] = useState(usageNow)
  useEffect(() => {
    subs.add(setU)
    if (!usageNow) lumiUsage().then(setLumiUsage).catch(() => {})
    return () => subs.delete(setU)
  }, [])
  return u
}
export const usageLine = (u, short) => u && u.monthly_limit > 0 ? `${Math.max(0, u.monthly_limit - u.monthly)} of ${u.monthly_limit} ${short ? 'left' : 'messages left'} this month` : ''
