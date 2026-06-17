'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ROUTE_DIRECTION_KEY, SKIP_HOME_BOOT_KEY, SunjaeChrome, type RouteDirection } from '@/components/SunjaeChrome'

const ChatPopupDynamic = dynamic(() => import('@/components/ChatPopup'), { ssr: false })

const NAV_ITEMS = [
  { label: 'PROLOGUE', sub: 'Wizard and Ballerina', href: '/', id: 'PRO-001' },
  { label: 'CHARACTERS', sub: 'KIM MINJAE × LEE SUN', href: '/character', id: 'CHR-002' },
  { label: 'RECORDS', sub: 'Roleplay Session Archive', href: '/record', id: 'REC-003' },
  { label: 'TIMELINE', sub: 'Doomsday', href: '/timeline', id: 'TML-004' },
  { label: 'UNIVERSES', sub: 'Alternate Worlds', href: '/au', id: 'UNI-005' },
]
const EXTRAS = [
  { label: 'INTERVIEW // KIM MINJAE', href: '/foreword' },
  { label: 'INTERVIEW // LEE SUN', href: '/rebuttal' },
]
const ADMIN_ITEMS = [
  { label: 'ADMIN', sub: 'Stage Door', href: '/admin' },
  { label: 'SHEETS', sub: 'Documents & Links', href: '/sheets' },
  { label: 'LOGOUT', sub: '', href: '__logout__' },
]

const shouldSkipHomeBoot = () => (
  typeof window !== 'undefined' && sessionStorage.getItem(SKIP_HOME_BOOT_KEY) === 'true'
)

const HOME_LAYOUT_LEFT = 22
const HOME_LAYOUT_TOP = 46
const HOME_LAYOUT_BOTTOM = 775
const HOME_LAYOUT_STATIC_RIGHT = 1082
const HOME_NAV_LEFT = 779
const HOME_LAYOUT_HEIGHT = HOME_LAYOUT_BOTTOM - HOME_LAYOUT_TOP

function getHomeLayoutRight(viewportWidth: number) {
  const navWidth = Math.min(360, Math.max(260, viewportWidth * 0.28)) + 2
  return Math.max(HOME_LAYOUT_STATIC_RIGHT, HOME_NAV_LEFT + navWidth)
}

function getHomeLayoutOffset() {
  if (typeof window === 'undefined') return { x: 0, y: 0 }
  const layoutRight = getHomeLayoutRight(window.innerWidth)
  const layoutWidth = layoutRight - HOME_LAYOUT_LEFT
  const centeredLeft = (window.innerWidth - layoutWidth) / 2
  const centeredTop = (window.innerHeight - HOME_LAYOUT_HEIGHT) / 2

  return {
    x: Math.round(centeredLeft - HOME_LAYOUT_LEFT),
    y: Math.max(0, Math.round(centeredTop - HOME_LAYOUT_TOP)),
  }
}

function useHomeLayoutOffset() {
  const [offset, setOffset] = useState(getHomeLayoutOffset)

  useEffect(() => {
    const update = () => setOffset(getHomeLayoutOffset())
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return offset
}

/* ── useDrag ── */
function useDrag(getInitial: () => { x: number; y: number }, layoutKey?: string) {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const offset = useRef({ x: 0, y: 0 })
  const inited = useRef(false)
  const manuallyMoved = useRef(false)

  useEffect(() => {
    if (!inited.current || !manuallyMoved.current) {
      setPos(getInitial())
      inited.current = true
    }
  }, [layoutKey])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, a, canvas')) return
    manuallyMoved.current = true
    setDragging(true)
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
  }, [pos])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y })
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dragging])

  return { pos, onMouseDown, dragging }
}

/* ── DragWindow ── */
function DragWindow({ id, title, children, getInitialPos, z, onFocus, minimizable, className = '', layoutKey }: {
  id: string; title: string; children: React.ReactNode
  getInitialPos: () => { x: number; y: number }; z: number
  onFocus: (id: string) => void; minimizable?: boolean; className?: string; layoutKey?: string
}) {
  const { pos, onMouseDown, dragging } = useDrag(getInitialPos, layoutKey)
  const [minimized, setMinimized] = useState(false)
  return (
    <div className={`sf-window ${className} ${dragging ? 'sf-window-dragging' : ''}`}
      style={{ position: 'absolute', left: pos.x, top: pos.y, zIndex: z }}
      onMouseDown={(e) => { onFocus(id); onMouseDown(e) }}>
      <div className="sf-window-header" style={{ cursor: 'grab' }}>
        <div className="sf-window-dots">
          <span className="sf-dot sf-dot-red" /><span className="sf-dot sf-dot-yellow" /><span className="sf-dot sf-dot-green" />
        </div>
        <span className="sf-window-title">{title}</span>
        {minimizable && <button className="sf-window-minimize" onClick={() => setMinimized(!minimized)}>{minimized ? '□' : '─'}</button>}
      </div>
      {!minimized && <div className="sf-window-body">{children}</div>}
    </div>
  )
}

