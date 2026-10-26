import { createContext, useCallback, useContext, useRef, useState } from 'react'

// The toast. toast('Saved.') as before; toast('Note deleted.', { action: 'Undo', onAction })
// adds a button and stays up longer (26 Oct 2026), so a delete can be taken back instead of
// asking "are you sure?" first.
const Ctx = createContext(() => {})
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(''), [act, setAct] = useState(null), [on, setOn] = useState(false); const t = useRef()
  const toast = useCallback((m, o) => {
    setMsg(m); setAct(o?.action && o?.onAction ? { label: o.action, run: o.onAction } : null); setOn(true)
    clearTimeout(t.current); t.current = setTimeout(() => setOn(false), o?.action ? 6000 : 2800)
  }, [])
  const run = () => { const a = act; setOn(false); setAct(null); clearTimeout(t.current); a?.run() }
  return <Ctx.Provider value={toast}>{children}<div className={'toast' + (on ? ' on' : '') + (act ? ' act' : '')} role="status" aria-live="polite"><i />{msg}{act && <button type="button" onClick={run}>{act.label}</button>}</div></Ctx.Provider>
}
export const useToast = () => useContext(Ctx)
