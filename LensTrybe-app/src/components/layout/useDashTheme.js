import { useCallback, useState } from 'react'

/* Light or dark, remembered.
 *
 * One key for the whole product, so a person who uses LensTrybe as a creative
 * and as a client is not asked twice.
 */
const KEY = 'lt_dash_theme'

export function useDashTheme() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light'
    try {
      return localStorage.getItem(KEY) || 'light'
    } catch {
      return 'light'
    }
  })

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(KEY, next)
      } catch {
        /* private windows and blocked storage: the choice just does not stick */
      }
      return next
    })
  }, [])

  return { theme, dark: theme === 'dark', toggleTheme }
}
