'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ROUTE_DIRECTION_KEY, SKIP_HOME_BOOT_KEY, SunjaeChrome, type RouteDirection } from '@/components/SunjaeChrome'

interface PhaseData {
  id: string
  symbol: string
  label: string
  name: string
  quote: string
  nameKr: string
  nameEn: string
  age: string
  height: string
  weight: string
  personality: string[]
  abilityName: string
  abilityDesc: string
  mainQuote: string
  stats?: { label: string; value: number }[]
  profileImage?: string
  voiceFile?: string
  voiceLabel?: string
}

const defaultManon: PhaseData[] = [
  {
    id: 'manon-0', symbol: 'K', label: 'VARIATION · I', name: '[ Premiere ]', quote: '" 비밀이야. "',
    nameKr: 'KIM MINJAE', nameEn: 'KIM MINJAE',
    age: '-', height: '-', weight: '-',
    personality: [], abilityName: '', abilityDesc: '', mainQuote: '""',
  },
]

const defaultDylan: PhaseData[] = [
  {
    id: 'dylan-0', symbol: 'L', label: 'INCANTATION · I', name: '[ Cantus ]', quote: '" - "',
    nameKr: 'LEE SUN', nameEn: 'LEE SUN',
    age: '-', height: '-', weight: '-',
    personality: [], abilityName: '', abilityDesc: '', mainQuote: '""',
  },
]

const MANON_COLOR = '#ff6b9d'
const DYLAN_COLOR = '#00ccff'
const CHARACTER_LABELS = {
  manon: 'KIM MINJAE',
  dylan: 'LEE SUN',
} as const

function normalizeCharacterDisplayName(value: string) {
  const key = value.trim().toLowerCase()
  if (key === 'manon') return CHARACTER_LABELS.manon
  if (key === 'dylan') return CHARACTER_LABELS.dylan
  return value
}

function normalizePhaseNames(phases: PhaseData[]) {
  return phases.map(phase => ({
    ...phase,
    nameKr: normalizeCharacterDisplayName(phase.nameKr),
    nameEn: normalizeCharacterDisplayName(phase.nameEn),
  }))
}

function useDrag(getInitial: () => { x: number; y: number }) {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const offset = useRef({ x: 0, y: 0 })
  const inited = useRef(false)

  useEffect(() => {
    if (!inited.current) {
      setPos(getInitial())
      inited.current = true
    }
  }, [getInitial])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, a, audio')) return
    setDragging(true)
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
  }, [pos])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y })
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  return { pos, onMouseDown, dragging }
}

function DragWindow({ id, title, children, getInitialPos, z, onFocus, className = '' }: {
  id: string
  title: string
  children: React.ReactNode
  getInitialPos: () => { x: number; y: number }
  z: number
  onFocus: (id: string) => void
  className?: string
}) {
  const { pos, onMouseDown, dragging } = useDrag(getInitialPos)

  return (
    <div
      className={`sf-window ${className} ${dragging ? 'sf-window-dragging' : ''}`}
      style={{ position: 'absolute', left: pos.x, top: pos.y, zIndex: z }}
      onMouseDown={(e) => { onFocus(id); onMouseDown(e) }}
    >
      <div className="sf-window-header" style={{ cursor: 'grab' }}>
        <div className="sf-window-dots">
          <span className="sf-dot sf-dot-red" />
          <span className="sf-dot sf-dot-yellow" />
          <span className="sf-dot sf-dot-green" />
        </div>
        <span className="sf-window-title">{title}</span>
      </div>
      <div className="sf-window-body">{children}</div>
    </div>
  )
}

function CharacterStarfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()

    const stars = Array.from({ length: 150 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.4 + 0.35,
      speed: Math.random() * 0.13 + 0.02,
      flicker: Math.random() * Math.PI * 2,
      hot: Math.random() > 0.9,
    }))

    let raf: number
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      stars.forEach(s => {
        s.flicker += 0.02
        const a = (s.hot ? 0.5 : 0.25) + Math.sin(s.flicker) * 0.16
        ctx.fillStyle = s.hot ? `rgba(255,107,157,${a})` : `rgba(0,255,204,${a})`
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
        s.y += s.speed
        if (s.y > canvas.height) {
          s.y = 0
          s.x = Math.random() * canvas.width
        }
      })
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 z-[0] pointer-events-none" style={{ opacity: 0.62 }} />
}

