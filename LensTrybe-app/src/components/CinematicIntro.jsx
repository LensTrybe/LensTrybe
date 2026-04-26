import { useEffect, useRef, useState } from 'react'

const WORD_STYLE = {
  fontFamily: '"Space Grotesk", sans-serif',
  fontWeight: 700,
  fontSize: '52px',
  textTransform: 'uppercase',
  letterSpacing: '8px',
  lineHeight: 1.05,
  opacity: 0,
  transform: 'translateY(16px)',
  filter: 'blur(8px)',
  transition: 'opacity 520ms ease, transform 520ms ease, filter 520ms ease',
}

const PARTICLE_COLORS = ['#FF4D8D', '#1DB954', '#ffffff', '#9b6bff']

export default function CinematicIntro() {
  const [mounted, setMounted] = useState(false)
  const [fadingOut, setFadingOut] = useState(false)
  const [showConnect, setShowConnect] = useState(false)
  const [showCapture, setShowCapture] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showLine, setShowLine] = useState(false)
  const [showBrand, setShowBrand] = useState(false)
  const canvasRef = useRef(null)

  useEffect(() => {
    if (sessionStorage.getItem('intro_played') === 'true') return

    setMounted(true)
    sessionStorage.setItem('intro_played', 'true')

    if (!document.getElementById('space-grotesk-font-link')) {
      const link = document.createElement('link')
      link.id = 'space-grotesk-font-link'
      link.rel = 'stylesheet'
      link.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&display=swap'
      document.head.appendChild(link)
    }

    const timers = [
      setTimeout(() => setShowConnect(true), 400),
      setTimeout(() => setShowCapture(true), 1200),
      setTimeout(() => setShowCreate(true), 2000),
      setTimeout(() => {
        setShowLine(true)
        setShowBrand(true)
      }, 2800),
      setTimeout(() => setFadingOut(true), 4200),
      setTimeout(() => setMounted(false), 5000),
    ]

    return () => timers.forEach(clearTimeout)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafId = 0
    let running = true

    const particles = []
    const baseCount = 110

    const random = (min, max) => Math.random() * (max - min) + min

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const { innerWidth: width, innerHeight: height } = window
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const spawnParticle = (fromBottom = false) => {
      const width = window.innerWidth
      const height = window.innerHeight
      particles.push({
        x: random(0, width),
        y: fromBottom ? random(height * 0.85, height + 30) : random(0, height),
        size: random(0.8, 2.4),
        speedY: random(0.2, 0.95),
        speedX: random(-0.15, 0.15),
        alpha: random(0.2, 0.8),
        color: PARTICLE_COLORS[Math.floor(random(0, PARTICLE_COLORS.length))],
      })
    }

    resize()
    for (let i = 0; i < baseCount; i += 1) spawnParticle(false)

    let lastSpawn = 0
    const draw = (t) => {
      if (!running) return
      const width = window.innerWidth
      const height = window.innerHeight

      const gradient = ctx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, Math.max(width, height) * 0.72)
      gradient.addColorStop(0, '#120b18')
      gradient.addColorStop(0.55, '#050409')
      gradient.addColorStop(1, '#000000')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)

      if (t - lastSpawn > 70 && particles.length < 220) {
        spawnParticle(true)
        lastSpawn = t
      }

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i]
        p.y -= p.speedY
        p.x += p.speedX
        p.alpha *= 0.9993
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        if (p.y < -20 || p.alpha < 0.08 || p.x < -30 || p.x > width + 30) particles.splice(i, 1)
      }
      ctx.globalAlpha = 1
      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)
    return () => {
      running = false
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
  }, [mounted])

  if (!mounted) return null

  const visibleWord = (visible) => ({
    ...WORD_STYLE,
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(16px)',
    filter: visible ? 'blur(0)' : 'blur(8px)',
  })

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#000',
        opacity: fadingOut ? 0 : 1,
        transition: 'opacity 800ms ease',
        pointerEvents: 'none',
      }}
    >
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '14px',
        }}
      >
        <div style={visibleWord(showConnect && !fadingOut ? true : showConnect)}>
          <span style={{ color: '#FF4D8D' }}>Connect.</span>
        </div>
        <div style={visibleWord(showCapture && !fadingOut ? true : showCapture)}>
          <span style={{ color: '#ffffff' }}>Capture.</span>
        </div>
        <div style={visibleWord(showCreate && !fadingOut ? true : showCreate)}>
          <span style={{ color: '#1DB954' }}>Create.</span>
        </div>

        <div
          style={{
            width: showLine ? '300px' : '0px',
            height: '1px',
            marginTop: '18px',
            background: '#1DB954',
            boxShadow: '0 0 10px rgba(29,185,84,0.55)',
            transition: 'width 500ms ease',
          }}
        />
        <div
          style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: '14px',
            textTransform: 'uppercase',
            letterSpacing: '6px',
            color: 'rgba(255,255,255,0.7)',
            opacity: showBrand ? 1 : 0,
            transform: showBrand ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 420ms ease, transform 420ms ease',
          }}
        >
          LensTrybe
        </div>
      </div>
    </div>
  )
}
