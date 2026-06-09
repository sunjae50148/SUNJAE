'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ROUTE_DIRECTION_KEY, SKIP_HOME_BOOT_KEY, SunjaeChrome, type RouteDirection } from '@/components/SunjaeChrome'
import { BalletRibbon } from '@/components/StageMotifs'

interface BodyPart {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  dialogue: string
  points?: [number, number][]
}

interface GameSection {
  characterImage?: string
  parts: BodyPart[]
}

const ACCENT = '#D9809A'
const CHARACTER = 'Manon'

export default function ForewordPage() {
  const router = useRouter()
  const [data, setData] = useState<GameSection | null>(null)
  const [mounted, setMounted] = useState(false)
  const [activePart, setActivePart] = useState<BodyPart | null>(null)
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [hoveredPart, setHoveredPart] = useState<string | null>(null)
  const [routeDirection, setRouteDirection] = useState<RouteDirection>('next')
  const [routeReady, setRouteReady] = useState(false)
  const [routeLeaving, setRouteLeaving] = useState(false)
  const typingRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const stored = sessionStorage?.getItem(ROUTE_DIRECTION_KEY)
    if (stored === 'prev' || stored === 'next') setRouteDirection(stored)
    sessionStorage?.removeItem(ROUTE_DIRECTION_KEY)
    const raf = requestAnimationFrame(() => setRouteReady(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    fetch('/api/game-dialogues')
      .then(r => r.json())
      .then(d => { if (d?.foreword) setData(d.foreword) })
      .catch(() => {})
  }, [])

  const handlePartClick = (part: BodyPart) => {
    if (typingRef.current) clearInterval(typingRef.current)
    setActivePart(part)
    setDisplayedText('')
    setIsTyping(true)

    let i = 0
    typingRef.current = setInterval(() => {
      if (i < part.dialogue.length) {
        setDisplayedText(part.dialogue.slice(0, i + 1))
        i++
      } else {
        if (typingRef.current) clearInterval(typingRef.current)
        setIsTyping(false)
      }
    }, 30)
  }

  const skipTyping = () => {
    if (isTyping && activePart) {
      if (typingRef.current) clearInterval(typingRef.current)
      setDisplayedText(activePart.dialogue)
      setIsTyping(false)
    }
  }

  useEffect(() => {
    return () => { if (typingRef.current) clearInterval(typingRef.current) }
  }, [])

  const navigateInterface = (href: string, direction: RouteDirection) => {
    sessionStorage?.setItem(ROUTE_DIRECTION_KEY, direction)
    if (href === '/') sessionStorage?.setItem(SKIP_HOME_BOOT_KEY, 'true')
    setRouteDirection(direction)
    setRouteLeaving(true)
    setTimeout(() => router.push(href), 520)
  }

  return (
    <div className="fixed inset-0 z-[60] bg-[#050a0d] overflow-hidden text-white">
      <SunjaeChrome
        interfaceLabel="MANON_INTERVIEW"
        previousHref={null}
        nextHref={null}
        onNavigate={navigateInterface}
        onAccess={() => navigateInterface('/', 'prev')}
      />

      <div className={`absolute inset-0 sf-route-slide sf-route-${routeDirection} ${routeReady ? 'sf-route-slide-ready' : ''} ${routeLeaving ? 'sf-route-slide-leaving' : ''}`}>

      {/* Subtle ribbon motif top corner */}
      <div className="fixed pointer-events-none z-[2]" style={{ top: '8%', right: '10%' }}>
        <BalletRibbon opacity={0.12} size={1.3} />
      </div>

      {/* Spotlight from top */}
      <div className="absolute pointer-events-none" style={{
        top: 0, left: '20%', right: '20%', height: '70%',
        background: 'radial-gradient(ellipse 60% 80% at 50% 0%, rgba(217,128,154,0.06) 0%, transparent 70%)',
      }} />

      {/* Character stage */}
      <div className={`absolute inset-0 flex items-center justify-center ${mounted ? 'animate-fade-slide-up stagger-2' : 'opacity-0'}`}
        style={{ paddingTop: 'clamp(60px, 8vw, 110px)', paddingBottom: 'clamp(220px, 28vh, 320px)', paddingLeft: '8%', paddingRight: '8%' }}>
        {data?.characterImage ? (
          <div className="relative h-full flex items-center justify-center">
            <img
              src={data.characterImage}
              alt={CHARACTER}
              className="max-h-full max-w-full object-contain"
              style={{ filter: 'drop-shadow(0 0 30px rgba(217,128,154,0.08))' }}
            />
            {/* Click polygons */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {data.parts.map((part) => {
                const pts = part.points && part.points.length >= 3 ? part.points : null
                if (!pts) return null
                const isActive = activePart?.id === part.id
                const isHover = hoveredPart === part.id
                return (
                  <polygon key={part.id}
                    points={pts.map(p => `${p[0]},${p[1]}`).join(' ')}
                    fill={isActive ? 'rgba(217,128,154,0.12)' : isHover ? 'rgba(217,128,154,0.06)' : 'transparent'}
                    stroke={isActive ? 'rgba(217,128,154,0.5)' : isHover ? 'rgba(217,128,154,0.25)' : 'transparent'}
                    strokeWidth="0.2"
                    style={{ cursor: 'pointer', transition: 'fill 0.3s, stroke 0.3s', filter: isActive || isHover ? 'url(#sketchy)' : undefined }}
                    onClick={() => handlePartClick(part)}
                    onMouseEnter={() => setHoveredPart(part.id)}
                    onMouseLeave={() => setHoveredPart(null)}
                  />
                )
              })}
            </svg>
          </div>
        ) : (
          <div className="text-center">
            <p className="heading-condensed text-white/30" style={{ fontStyle: 'italic', fontSize: 'clamp(1rem, 1.5vw, 1.4rem)' }}>
              No character image set.
            </p>
            <p className="text-white/15 text-xs mt-2">Admin에서 캐릭터 이미지와 부위를 설정하세요.</p>
          </div>
        )}
      </div>

      {/* ═══ Visual-novel style dialogue box (bottom) ═══ */}
      <div
        className={`fixed left-0 right-0 z-[15] cursor-pointer ${mounted ? 'animate-fade-slide-up stagger-3' : 'opacity-0'}`}
        style={{ bottom: 'clamp(54px, 7vh, 82px)', padding: '0 clamp(64px, 9vw, 100px)' }}
        onClick={skipTyping}
      >
        <div className="relative">
          {/* Name plate */}
          {activePart && (
            <div
              className="inline-flex items-baseline gap-3 px-4 py-1.5 mb-[-1px] sketch-jitter-line relative z-[2]"
              style={{
                background: '#000',
                border: '1px solid rgba(217,128,154,0.4)',
                borderBottom: 'none',
                filter: 'url(#sketchy)',
              }}
            >
              <span className="heading-display" style={{
                color: ACCENT, fontSize: '0.95rem', fontStyle: 'italic',
                letterSpacing: '0.04em',
              }}>
                {CHARACTER}
              </span>
              <span className="label-caps text-white/30" style={{ fontSize: '0.45rem', letterSpacing: '0.25em' }}>
                ⟢ {activePart.label}
              </span>
            </div>
          )}

          {/* Dialogue box */}
          <div
            className="relative sketch-jitter-line"
            style={{
              minHeight: 'clamp(140px, 20vh, 200px)',
              background: 'rgba(0,0,0,0.85)',
              border: '1px solid rgba(217,128,154,0.35)',
              backdropFilter: 'blur(3px)',
              filter: 'url(#sketchy)',
              padding: 'clamp(20px, 2.5vw, 32px) clamp(28px, 3.5vw, 48px)',
            }}
          >
            {/* Inner thin border */}
            <span className="absolute inset-1 pointer-events-none" style={{ border: '1px solid rgba(217,128,154,0.1)' }} />

            {activePart ? (
              <div className="relative">
                <p className="text-editorial text-white/85" style={{
                  fontSize: 'clamp(0.95rem, 1.25vw, 1.15rem)',
                  lineHeight: 1.85, letterSpacing: '-0.01em',
                  textAlign: 'left',
                  whiteSpace: 'pre-wrap',
                }}>
                  {displayedText}
                  {isTyping && (
                    <span className="inline-block w-[2px] h-[1em] ml-0.5 align-text-bottom animate-pulse" style={{ background: ACCENT }} />
                  )}
                </p>
                {!isTyping && displayedText && (
                  <div className="absolute bottom-0 right-0 flex items-center gap-2 animate-pulse">
                    <span className="label-caps text-white/30" style={{ fontSize: '0.72rem', letterSpacing: '0.25em' }}>NEXT</span>
                    <span style={{ color: ACCENT, fontSize: '0.85rem' }}>▼</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full" style={{ minHeight: 'clamp(100px, 16vh, 160px)' }}>
                <p className="heading-condensed text-white/35" style={{ fontStyle: 'italic', fontSize: 'clamp(0.92rem, 1.15vw, 1.05rem)', textAlign: 'center' }}>
                  {data?.parts && data.parts.length > 0
                    ? '— Click on the character to begin —'
                    : '— No dialogues configured —'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      </div>
    </div>
  )
}