function VoicePlayer({ src, color }: { src: string; color: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  const toggle = () => {
    if (!audioRef.current) return
    if (isPlaying) audioRef.current.pause()
    else audioRef.current.play()
    setIsPlaying(!isPlaying)
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTimeUpdate = () => { if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100) }
    const onEnded = () => { setIsPlaying(false); setProgress(0) }
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
    }
  }, [])

  return (
    <div className="sf-character-voice">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button onClick={toggle} className="sf-character-icon-btn" style={{ color, borderColor: `${color}70` }}>
        {isPlaying ? 'II' : '▶'}
      </button>
      <div className="sf-character-meter">
        <span style={{ width: `${progress}%`, background: color }} />
      </div>
      <span className="sf-label-sm">VOICE</span>
    </div>
  )
}

export default function CharacterPage() {
  const router = useRouter()
  const [character, setCharacter] = useState<'manon' | 'dylan'>('manon')
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [manonPhases, setManonPhases] = useState<PhaseData[]>(defaultManon)
  const [dylanPhases, setDylanPhases] = useState<PhaseData[]>(defaultDylan)
  const [showDetail, setShowDetail] = useState(false)
  const [routeDirection, setRouteDirection] = useState<RouteDirection>('next')
  const [routeReady, setRouteReady] = useState(false)
  const [routeLeaving, setRouteLeaving] = useState(false)
  const [windowsReady, setWindowsReady] = useState(false)
  const [winOrder, setWinOrder] = useState<Record<string, number>>({
    portrait: 60,
    identity: 67,
    details: 68,
    switcher: 59,
    phases: 62,
    notes: 66,
  })

  const bringToFront = useCallback((id: string) => {
    setWinOrder(prev => ({ ...prev, [id]: Math.max(...Object.values(prev)) + 1 }))
  }, [])

  useEffect(() => {
    const stored = sessionStorage?.getItem(ROUTE_DIRECTION_KEY)
    if (stored === 'prev' || stored === 'next') setRouteDirection(stored)
    sessionStorage?.removeItem(ROUTE_DIRECTION_KEY)
    const t1 = requestAnimationFrame(() => setRouteReady(true))
    const t2 = setTimeout(() => setWindowsReady(true), 720)
    return () => {
      cancelAnimationFrame(t1)
      clearTimeout(t2)
    }
  }, [])

  useEffect(() => {
    fetch('/api/characters')
      .then(res => res.json())
      .then(data => {
        if (data?.manon?.length) setManonPhases(normalizePhaseNames(data.manon))
        if (data?.dylan?.length) setDylanPhases(normalizePhaseNames(data.dylan))
      })
      .catch(() => {})
  }, [])

  const isManon = character === 'manon'
  const phases = isManon ? manonPhases : dylanPhases
  const data = phases[phaseIndex]
  const accentColor = isManon ? MANON_COLOR : DYLAN_COLOR

  const navigateInterface = (href: string, direction: RouteDirection) => {
    sessionStorage?.setItem(ROUTE_DIRECTION_KEY, direction)
    if (href === '/') sessionStorage?.setItem(SKIP_HOME_BOOT_KEY, 'true')
    setRouteDirection(direction)
    setRouteLeaving(true)
    setTimeout(() => router.push(href), 520)
  }

  const handleBack = () => {
    navigateInterface('/', 'prev')
  }

  const handleCharacterChange = (char: 'manon' | 'dylan') => {
    setCharacter(char)
    setPhaseIndex(0)
    setShowDetail(false)
  }

  if (!data) return <div className="fixed inset-0 bg-[#050a0d]" />

  return (
    <div className="fixed inset-0 z-[60] bg-[#050a0d] overflow-hidden text-white">
      <SunjaeChrome
        interfaceLabel="CHARACTER_INTERFACE"
        previousHref="/"
        nextHref="/record"
        onNavigate={navigateInterface}
        onAccess={handleBack}
      />

      <div
        className={`absolute inset-0 sf-route-slide sf-route-${routeDirection} ${routeReady ? 'sf-route-slide-ready' : ''} ${routeLeaving ? 'sf-route-slide-leaving' : ''}`}
      >
        <div className={`absolute inset-0 ${windowsReady ? 'sf-windows-ready' : ''}`}>
        <DragWindow id="portrait" title={`SUBJECT_RENDER // ${data.nameEn}`}
          getInitialPos={() => ({ x: 100, y: 156 })}
          z={winOrder.portrait} onFocus={bringToFront} className="sf-win-anim sf-win-anim-4">
          <div className="sf-character-portrait-wrap">
            <div className="sf-character-portrait">
              {data.profileImage ? (
                <img src={data.profileImage} alt={data.nameKr} draggable={false} />
              ) : (
                <div className="sf-character-symbol" style={{ color: accentColor }}>{data.symbol}</div>
              )}
            </div>
            {data.voiceFile && <VoicePlayer src={data.voiceFile} color={accentColor} />}
          </div>
        </DragWindow>

        <DragWindow id="switcher" title="CHARACTER_SELECT"
          getInitialPos={() => ({ x: 27, y: 44 })}
          z={winOrder.switcher} onFocus={bringToFront} className="sf-win-anim sf-win-anim-6">
          <div className="sf-character-switcher">
            {(['manon', 'dylan'] as const).map((char, i) => (
              <button
                key={char}
                onClick={() => handleCharacterChange(char)}
                className={character === char ? 'is-active' : ''}
              >
                <span>0{i + 1}</span>
                <strong>{CHARACTER_LABELS[char]}</strong>
              </button>
            ))}
          </div>
        </DragWindow>

        <DragWindow id="identity" title="IDENTITY_RECORD"
          getInitialPos={() => ({ x: 444, y: 130 })}
          z={winOrder.identity} onFocus={bringToFront} className="sf-win-anim sf-win-anim-5">
          <div className="sf-character-record">
            <span className="sf-label-sm">ACTIVE SUBJECT</span>
            <h1 style={{ color: accentColor }}>{data.nameKr}</h1>
            <div className="sf-character-subline">
              <span>{data.nameEn}</span>
              <span>{data.label}</span>
            </div>
            <p className="sf-character-quote">{data.quote}</p>
            <div className="sf-line" />
            <p className="sf-character-mainquote">{data.mainQuote}</p>
            <button onClick={() => setShowDetail(v => !v)} className="sf-character-command">
              {showDetail ? '[ HIDE DETAILS ]' : '[ EXPAND DETAILS ]'}
            </button>
          </div>
        </DragWindow>

        <DragWindow id="details" title="BIO_SIGNAL"
          getInitialPos={() => ({ x: 655, y: 437 })}
          z={winOrder.details} onFocus={bringToFront} className="sf-win-anim sf-win-anim-3">
          <div className="sf-character-details">
            <div className="sf-character-vitals">
              {[
                ['AGE', data.age],
                ['HEIGHT', data.height],
                ['WEIGHT', data.weight],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>

            {showDetail ? (
              <div className="sf-character-scroll">
                {data.stats && data.stats.length > 0 && (
                  <div className="sf-character-block">
                    <span className="sf-label-sm">STATS</span>
                    {data.stats.map(stat => (
                      <div key={stat.label} className="sf-character-stat">
                        <span>{stat.label}</span>
                        <div><i style={{ width: `${stat.value * 10}%`, background: accentColor }} /></div>
                        <b>{stat.value}</b>
                      </div>
                    ))}
                  </div>
                )}

                {data.personality.length > 0 && (
                  <div className="sf-character-block">
                    <span className="sf-label-sm">PERSONALITY</span>
                    <div className="sf-character-tags">
                      {data.personality.map(tag => <span key={tag} style={{ borderColor: `${accentColor}55`, color: accentColor }}>{tag}</span>)}
                    </div>
                  </div>
                )}

                {data.abilityName && (
                  <div className="sf-character-block">
                    <span className="sf-label-sm">ABILITY</span>
                    <strong className="sf-character-ability" style={{ color: accentColor }}>{data.abilityName}</strong>
                    {data.abilityDesc && <p>{data.abilityDesc}</p>}
                  </div>
                )}
              </div>
            ) : (
              <div className="sf-character-idle">
                <span className="sf-label-sm">DETAIL_BUFFER</span>
                <p>SELECT EXPAND DETAILS FROM IDENTITY_RECORD</p>
              </div>
            )}
          </div>
        </DragWindow>

        <DragWindow id="phases" title="PHASE_ARCHIVE"
          getInitialPos={() => ({ x: 60, y: 644 })}
          z={winOrder.phases} onFocus={bringToFront} className="sf-win-anim sf-win-anim-1">
          <div className="sf-character-phases">
            {phases.map((phase, i) => (
              <button
                key={phase.id}
                onClick={() => { setPhaseIndex(i); setShowDetail(false) }}
                className={phaseIndex === i ? 'is-active' : ''}
                style={{ color: phaseIndex === i ? accentColor : undefined }}
              >
                <span>{String(i + 1).padStart(2, '0')}</span>
                <strong>{phase.label}</strong>
              </button>
            ))}
          </div>
        </DragWindow>

        <DragWindow id="notes" title="WATERMARK"
          getInitialPos={() => ({ x: 820, y: 88 })}
          z={winOrder.notes} onFocus={bringToFront} className="sf-win-anim sf-win-anim-7">
          <div className="sf-character-watermark" style={{ color: `${accentColor}22` }}>
            {data.name.replace(/[\[\]]/g, '').trim() || data.nameEn}
          </div>
        </DragWindow>
        </div>
      </div>
    </div>
  )
}
