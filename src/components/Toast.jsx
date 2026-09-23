import { createContext, useCallback, useContext, useRef, useState } from 'react'
const Ctx = createContext(() => {})
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(''); const [on, setOn] = useState(false); const t = useRef()
  const toast = useCallback(m => { setMsg(m); setOn(true); clearTimeout(t.current); t.current = setTimeout(() => setOn(false), 2800) }, [])
  return <Ctx.Provider value={toast}>{children}<div className={'toast' + (on ? ' on' : '')} role="status" aria-live="polite"><i />{msg}</div></Ctx.Provider>
}
export const useToast = () => useContext(Ctx)