/* ── Glitch text ── */
function GlitchText({ text, className = '' }: { text: string; className?: string }) {
  return <span className={`sf-glitch ${className}`} data-text={text}>{text}</span>
}

/* ── Star Grid (geometric, like reference) ── */
function StarGrid() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 800)
    return () => clearInterval(iv)
  }, [])
  const seed = (i: number, t: number) => ((i * 9301 + 49297 + t * 7919) % 233280) / 233280
  const stars = Array.from({ length: 12 }, (_, i) => seed(i, tick) > 0.3)

  return (
    <div className="grid grid-cols-4 gap-2">
      {stars.map((on, i) => (
        <div key={i} className="flex items-center justify-center w-7 h-7 transition-all duration-300"
          style={{ opacity: on ? 0.9 : 0.15 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill={on ? '#00FFCC' : '#00FFCC'}>
            {i === 5 ? (
              <path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9Z" />
            ) : (
              <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5Z" />
            )}
          </svg>
        </div>
      ))}
    </div>
  )
}

/* ── Uptime / Status Block ── */
function UptimeStatus() {
  const [uptime, setUptime] = useState({ h: 18, m: 42 })
  const [load, setLoad] = useState(13)
  useEffect(() => {
    const iv = setInterval(() => {
      setUptime(prev => {
        const nm = prev.m + 1
        return nm >= 60 ? { h: prev.h + 1, m: 0 } : { ...prev, m: nm }
      })
      setLoad(((Date.now() * 9301 + 49297) % 233280) % 40 + 5)
    }, 60000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div className="flex flex-col gap-1">
      <span className="sf-label" style={{ letterSpacing: '0.2em' }}>UPTIME SYSTEM — ACTIVE</span>
      <span className="sf-label-bright">UPTIME: {String(uptime.h).padStart(2, '0')}:{String(uptime.m).padStart(2, '0')} — LOAD: {load}% — STATE: RUNNING</span>
    </div>
  )
}

/* ── Blob Shape (organic, like reference) ── */
function BlobShape() {
  const [t, setT] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setT(v => v + 1), 100)
    return () => clearInterval(iv)
  }, [])

  const p = (i: number) => Math.sin(t * 0.05 + i * 1.2) * 12
  return (
    <svg width="140" height="100" viewBox="0 0 140 100">
      <path
        d={`M30,50 C30,${20 + p(0)} ${50 + p(1)},10 70,${15 + p(2)} C${90 + p(3)},${20 + p(4)} 120,${35 + p(5)} ${115 + p(6)},55 C${110 + p(7)},${75 + p(8)} ${85 + p(9)},90 65,${85 + p(10)} C${45 + p(11)},${80 + p(12)} 30,70 30,50Z`}
        fill="none" stroke="#00FFCC" strokeWidth="1.2" opacity="0.5"
      />
      <circle cx={55 + p(0) * 0.5} cy={60 + p(3) * 0.3} r="6" fill="none" stroke="#00FFCC" strokeWidth="0.8" opacity="0.4" />
      <circle cx={85 + p(2) * 0.3} cy={45 + p(5) * 0.4} r="4" fill="none" stroke="#00FFCC" strokeWidth="0.8" opacity="0.3" />
    </svg>
  )
}

/* ── Restore / Process Block (like reference) ── */
function ProcessBlock() {
  const [state, setState] = useState('PROCESSING')
  const [coords, setCoords] = useState({ a: '7', b: '88', c: '88', d: '14' })
  useEffect(() => {
    const states = ['PROCESSING', 'ANALYZING', 'COMPILING', 'SYNCING']
    const iv = setInterval(() => {
      setState(states[Math.floor(Date.now() / 3000) % states.length])
      const s = (n: number) => String(((Date.now() * n + 49297) % 100)).padStart(2, '0')
      setCoords({ a: s(7), b: s(13), c: s(19), d: s(23) })
    }, 3000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div className="flex items-start gap-3">
      <svg width="60" height="50" viewBox="0 0 60 50">
        {[0, 1, 2, 3, 4].map(i => (
          <line key={i} x1={30 - i * 6} y1={i * 10 + 5} x2={30 + i * 6} y2={i * 10 + 5}
            stroke="#00FFCC" strokeWidth="2" opacity={0.3 + i * 0.15} />
        ))}
      </svg>
      <div className="flex flex-col gap-0.5">
        <span className="sf-label-bright" style={{ fontSize: '0.7rem' }}>RESTORE</span>
        <span className="sf-label">TARGET: BACKUP UNIT</span>
        <span className="sf-label">STATE: {state}</span>
        <span className="sf-label-bright" style={{ letterSpacing: '0.15em' }}>{coords.a} &quot; {coords.b} · {coords.c} &quot; {coords.d}</span>
      </div>
    </div>
  )
}

/* ── Rotating Triangle Scanner ── */
function TriangleScanner() {
  const [angle, setAngle] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setAngle(a => a + 1.5), 50)
    return () => clearInterval(iv)
  }, [])

  return (
    <svg width="90" height="90" viewBox="0 0 90 90">
      <polygon points="45,8 82,75 8,75" fill="none" stroke="#00FFCC" strokeWidth="1" opacity="0.5" />
      <polygon points="45,20 70,65 20,65" fill="none" stroke="#00FFCC" strokeWidth="0.6" opacity="0.3" />
      <polygon points="45,32 58,58 32,58" fill="none" stroke="#00FFCC" strokeWidth="0.4" opacity="0.2" />
      <line x1="45" y1="45" x2={45 + Math.cos(angle * 0.0175) * 30} y2={45 + Math.sin(angle * 0.0175) * 30}
        stroke="#00FFCC" strokeWidth="1.2" opacity="0.6" />
      <circle cx="45" cy="45" r="3" fill="#00FFCC" opacity="0.5" />
      <circle cx="45" cy="45" r="1" fill="#00FFCC" opacity="0.9" />
    </svg>
  )
}

