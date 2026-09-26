import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { SEED, LIVE_SEED } from '../data/seed'
import { LIVE } from './mode'

// One store for the whole workspace. Starts from the sample data, keeps every change in the browser
// (localStorage) so what you do on one page shows up on every other page and survives a reload.
// Later this is the layer that talks to Supabase; the pages will not need to change.
// Live mode keeps its own key: what a real account loads must never mix with the sample data,
// and clearing the demo must not touch a real session's cached view.
const KEY = LIVE ? 'lt-live-v3' : 'lt-store-v11'
// the live store starts empty (the real account fills it); a demo can start empty too, to test that
const BASE = LIVE || import.meta.env.VITE_LT_SEED === 'empty' ? LIVE_SEED : SEED
const Ctx = createContext(null)
const clone = o => JSON.parse(JSON.stringify(o))
const load = () => {
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return clone(BASE)
    const saved = JSON.parse(raw); const s = clone(BASE)
    for (const k of Object.keys(saved)) if (k in s) s[k] = saved[k]
    return s
  } catch { return clone(BASE) }
}
const PREFIX = { aw: 'aw', se: 'se', w: 'w', cj: 'cj', cm: 'cm', listing: 'L', offer: 'o', review: 'rv', rq: 'rq', chan: 'ch', inv: 'INV-', q: 'Q-', c: 'C-', exp: 'EXP-', note: 'n', proj: 'p', ev: 'e', meet: 'm', post: 'po', gear: 'g', thread: 't', person: 'c', gal: 'gal', idea: 'i', page: 'pg', item: 'it', crew: 'cr', job: 'j', ref: 'r', any: 'x' }
const pad = (n, w) => String(n).padStart(w, '0')

export function StoreProvider({ children }) {
  const [s, setS] = useState(load)
  const first = useRef(true), cnt = useRef(s.counters)
  useEffect(() => { cnt.current = { ...cnt.current, ...s.counters }; if (first.current) { first.current = false; return } try { localStorage.setItem(KEY, JSON.stringify(s)) } catch {} }, [s])

  const api = useMemo(() => {
    const set = (col, v) => setS(st => ({ ...st, [col]: typeof v === 'function' ? v(st[col]) : v }))
    const patch = (col, p) => setS(st => ({ ...st, [col]: { ...st[col], ...(typeof p === 'function' ? p(st[col]) : p) } }))
    // ids are handed out synchronously from a counter ref so a page can use the id straight away
    // invoices, quotes and contracts take their prefix from the brand kit (per-document override) when set
    const mk = (kind, n) => ((['inv', 'q', 'c'].includes(kind) && s.brand?.over?.[kind]?.prefix) || PREFIX[kind] || '') + (['inv', 'q', 'c', 'exp'].includes(kind) ? pad(n, 4) : n)
    const next = kind => mk(kind, (cnt.current[kind] || 0) + 1)
    const add = (col, obj, kind = 'any', top = true) => {
      const n = (cnt.current[kind] || 0) + 1; cnt.current = { ...cnt.current, [kind]: n }
      const id = obj.id ?? mk(kind, n)
      const rec = { id, ...obj, created: Date.now() }
      setS(st => ({ ...st, counters: { ...st.counters, [kind]: Math.max(n, st.counters[kind] || 0) }, [col]: top ? [rec, ...st[col]] : [...st[col], rec] }))
      return id
    }
    const upd = (col, id, p) => setS(st => ({ ...st, [col]: st[col].map(r => r.id === id ? { ...r, ...(typeof p === 'function' ? p(r) : p) } : r) }))
    const del = (col, id) => setS(st => ({ ...st, [col]: st[col].filter(r => r.id !== id) }))
    const find = (col, id) => s[col].find(r => r.id === id)
    // Append to a thread's timeline. who: 'me' | 'them' | 'lumi' | 'sys'
    const say = (tid, who, text, extra = {}) => setS(st => ({ ...st, threads: st.threads.map(t => t.id === tid ? { ...t, line: [...t.line, { [who]: text, at: 'Just now', ...extra }], last: text, when: 'now' } : t) }))
    const reset = () => { try { localStorage.removeItem(KEY) } catch {} setS(clone(BASE)) }
    // Live mode: replace whole collections with what the project returned, in one render
    const hydrate = cols => setS(st => ({ ...st, ...cols }))
    return { set, patch, add, upd, del, find, say, next, reset, hydrate }
  }, [s])

  const value = useMemo(() => ({ s, ...api }), [s, api])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
export const useStore = () => useContext(Ctx)

// Date helpers shared by the pages
export const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
// The sample store lives on a fixed day so its dates make sense; live mode is today
export const TODAY = LIVE ? iso(new Date()) : '2026-09-22'
export const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const nice = (s, o = {}) => parse(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', ...o })
export const dow = s => parse(s).toLocaleDateString('en-AU', { weekday: 'short' })
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d) }
export const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5)
