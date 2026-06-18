'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { ROUTE_DIRECTION_KEY, SKIP_HOME_BOOT_KEY, SunjaeChrome, type RouteDirection } from '@/components/SunjaeChrome'

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

interface SfInterviewPageProps {
  dataKey: 'foreword' | 'rebuttal'
  character: string
  interfaceLabel: string
  accent: string
  subjectCode: string
}

export default function SfInterviewPage({
  dataKey,
  character,
  interfaceLabel,
  accent,
  subjectCode,
}: SfInterviewPageProps) {
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
      .then(response => response.json())
      .then(payload => {
        if (payload?.[dataKey]) setData(payload[dataKey])
      })
      .catch(() => {})
  }, [dataKey])

  useEffect(() => () => {
    if (typingRef.current) clearInterval(typingRef.current)
  }, [])

  const handlePartClick = (part: BodyPart) => {
    if (typingRef.current) clearInterval(typingRef.current)
    setActivePart(part)
    setDisplayedText('')
    setIsTyping(true)

    let index = 0
    typingRef.current = setInterval(() => {
      if (index < part.dialogue.length) {
        setDisplayedText(part.dialogue.slice(0, index + 1))
        index += 1
      } else {
        if (typingRef.current) clearInterval(typingRef.current)
        setIsTyping(false)
      }
    }, 30)
  }

  const skipTyping = () => {
    if (!isTyping || !activePart) return
    if (typingRef.current) clearInterval(typingRef.current)
    setDisplayedText(activePart.dialogue)
    setIsTyping(false)
  }

  const navigateInterface = (href: string, direction: RouteDirection) => {
    sessionStorage?.setItem(ROUTE_DIRECTION_KEY, direction)
    if (href === '/') sessionStorage?.setItem(SKIP_HOME_BOOT_KEY, 'true')
    setRouteDirection(direction)
    setRouteLeaving(true)
    setTimeout(() => router.push(href), 520)
  }

  const style = { '--interview-accent': accent } as CSSProperties
  const parts = data?.parts || []
  const routeClass = 'absolute inset-0 sf-route-slide sf-route-' + routeDirection
    + (routeReady ? ' sf-route-slide-ready' : '')
    + (routeLeaving ? ' sf-route-slide-leaving' : '')

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-[#050a0d] text-white" style={style}>
      <SunjaeChrome
        interfaceLabel={interfaceLabel}
        previousHref={null}
        nextHref={null}
        onNavigate={navigateInterface}
        onAccess={() => navigateInterface('/', 'prev')}
      />

      <div className={routeClass}>
        <main className={'sf-interview-layout' + (mounted ? ' is-mounted' : '')}>
          <section className="sf-window sf-interview-window sf-interview-subject sf-interview-pop-1">
            <div className="sf-window-header">
              <div className="sf-window-dots">
                <span className="sf-dot sf-dot-red" />
                <span className="sf-dot sf-dot-yellow" />
                <span className="sf-dot sf-dot-green" />
              </div>
              <span className="sf-window-title">SUBJECT_SCAN // {subjectCode}</span>
              <span className="sf-interview-live">● LIVE</span>
            </div>

            <div className="sf-interview-stage">
              <span className="sf-interview-corner sf-interview-corner-tl" />
              <span className="sf-interview-corner sf-interview-corner-tr" />
              <span className="sf-interview-corner sf-interview-corner-bl" />
              <span className="sf-interview-corner sf-interview-corner-br" />
              <span className="sf-interview-sweep" />

              {data?.characterImage ? (
                <div className="sf-interview-character-frame">
                  <img src={data.characterImage} alt={character} draggable={false} />
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={character + ' scan targets'}>
                    {parts.map(part => {
                      const points = part.points && part.points.length >= 3 ? part.points : null
                      if (!points) return null
                      const active = activePart?.id === part.id
                      const hovered = hoveredPart === part.id
                      return (
                        <polygon
                          key={part.id}
                          points={points.map(point => point[0] + ',' + point[1]).join(' ')}
                          className={(active ? 'is-active' : '') + (hovered ? ' is-hovered' : '')}
                          onClick={() => handlePartClick(part)}
                          onMouseEnter={() => setHoveredPart(part.id)}
                          onMouseLeave={() => setHoveredPart(null)}
                        />
                      )
                    })}
                  </svg>
                </div>
              ) : (
                <div className="sf-interview-no-signal">
                  <span>NO VISUAL SIGNAL</span>
                  <small>SUBJECT IMAGE UNAVAILABLE</small>
                </div>
              )}
            </div>

            <div className="sf-interview-telemetry">
              <span>SUBJECT: {character}</span>
              <span>NODES: {String(parts.length).padStart(2, '0')}</span>
              <span>LINK: STABLE</span>
            </div>
          </section>

          <section className="sf-window sf-interview-window sf-interview-targets sf-interview-pop-2">
            <div className="sf-window-header">
              <div className="sf-window-dots">
                <span className="sf-dot sf-dot-red" />
                <span className="sf-dot sf-dot-yellow" />
                <span className="sf-dot sf-dot-green" />
              </div>
              <span className="sf-window-title">TARGET_INDEX</span>
              <span className="sf-interview-counter">{String(parts.length).padStart(2, '0')} NODES</span>
            </div>

            <div className="sf-interview-target-list">
              {parts.length > 0 ? parts.map((part, index) => (
                <button
                  key={part.id}
                  className={activePart?.id === part.id ? 'is-active' : ''}
                  onClick={() => handlePartClick(part)}
                  onMouseEnter={() => setHoveredPart(part.id)}
                  onMouseLeave={() => setHoveredPart(null)}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{part.label || 'NODE_' + (index + 1)}</strong>
                  <i>{activePart?.id === part.id ? 'LOCKED' : 'READY'}</i>
                </button>
              )) : (
                <div className="sf-interview-target-empty">NO TARGET DATA</div>
              )}
            </div>
          </section>

          <section className="sf-window sf-interview-window sf-interview-dialogue sf-interview-pop-3" onClick={skipTyping}>
            <div className="sf-window-header">
              <div className="sf-window-dots">
                <span className="sf-dot sf-dot-red" />
                <span className="sf-dot sf-dot-yellow" />
                <span className="sf-dot sf-dot-green" />
              </div>
              <span className="sf-window-title">DIALOGUE_LOG // {activePart?.label || 'STANDBY'}</span>
              <span className="sf-interview-counter">{isTyping ? 'RECEIVING' : activePart ? 'COMPLETE' : 'IDLE'}</span>
            </div>

            <div className="sf-interview-dialogue-body">
              <div className="sf-interview-speaker">
                <span>{subjectCode}</span>
                <strong>{character}</strong>
              </div>

              <div className="sf-interview-copy">
                {activePart ? (
                  <p>
                    {displayedText}
                    {isTyping && <span className="sf-interview-caret" />}
                  </p>
                ) : (
                  <p className="is-idle">AWAITING TARGET SELECTION...</p>
                )}
              </div>

              <div className="sf-interview-dialogue-footer">
                <span>CHANNEL 04</span>
                <span>{activePart ? 'NODE ' + activePart.label : 'NO ACTIVE NODE'}</span>
                <span>{isTyping ? 'STREAMING' : 'BUFFER READY'}</span>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
