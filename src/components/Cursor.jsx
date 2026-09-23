import { useEffect, useRef } from 'react'
export default function Cursor() {
  const ref = useRef(null)
  useEffect(() => {
    if (matchMedia('(pointer:coarse)').matches) return
    const c = ref.current; let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y, raf
    const move = e => { x = e.clientX; y = e.clientY; c.classList.add('show'); c.classList.toggle('big', !!e.target.closest('a,button,input,textarea,select,[role=button]')) }
    const leave = () => c.classList.remove('show')
    const loop = () => { cx += (x - cx) * .35; cy += (y - cy) * .35; c.style.transform = `translate(${cx - 9}px,${cy - 9}px)`; raf = requestAnimationFrame(loop) }
    addEventListener('pointermove', move); document.documentElement.addEventListener('pointerleave', leave); raf = requestAnimationFrame(loop)
    return () => { removeEventListener('pointermove', move); document.documentElement.removeEventListener('pointerleave', leave); cancelAnimationFrame(raf) }
  }, [])
  return <div ref={ref} className="cur" aria-hidden="true" />
}
