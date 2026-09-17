import { useEffect, useState } from 'react'

// Every public page was re-implementing this same pair of lines, which is part of why
// the page shell kept getting forgotten on new pages. 768 is the width PublicLayout
// swaps to the mobile nav at, so keep the two in step if that ever changes.
export const MOBILE_BREAKPOINT = 768

export default function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false,
  )

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])

  return isMobile
}