/* ── Live Radar ── */
function LiveRadar() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const angleRef = useRef(0)
  const blips = useRef([
    { x: 0.35, y: 0.3, r: 3, c: '#00FFCC' },
    { x: 0.7, y: 0.6, r: 2.5, c: '#00CCFF' },
    { x: 0.45, y: 0.75, r: 2, c: '#00FFCC' },
  ])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const sz = 170, cx = sz / 2, cy = sz / 2, R = 72
    let raf: number
    const draw = () => {
      angleRef.current += 0.02
      ctx.clearRect(0, 0, sz, sz)
      ctx.strokeStyle = '#00FFCC'
      ;[R, R * 0.66, R * 0.33].forEach((r, i) => {
        ctx.lineWidth = i === 0 ? 1 : 0.5
        ctx.globalAlpha = i === 0 ? 0.5 : 0.25
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
      })
      ctx.globalAlpha = 0.2; ctx.lineWidth = 0.4
      ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke()
      ctx.globalAlpha = 1
      const a = angleRef.current
      ctx.fillStyle = 'rgba(0,255,204,0.06)'
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, R, a - 0.5, a)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = '#00FFCC'
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.8
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
      ctx.stroke()
      blips.current.forEach(b => {
        const bx = cx + (b.x - 0.5) * R * 2, by = cy + (b.y - 0.5) * R * 2
        const dist = Math.sqrt((bx - cx) ** 2 + (by - cy) ** 2)
        if (dist > R) return
        const blipAngle = Math.atan2(by - cy, bx - cx)
        let diff = a - blipAngle
        while (diff < 0) diff += Math.PI * 2
        while (diff > Math.PI * 2) diff -= Math.PI * 2
        const fade = diff < 1.5 ? 1 - diff / 1.5 : 0
        ctx.globalAlpha = 0.3 + fade * 0.7
        ctx.fillStyle = b.c
        ctx.shadowColor = b.c
        ctx.shadowBlur = 8
        ctx.beginPath(); ctx.arc(bx, by, b.r, 0, Math.PI * 2); ctx.fill()
        ctx.shadowBlur = 0
      })
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={canvasRef} width={170} height={170} style={{ display: 'block' }} />
}

