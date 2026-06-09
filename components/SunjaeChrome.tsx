'use client'

import { useEffect, useRef, useState } from 'react'

export type RouteDirection = 'next' | 'prev'

export const ROUTE_DIRECTION_KEY = 'sunjae_route_direction'
export const SKIP_HOME_BOOT_KEY = 'sunjae_skip_home_boot'

function NoiseBar() {
  const [offset, setOffset] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const iv = setInterval(() => {
      setOffset((Date.now() * 7) % 100)
      setVisible(Math.random() > 0.7)
    }, 80)
    return () => clearInterval(iv)
  }, [])

  return visible ? <div className="sf-noise-bar" style={{ top: `${offset}%` }} /> : null
}

function FlickerOverlay() {
  const [on, setOn] = useState(false)

  useEffect(() => {
    const iv = setInterval(() => {
      if (Math.random() > 0.93) {
        setOn(true)
        setTimeout(() => setOn(false), 30 + Math.random() * 50)
      }
    }, 300)
    return () => clearInterval(iv)
  }, [])

  return on ? <div className="sf-flicker" /> : null
}

function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = window.innerWidth
    let height = window.innerHeight
    let raf: number

    const seeded = (i: number, salt: number) => {
      const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
      return x - Math.floor(x)
    }

    const stars = Array.from({ length: 200 }, (_, i) => ({
      x: seeded(i, 1),
      y: seeded(i, 2),
      r: seeded(i, 3) * 1.8 + 0.4,
      drift: seeded(i, 4) * 0.8 + 0.12,
      phase: seeded(i, 5) * Math.PI * 2,
      bright: seeded(i, 6) > 0.85,
    }))

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width
      canvas.height = height
    }

    const draw = () => {
      const now = Date.now() * 0.001
      ctx.clearRect(0, 0, width, height)
      stars.forEach(s => {
        const base = s.bright ? 0.6 : 0.3
        const a = base + Math.sin(now * 0.9 + s.phase) * 0.16
        const x = s.x * width
        const y = (s.y * height + now * s.drift) % height
        ctx.fillStyle = s.bright ? `rgba(200,255,240,${a})` : `rgba(0,255,204,${a})`
        if (s.bright) {
          ctx.shadowColor = 'rgba(0,255,204,0.5)'
          ctx.shadowBlur = 4
        }
        ctx.beginPath()
        ctx.arc(x, y, s.r, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      })
      raf = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 z-[0] pointer-events-none" style={{ opacity: 0.8 }} />
}

function GlitchLabel({ text }: { text: string }) {
  return <span className="sf-glitch sf-label-bright" data-text={text}>{text}</span>
}

export function SunjaeChrome({
  interfaceLabel,
  previousHref,
  nextHref,
  onNavigate,
  onAccess,
}: {
  interfaceLabel: string
  previousHref?: string | null
  nextHref?: string | null
  onNavigate: (href: string, direction: RouteDirection) => void
  onAccess?: () => void
}) {
  const [time, setTime] = useState('')

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour12: false }))
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [])

  return (
    <>
      <div className="sf-scanlines pointer-events-none" />
      <NoiseBar />
      <FlickerOverlay />
      <div className="sf-grid-bg" />
      <Starfield />
      <div className="sf-vignette pointer-events-none" />

      <div className="sf-statusbar">
        <button onClick={() => onNavigate('/', 'prev')} className="sf-topbar-home">
          <span className="sf-statusbar-dot" />
          <span className="sf-label-bright"><span className="sf-brand-word">SUNJAE</span>_OS v2.4</span>
        </button>
        <div className="sf-interface-switcher">
          {previousHref ? (
            <button onClick={() => onNavigate(previousHref, 'prev')} className="sf-interface-bracket" aria-label="Previous interface">{'<'}</button>
          ) : (
            <button className="sf-interface-bracket sf-interface-bracket-disabled" aria-label="Previous interface disabled" disabled>{'<'}</button>
          )}
          <GlitchLabel text={interfaceLabel} />
          {nextHref ? (
            <button onClick={() => onNavigate(nextHref, 'next')} className="sf-interface-bracket" aria-label="Next interface">{'>'}</button>
          ) : (
            <button className="sf-interface-bracket sf-interface-bracket-disabled" aria-label="Next interface disabled" disabled>{'>'}</button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="sf-label" style={{ opacity: 0.7 }}>{time}</span>
          <span className="sf-label-bright">■ ONLINE</span>
        </div>
      </div>

      <div className="sf-bottombar">
        <button onClick={onAccess} className="sf-access-btn">[ ACCESS ]</button>
        <span className="sf-label sf-glitch-subtle" data-text="ALL SYSTEMS NOMINAL">ALL SYSTEMS NOMINAL</span>
        <button onClick={() => window.open('https://x.com/4rgonautika', '_blank')} className="sf-link-btn">TWITTER</button>
      </div>
    </>
  )
}