/* ── Interactive Globe ── */
function InteractiveGlobe() {
  const [hovered, setHovered] = useState(false)
  const [ping, setPing] = useState(false)
  const [rotation, setRotation] = useState(0)

  useEffect(() => {
    const iv = setInterval(() => setRotation(r => r + 0.5), 50)
    return () => clearInterval(iv)
  }, [])

  const doPing = () => { setPing(true); setTimeout(() => setPing(false), 600) }

  const accent = hovered ? '#00FFE0' : '#00FFCC'
  const glow = hovered ? 0.4 : 0.2
  const off = Math.sin(rotation * 0.017) * 20

  return (
    <svg width="180" height="180" viewBox="0 0 200 200"
      style={{ filter: `drop-shadow(0 0 ${ping ? 20 : 8}px rgba(0,255,204,${glow}))`, cursor: 'pointer', transition: 'filter 0.3s' }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onClick={doPing}>
      <circle cx="100" cy="100" r="85" stroke={accent} strokeWidth={hovered ? 1.8 : 1.2} fill="none" opacity="0.6" />
      <ellipse cx="100" cy="100" rx={55 + off * 0.3} ry="85" stroke={accent} strokeWidth="0.8" fill="none" opacity="0.4" />
      <ellipse cx="100" cy="100" rx={25 + off * 0.15} ry="85" stroke={accent} strokeWidth="0.6" fill="none" opacity="0.3" />
      <ellipse cx="100" cy="100" rx="85" ry={55 + off * 0.2} stroke={accent} strokeWidth="0.8" fill="none" opacity="0.4" />
      <ellipse cx="100" cy="100" rx="85" ry={25 + off * 0.1} stroke={accent} strokeWidth="0.6" fill="none" opacity="0.3" />
      {[-60, -40, -20, 0, 20, 40, 60].map(y => (
        <line key={y} x1="15" y1={100 + y} x2="185" y2={100 + y} stroke={accent} strokeWidth="0.3" opacity="0.2" />
      ))}
      <line x1="100" y1="15" x2="100" y2="185" stroke={accent} strokeWidth="0.3" opacity="0.2" />
      {ping && <circle cx="100" cy="100" r="85" stroke="#00FFCC" strokeWidth="2" fill="none" opacity="0.8" className="sf-ping" />}
    </svg>
  )
}

/* ── Interactive Sliders ── */
function InteractiveSliders() {
  const [values, setValues] = useState({ FREQ: 72, AMPL: 45, GAIN: 88, PHASE: 31, DECAY: 60 })

  const handleSlider = (key: string, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.round(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)))
    setValues(prev => ({ ...prev, [key]: pct }))
  }

  return (
    <div className="flex flex-col gap-3">
      {Object.entries(values).map(([key, val]) => (
        <div key={key} className="flex items-center gap-3">
          <span className="sf-label-bright" style={{ width: 48, textAlign: 'right' }}>{key}</span>
          <div className="flex-1 h-[6px] relative cursor-pointer" style={{ background: 'rgba(0,255,204,0.1)' }}
            onClick={(e) => handleSlider(key, e)}>
            <div className="absolute left-0 top-0 h-full transition-all duration-100" style={{
              width: `${val}%`, background: '#00FFCC', opacity: 0.4,
              boxShadow: '0 0 10px rgba(0,255,204,0.4)',
            }} />
            <div className="absolute top-1/2 w-[5px] h-[14px] -translate-y-1/2 transition-all duration-100" style={{
              left: `${val}%`, background: '#00FFCC',
              boxShadow: '0 0 8px #00FFCC',
            }} />
          </div>
          <span className="sf-label-bright" style={{ width: 36 }}>{val}%</span>
        </div>
      ))}
    </div>
  )
}

/* ── HexStream ── */
function HexStream() {
  const [lines, setLines] = useState<string[]>([])
  useEffect(() => {
    const gen = () => {
      const s = (n: number) => ((n * 9301 + 49297) % 233280).toString(16).toUpperCase().padStart(4, '0')
      const t = Date.now()
      return Array.from({ length: 8 }, (_, i) =>
        `0x${s(t + i * 37)}  ${s(t + i * 91)}  ${s(t + i * 53)}  ${s(t + i * 71)}`
      )
    }
    setLines(gen())
    const iv = setInterval(() => setLines(gen()), 150)
    return () => clearInterval(iv)
  }, [])
  return (
    <div className="sf-hex">{lines.map((l, i) => <div key={i}>{l}</div>)}</div>
  )
}

/* ── Live Data Matrix ── */
function LiveDataMatrix() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 500)
    return () => clearInterval(iv)
  }, [])
  const seed = (i: number, t: number) => ((i * 9301 + 49297 + t * 7919) % 233280) / 233280
  return (
    <div className="grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(14, 1fr)' }}>
      {Array.from({ length: 70 }, (_, i) => {
        const v = seed(i, tick)
        return (
          <div key={i} className="w-[7px] h-[7px] transition-opacity duration-300" style={{
            background: v > 0.85 ? '#00CCFF' : '#00FFCC',
            opacity: v > 0.3 ? 0.15 + v * 0.7 : 0.06,
            boxShadow: v > 0.75 ? `0 0 5px ${v > 0.85 ? '#00CCFF' : '#00FFCC'}80` : 'none',
          }} />
        )
      })}
    </div>
  )
}

/* ── Noise effects ── */
function NoiseBar() {
  const [offset, setOffset] = useState(0)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const iv = setInterval(() => {
      setOffset(((Date.now() * 7) % 100))
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
      if (Math.random() > 0.93) { setOn(true); setTimeout(() => setOn(false), 30 + Math.random() * 50) }
    }, 300)
    return () => clearInterval(iv)
  }, [])
  return on ? <div className="sf-flicker" /> : null
}

/* ── Connection lines ── */
function ConnectionLines() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-[1]">
      <line x1="22%" y1="40%" x2="40%" y2="22%" stroke="#00FFCC" strokeWidth="0.5" opacity="0.15" strokeDasharray="4 4" />
      <line x1="78%" y1="40%" x2="60%" y2="22%" stroke="#00FFCC" strokeWidth="0.5" opacity="0.15" strokeDasharray="4 4" />
      <circle cx="22%" cy="40%" r="3" fill="#00FFCC" opacity="0.3" />
      <circle cx="78%" cy="40%" r="3" fill="#00FFCC" opacity="0.3" />
    </svg>
  )
}

/* ── Boot Sequence (scrolling terminal) ── */
const BOOT_LINES = [
  '[0.000] BIOS POST ... OK',
  '[0.012] Memory check: 65536 KB ... PASS',
  '[0.034] CPU: ZETA-CORE x4 @ 3.2GHz',
  '[0.041] GPU: SUNJAE-GFX v2.4 (holographic)',
  '[0.058] Initializing kernel modules...',
  '[0.071]   ├─ net.uplink .......... loaded',
  '[0.083]   ├─ sys.encryption ..... loaded',
  '[0.094]   ├─ fs.quantum ......... loaded',
  '[0.108]   ├─ drv.holodisplay .... loaded',
  '[0.119]   ├─ ai.neural_core ..... loaded',
  '[0.132]   └─ sec.firewall ....... loaded',
  '[0.150] Mounting /dev/zeta0 ... OK',
  '[0.167] Loading PROJECT_ZETA configuration...',
  '[0.184] Parsing nav manifest: 5 routes found',
  '[0.201] Connecting to ORBITAL_NET ...',
  '[0.220]   Signal strength: ████████░░ 82%',
  '[0.238]   Relay nodes: 7 active / 2 standby',
  '[0.255]   Latency: 12ms (nominal)',
  '[0.270] Verifying clearance: LEVEL-4 ACCESS',
  '[0.290] Loading asset pipeline...',
  '[0.310]   Characters DB ........ synced',
  '[0.328]   Timeline records ..... synced',
  '[0.345]   Universe manifold .... synced',
  '[0.362] Establishing holographic buffer...',
  '[0.380] Calibrating display matrix: 1920x1080',
  '[0.400] Scanning sectors: 8/8 nominal',
  '[0.420] All systems nominal.',
  '[0.440] ═══════════════════════════════════',
  '[0.460]  PROJECT ZETA // SUNJAE INTERFACE',
  '[0.480]  Version 2.4.1 — Build 2024.12.01',
  '[0.500] ═══════════════════════════════════',
  '[0.520] Ready. Launching interface...',
]

function BootSequence({ onDone }: { onDone: () => void }) {
  const [lines, setLines] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const idxRef = useRef(0)

  useEffect(() => {
    idxRef.current = 0
    setLines([])
    const iv = setInterval(() => {
      if (idxRef.current < BOOT_LINES.length) {
        const line = BOOT_LINES[idxRef.current]
        idxRef.current++
        setLines(prev => [...prev, line])
      } else {
        clearInterval(iv)
        setTimeout(onDone, 400)
      }
    }, 65)
    return () => clearInterval(iv)
  }, [onDone])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [lines])

  return (
    <div className="absolute inset-0 z-[200] bg-[#050a0d] flex items-center justify-center">
      <div ref={containerRef} className="w-[600px] max-w-[90vw] h-[400px] max-h-[70vh] overflow-hidden"
        style={{ fontFamily: "'JetBrains Mono', 'Space Mono', monospace", fontSize: '0.65rem', lineHeight: 1.8 }}>
        {lines.map((line, i) => (
          <div key={i} style={{ color: line.includes('═') || line.includes('PROJECT ZETA') ? '#00FFCC' : line.includes('OK') || line.includes('loaded') || line.includes('synced') || line.includes('PASS') ? '#00FFCC' : 'rgba(0,255,204,0.6)', textShadow: line.includes('PROJECT ZETA') ? '0 0 10px rgba(0,255,204,0.5)' : 'none' }}>
            {line}
          </div>
        ))}
        {lines.length < BOOT_LINES.length && <span style={{ color: '#00FFCC' }} className="sf-blink">█</span>}
      </div>
    </div>
  )
}

/* ── Planet bitmap scan ── */
function Planet() {
  return (
    <div className="sf-bitmap-scan sf-bitmap-scan-planet">
      <img src="/assets/planet-scan-bitmap-v2-lowres.png" alt="Planet scan bitmap" draggable={false} />
    </div>
  )
}

/* ── Ocean wave bitmap scan ── */
function OceanWave() {
  return (
    <div className="sf-bitmap-scan sf-bitmap-scan-ocean">
      <img src="/assets/ocean-wave-bitmap-v2-lowres.png" alt="Ocean wave bitmap" draggable={false} />
    </div>
  )
}

/* ── Starfield background particles ── */
function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = window.innerWidth, H = window.innerHeight
    canvas.width = W; canvas.height = H
    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.8 + 0.4,
      speed: Math.random() * 0.15 + 0.02,
      flicker: Math.random() * Math.PI * 2,
      bright: Math.random() > 0.85,
    }))
    let raf: number
    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      stars.forEach(s => {
        s.flicker += 0.015
        const base = s.bright ? 0.6 : 0.3
        const a = base + Math.sin(s.flicker) * 0.2
        ctx.fillStyle = s.bright ? `rgba(200,255,240,${a})` : `rgba(0,255,204,${a})`
        if (s.bright) { ctx.shadowColor = 'rgba(0,255,204,0.5)'; ctx.shadowBlur = 4 }
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill()
        ctx.shadowBlur = 0
        s.y += s.speed
        if (s.y > H) { s.y = 0; s.x = Math.random() * W }
      })
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 z-[0] pointer-events-none" style={{ opacity: 0.8 }} />
}

/* ═══ MAIN ═══ */
export default function Home() {
  const router = useRouter()
  const [skipBoot] = useState(shouldSkipHomeBoot)
  const [bootDone, setBootDone] = useState(skipBoot)
  const handleBootDone = useCallback(() => setBootDone(true), [])
  const [booted, setBooted] = useState(skipBoot)
  const [ready, setReady] = useState(skipBoot)
  const [windowsReady, setWindowsReady] = useState(false)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState<'manon' | 'dylan'>('manon')
  const [isAdmin, setIsAdmin] = useState(false)
  const [loggedUser, setLoggedUser] = useState<string | null>(null)
  const [routeDirection, setRouteDirection] = useState<RouteDirection>('next')
  const [routeReady, setRouteReady] = useState(false)
  const [routeLeaving, setRouteLeaving] = useState(false)
  const [winOrder, setWinOrder] = useState<Record<string, number>>({
    title: 66, nav: 67, radar: 58, sliders: 51, matrix: 54, info: 64, hex: 62, stars: 22, planet: 57, ocean: 52,
  })
  const homeLayoutOffset = useHomeLayoutOffset()
  const homeLayoutKey = `${homeLayoutOffset.x}:${homeLayoutOffset.y}`
  const homePos = useCallback((x: number, y: number) => ({
    x: x + homeLayoutOffset.x,
    y: y + homeLayoutOffset.y,
  }), [homeLayoutOffset])

  const bringToFront = useCallback((id: string) => {
    setWinOrder(prev => ({ ...prev, [id]: Math.max(...Object.values(prev)) + 1 }))
  }, [])

  useEffect(() => {
    if (skipBoot) {
      sessionStorage?.removeItem(SKIP_HOME_BOOT_KEY)
      setBooted(true)
      setReady(true)
      setIsAdmin(localStorage?.getItem('same_admin_login') === 'true')
      setLoggedUser(localStorage?.getItem('same_logged_user') || null)
      return
    }

    const t1 = setTimeout(() => setBooted(true), 300)
    const t2 = setTimeout(() => setReady(true), 600)
    setIsAdmin(localStorage?.getItem('same_admin_login') === 'true')
    setLoggedUser(localStorage?.getItem('same_logged_user') || null)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [skipBoot])

  useEffect(() => {
    const stored = sessionStorage?.getItem(ROUTE_DIRECTION_KEY)
    if (stored === 'prev' || stored === 'next') setRouteDirection(stored)
    sessionStorage?.removeItem(ROUTE_DIRECTION_KEY)
    const raf = requestAnimationFrame(() => setRouteReady(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    if (!bootDone) return
    setWindowsReady(false)
    const t = setTimeout(() => setWindowsReady(true), skipBoot ? 80 : 850)
    return () => clearTimeout(t)
  }, [bootDone, skipBoot])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) {
        localStorage?.setItem('same_admin_login', 'true')
        localStorage?.setItem('same_logged_user', username)
        localStorage?.setItem('sunjae_chat_as', username)
        setIsAdmin(true); setLoggedUser(username); setShowLogin(false); setPassword('')
      } else {
        const data = await res.json().catch(() => null)
        alert(data?.error ? `ACCESS DENIED: ${data.error}` : `ACCESS DENIED (${res.status})`)
      }
    } catch { alert('SYSTEM ERROR') }
  }

  const handleLogout = async () => {
    try { await fetch('/api/auth', { method: 'DELETE' }) } catch {}
    localStorage?.removeItem('same_admin_login')
    localStorage?.removeItem('same_logged_user')
    setIsAdmin(false); setLoggedUser(null)
  }

  const navigateInterface = (href: string, direction: RouteDirection) => {
    sessionStorage?.setItem(ROUTE_DIRECTION_KEY, direction)
    if (href === '/') sessionStorage?.setItem(SKIP_HOME_BOOT_KEY, 'true')
    setRouteDirection(direction)
    setRouteLeaving(true)
    setTimeout(() => router.push(href), 520)
  }

  return (
    <div className="fixed inset-0 z-[60] bg-[#050a0d] overflow-hidden">
      <SunjaeChrome
        interfaceLabel="TECHNOLOGY_INTERFACE"
        previousHref="/au"
        nextHref="/character"
        onNavigate={navigateInterface}
        onAccess={() => setShowLogin(true)}
      />

      {/* Boot Sequence */}
      {!bootDone && <BootSequence onDone={handleBootDone} />}
      <div className={`absolute inset-0 z-[199] bg-[#050a0d] transition-opacity duration-700 ${bootDone ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} />

      <div className={`absolute inset-0 transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`}>
        <div className={`absolute inset-0 sf-route-slide sf-route-${routeDirection} ${routeReady ? 'sf-route-slide-ready' : ''} ${routeLeaving ? 'sf-route-slide-leaving' : ''} ${windowsReady ? 'sf-windows-ready' : ''}`}>
        <ConnectionLines />

        {/* ── TITLE ── */}
        <DragWindow id="title" title="MAIN // PROJECT_ZETA"
          getInitialPos={() => homePos(256, 180)} layoutKey={homeLayoutKey}
          z={winOrder.title} onFocus={bringToFront} className="sf-win-anim sf-win-anim-5">
          <div className="flex flex-col items-center py-6 px-8">
            <span className="sf-label tracking-[0.5em] mb-3">PROJECT_ZETA</span>
            <h1 className="sf-title-main"><GlitchText text="SUNJAE" /></h1>
            <div className="sf-line my-4" />
            <p className="sf-label-bright tracking-[0.25em]">WIZARD AND BALLERINA</p>
            <p className="sf-label mt-2">of <em>LEE SUN</em> × <em>KIM MINJAE</em></p>
          </div>
        </DragWindow>

        {/* ── STAR GRID + STATUS (reference-inspired) ── */}
        <DragWindow id="stars" title="RELAY_STATUS"
          getInitialPos={() => homePos(22, 54)} layoutKey={homeLayoutKey}
          z={winOrder.stars} onFocus={bringToFront} className="sf-win-anim sf-win-anim-8">
          <div className="p-3 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <StarGrid />
              <InteractiveGlobe />
            </div>
            <div className="flex gap-6">
              <div className="flex flex-col gap-0.5">
                <span className="sf-label">RELAY LINK</span>
                <span className="sf-label-bright">ONLINE</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="sf-label">POWER: 98%</span>
                <span className="sf-label">VOLTAGE: 4.1V</span>
              </div>
            </div>
            <UptimeStatus />
          </div>
        </DragWindow>

        {/* ── RADAR ── */}
        <DragWindow id="radar" title="PROXIMITY_SCAN"
          getInitialPos={() => homePos(600, 31)} layoutKey={homeLayoutKey}
          z={winOrder.radar} onFocus={bringToFront} className="sf-win-anim sf-win-anim-9">
          <div className="flex flex-col items-center p-2">
            <LiveRadar />
            <span className="sf-label mt-1">TARGETS: 3 | SWEEP: ACTIVE</span>
          </div>
        </DragWindow>

        {/* ── NAV ── */}
        <DragWindow id="nav" title="NAVIGATION_INDEX"
          getInitialPos={() => homePos(779, 308)} layoutKey={homeLayoutKey}
          z={winOrder.nav} onFocus={bringToFront} className="sf-win-anim sf-win-anim-4">
          <div className="py-1" style={{ width: 'clamp(260px, 28vw, 360px)' }}>
            {NAV_ITEMS.map((item, i) => (
              <button key={item.href}
                onClick={() => router.push(item.href)}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="sf-nav-row group"
                style={{ opacity: hoveredIdx !== null && hoveredIdx !== i ? 0.25 : 1 }}>
                <span className="sf-nav-id">{item.id}</span>
                <span className="sf-nav-label">{item.label}</span>
                <span className="sf-nav-sub">{item.sub}</span>
                <span className="sf-nav-arrow group-hover:translate-x-1">→</span>
              </button>
            ))}
            <div className="sf-line my-1" />
            {EXTRAS.map(ext => (
              <button key={ext.href} onClick={() => router.push(ext.href)} className="sf-nav-row sf-nav-row-dim">
                <span className="sf-nav-label">{ext.label}</span>
              </button>
            ))}
            {isAdmin && (
              <>
                <div className="sf-line my-1" />
                {ADMIN_ITEMS.map(item => (
                  <button key={item.href}
                    onClick={() => item.href === '__logout__' ? handleLogout() : router.push(item.href)}
                    className="sf-nav-row sf-nav-row-dim">
                    <span className="sf-nav-label">{item.label}</span>
                    {item.sub && <span className="sf-nav-sub">{item.sub}</span>}
                  </button>
                ))}
              </>
            )}
          </div>
        </DragWindow>

        {/* ── SLIDERS ── */}
        <DragWindow id="sliders" title="PARAMETERS"
          getInitialPos={() => homePos(64, 402)} layoutKey={homeLayoutKey}
          z={winOrder.sliders} onFocus={bringToFront} className="sf-win-anim sf-win-anim-3">
          <div className="p-3" style={{ width: 'clamp(230px, 24vw, 310px)' }}>
            <InteractiveSliders />
          </div>
        </DragWindow>

        {/* ── DATA MATRIX ── */}
        <DragWindow id="matrix" title="DATA_MATRIX" minimizable
          getInitialPos={() => homePos(459, 471)} layoutKey={homeLayoutKey}
          z={winOrder.matrix} onFocus={bringToFront} className="sf-win-anim sf-win-anim-2">
          <div className="p-3 flex flex-col items-center gap-2">
            <LiveDataMatrix />
            <span className="sf-label">CLUSTER_STATUS: NOMINAL</span>
          </div>
        </DragWindow>

        {/* ── HEX STREAM ── */}
        <DragWindow id="hex" title="MEMORY_DUMP" minimizable
          getInitialPos={() => homePos(570, 580)} layoutKey={homeLayoutKey}
          z={winOrder.hex} onFocus={bringToFront} className="sf-win-anim sf-win-anim-1">
          <div className="p-3">
            <HexStream />
          </div>
        </DragWindow>

        {/* ── SYSTEM INFO ── */}
        <DragWindow id="info" title="SYSTEM_INFO"
          getInitialPos={() => homePos(764, 558)} layoutKey={homeLayoutKey}
          z={winOrder.info} onFocus={bringToFront} className="sf-win-anim sf-win-anim-1">
          <div className="p-3 flex flex-col gap-[8px]">
            {[['//PROJECT_', 'SUNJAE'], ['//VERSION_', 'v2.4.1'], ['//STATUS_', 'OPERATIONAL'], ['//BUILD_', '2024.12.01'], ['//AUTHOR_', 'SUNJAE']].map(([k, v]) => (
              <div key={k} className="flex items-center gap-3">
                <span className="sf-label" style={{ minWidth: 84 }}>{k}</span>
                <span className="sf-label-bright">{v}</span>
              </div>
            ))}
          </div>
        </DragWindow>

        {/* ── PLANET ── */}
        <DragWindow id="planet" title="PLANET_ZETA-7"
          getInitialPos={() => homePos(826, 44)} layoutKey={homeLayoutKey}
          z={winOrder.planet} onFocus={bringToFront} className="sf-win-anim sf-win-anim-7">
          <div className="p-2 flex flex-col gap-2">
            <Planet />
            <div className="sf-scan-meta">
              <span>CLASS: M</span>
              <span>ORBIT: 3.2AU</span>
              <span>ATM: 78%</span>
            </div>
          </div>
        </DragWindow>

        {/* ── OCEAN WAVE ── */}
        <DragWindow id="ocean" title="TIDAL_MONITOR"
          getInitialPos={() => homePos(115, 518)} layoutKey={homeLayoutKey}
          z={winOrder.ocean} onFocus={bringToFront} className="sf-win-anim sf-win-anim-1">
          <div className="p-2 flex flex-col gap-2">
            <OceanWave />
            <div className="sf-scan-meta">
              <span>DEPTH: 4,200m</span>
              <span>CUR: 2.1kt NW</span>
              <span>NOISE: 13%</span>
            </div>
          </div>
        </DragWindow>
        </div>
      </div>

      {/* Login */}
      {showLogin && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowLogin(false)}>
          <div className="sf-window" style={{ width: 320 }} onClick={e => e.stopPropagation()}>
            <div className="sf-window-header">
              <div className="sf-window-dots"><span className="sf-dot sf-dot-red" /><span className="sf-dot sf-dot-yellow" /><span className="sf-dot sf-dot-green" /></div>
              <span className="sf-window-title">ACCESS_TERMINAL</span>
            </div>
            <div className="sf-window-body p-6">
              <div className="flex gap-2 mb-4">
                {(['manon', 'dylan'] as const).map(u => (
                  <button key={u} onClick={() => setUsername(u)}
                    className="flex-1 py-2 sf-label-bright tracking-widest transition-all"
                    style={{
                      border: `1px solid ${username === u ? '#00FFCC' : 'rgba(0,255,204,0.2)'}`,
                      color: username === u ? '#00FFCC' : 'rgba(255,255,255,0.4)',
                      background: username === u ? 'rgba(0,255,204,0.08)' : 'transparent',
                    }}>{u === 'manon' ? 'KIM MINJAE' : 'LEE SUN'}</button>
                ))}
              </div>
              <input type="password" placeholder="ENTER_KEY" value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleLogin(e as any) }}
                className="sf-input w-full mb-3" autoFocus />
              <button onClick={e => handleLogin(e as any)} className="sf-submit w-full">AUTHENTICATE</button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && <ChatPopupDynamic />}
    </div>
  )
}
