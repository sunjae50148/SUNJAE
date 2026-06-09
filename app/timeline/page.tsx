'use client'

import { useState, useEffect, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { ROUTE_DIRECTION_KEY, SKIP_HOME_BOOT_KEY, SunjaeChrome, type RouteDirection } from '@/components/SunjaeChrome'
import type { TimelineEvent, TimelineData } from '@/app/api/timeline/route'

const MANON_COLOR = '#D9809A'
const DYLAN_COLOR = '#C8C8C8'
const BOTH_COLOR = '#B8A0CC'

const TYPE_LABELS: Record<string, string> = {
  event: 'Event', milestone: 'Milestone', memory: 'Memory', turning: 'Turning Point',
}

function getAccent(ev: TimelineEvent) {
  return { manon: MANON_COLOR, dylan: DYLAN_COLOR, both: BOTH_COLOR }[ev.character || 'both'] || BOTH_COLOR
}

const MAX_TIMELINE_NODES = 30
const DEFAULT_TIMELINE_PREVIEW_NODES = 5
const PLANET_PALETTE = ['#00FFCC', '#D9809A', '#8BD8FF', '#B8A0CC', '#78E0C6', '#C8C8C8']
const PLANET_SIZE_PATTERN = [
  74, 58, 68, 52, 80, 62, 72, 56, 66, 76,
  54, 70, 60, 82, 64, 50, 78, 59, 73, 55,
  69, 61, 75, 57, 67, 79, 53, 71, 63, 77,
]

type RoutePlanet = {
  x: number
  y: number
  size: number
  color: string
  sprite: number
}

type RoutePoint = Pick<RoutePlanet, 'x' | 'y'>

const JITTERS: [number, number][] = [
  [4, 2], [-5, -3], [3, 5], [-4, -2], [6, 3],
  [-3, -5], [5, -2], [-5, 4], [2, -4], [-2, 5],
  [4, -5], [-3, 3], [5, 4], [-6, -3], [3, -4],
  [-3, 5], [6, -4], [-4, -4], [3, 3], [-2, -3],
]

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function getPlanetSpriteSrc(sprite: number) {
  return `/assets/timeline/planet-${String(sprite % MAX_TIMELINE_NODES).padStart(2, '0')}.png`
}

function getPlanetSize(index: number, count: number) {
  const size = PLANET_SIZE_PATTERN[index % PLANET_SIZE_PATTERN.length]
  if (count > 20) return Math.round(size * 0.7)
  if (count > 12) return Math.round(size * 0.84)
  return size
}

function getRoutePlanets(count: number): RoutePlanet[] {
  const safeCount = clamp(count, 1, MAX_TIMELINE_NODES)
  const columns = safeCount <= 5 ? safeCount : safeCount <= 12 ? 6 : safeCount <= 20 ? 8 : 10
  const rows = Math.ceil(safeCount / columns)

  return Array.from({ length: safeCount }, (_, i) => {
    const row = Math.floor(i / columns)
    const col = i % columns
    const goRight = row % 2 === 0
    const colsInRow = row === rows - 1 ? safeCount - row * columns : columns
    const progress = colsInRow <= 1 ? 0.5 : goRight ? col / (colsInRow - 1) : (colsInRow - 1 - col) / (colsInRow - 1)
    const rowProgress = rows <= 1 ? 0.5 : row / (rows - 1)
    const [jx, jy] = JITTERS[i % JITTERS.length]

    return {
      x: clamp(8 + progress * 84 + jx * 0.5, 6, 94),
      y: clamp((rows === 1 ? 52 : 20 + rowProgress * 60) + Math.sin(progress * Math.PI * 1.35 + row * 0.7) * 6 + jy * 0.5, 15, 84),
      size: getPlanetSize(i, safeCount),
      color: PLANET_PALETTE[i % PLANET_PALETTE.length],
      sprite: i % MAX_TIMELINE_NODES,
    }
  })
}

function buildSingleOrbitPath(point: RoutePoint, radius = 9) {
  return `M ${point.x - radius} ${point.y} C ${point.x - radius} ${point.y - radius * 0.9}, ${point.x + radius} ${point.y - radius * 0.9}, ${point.x + radius} ${point.y} C ${point.x + radius} ${point.y + radius * 0.9}, ${point.x - radius} ${point.y + radius * 0.9}, ${point.x - radius} ${point.y} Z`
}

function buildCatmullRomPath(points: RoutePoint[], closed = false) {
  if (points.length === 0) return ''
  if (points.length === 1) return buildSingleOrbitPath(points[0])

  const total = points.length
  const segmentCount = closed ? total : total - 1
  let path = `M ${points[0].x} ${points[0].y}`

  for (let i = 0; i < segmentCount; i += 1) {
    const p0 = closed ? points[(i - 1 + total) % total] : points[Math.max(i - 1, 0)]
    const p1 = points[i]
    const p2 = points[(i + 1) % total]
    const p3 = closed ? points[(i + 2) % total] : points[Math.min(i + 2, total - 1)]
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6

    path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`
  }

  return path
}

function buildRoutePath(planets: RoutePlanet[]) {
  if (planets.length === 1) {
    const p = planets[0]
    return `M ${p.x - 9} ${p.y} C ${p.x - 9} ${p.y - 8}, ${p.x + 9} ${p.y - 8}, ${p.x + 9} ${p.y} C ${p.x + 9} ${p.y + 8}, ${p.x - 9} ${p.y + 8}, ${p.x - 9} ${p.y} Z`
  }

  return buildCatmullRomPath(planets)
}

function buildShipRoutePath(planets: RoutePlanet[]) {
  if (planets.length <= 1) return buildRoutePath(planets)

  const first = planets[0]
  const last = planets[planets.length - 1]
  const minY = Math.min(...planets.map(planet => planet.y))
  const maxY = Math.max(...planets.map(planet => planet.y))
  const returnY = clamp(maxY < 72 ? maxY + 18 : minY - 18, 8, 92)
  const returnPoints: RoutePoint[] = [
    { x: clamp(last.x - 2, 5, 95), y: returnY },
    { x: 50, y: clamp(returnY + (returnY > 50 ? 8 : -8), 6, 94) },
    { x: clamp(first.x + 2, 5, 95), y: returnY },
  ]

  return buildCatmullRomPath([...planets, ...returnPoints], true)
}

// Decorative background stars
const BG_STARS = Array.from({ length: 60 }, (_, i) => ({
  x: ((i * 137.508 + 13) % 100),
  y: ((i * 97.432 + 7) % 100),
  r: i % 7 === 0 ? 0.7 : i % 3 === 0 ? 0.4 : 0.2,
}))

export default function TimelinePage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [selectedNodeIndex, setSelectedNodeIndex] = useState(0)
  const [routeDirection, setRouteDirection] = useState<RouteDirection>('next')
  const [routeReady, setRouteReady] = useState(false)
  const [routeLeaving, setRouteLeaving] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const stored = sessionStorage?.getItem(ROUTE_DIRECTION_KEY)
    if (stored === 'prev' || stored === 'next') setRouteDirection(stored)
    sessionStorage?.removeItem(ROUTE_DIRECTION_KEY)
    const raf = requestAnimationFrame(() => setRouteReady(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    fetch('/api/timeline')
      .then(r => r.json())
      .then((d: TimelineData) => {
        if (d?.events) {
          const sorted = [...d.events].sort((a, b) => a.order - b.order)
          setEvents(sorted)
          if (sorted.length > 0) setActiveId(sorted[0].id)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const visibleEvents = events.slice(0, MAX_TIMELINE_NODES)
  const nodeCount = visibleEvents.length > 0 ? visibleEvents.length : DEFAULT_TIMELINE_PREVIEW_NODES
  const routePlanets = getRoutePlanets(nodeCount)
  const routeNodes = routePlanets.map((planet, index) => ({ planet, event: visibleEvents[index] || null }))
  const selectedNode = routeNodes[selectedNodeIndex] || routeNodes[0]
  const active = selectedNode?.event || null
  const routePath = buildRoutePath(routePlanets)
  const shipRoutePath = buildShipRoutePath(routePlanets)

  useEffect(() => {
    setSelectedNodeIndex(prev => Math.min(prev, nodeCount - 1))
  }, [nodeCount])

  const selectNode = (index: number) => {
    const node = routeNodes[index]
    setSelectedNodeIndex(index)
    if (node?.event) setActiveId(node.event.id)
  }

  const stepNode = (delta: number) => {
    const nextIndex = Math.max(0, Math.min(routeNodes.length - 1, selectedNodeIndex + delta))
    selectNode(nextIndex)
  }

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
        interfaceLabel="TIMELINE_INTERFACE"
        previousHref="/record"
        nextHref="/au"
        onNavigate={navigateInterface}
        onAccess={() => navigateInterface('/', 'prev')}
      />

      <div className={`absolute inset-0 sf-route-slide sf-route-${routeDirection} ${routeReady ? 'sf-route-slide-ready' : ''} ${routeLeaving ? 'sf-route-slide-leaving' : ''}`}>

      {/* Sketchy animation (same as main page) */}
      <style>{`
        @keyframes star-twinkle {
          0%, 100% { opacity: 0.03; }
          50% { opacity: 0.12; }
        }
      `}</style>

      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 border border-white/10 border-t-white/40 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="sf-timeline-stage">
          <div className="sf-window sf-timeline-map">
            <div className="sf-window-header sf-timeline-map-header">
              <div className="sf-window-dots">
                <span className="sf-dot sf-dot-red" />
                <span className="sf-dot sf-dot-yellow" />
                <span className="sf-dot sf-dot-green" />
              </div>
              <span className="sf-window-title">ORBITAL_ROUTE_MAP</span>
              <span className="sf-timeline-signal">VESSEL: ACTIVE</span>
            </div>
            <div className="sf-timeline-map-body">
              <svg className="sf-timeline-route-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                {BG_STARS.map((star, index) => (
                  <circle
                    key={`bg${index}`}
                    cx={star.x}
                    cy={star.y}
                    r={star.r * 0.35}
                    fill="rgba(0,255,204,0.38)"
                    opacity={0.12 + (index % 5) * 0.025}
                    style={index % 9 === 0 ? { animation: `star-twinkle ${3 + index % 4}s ease-in-out ${(index % 7) * 0.4}s infinite` } : undefined}
                  />
                ))}
                <path
                  id="timeline-route-path"
                  d={routePath}
                  className="sf-timeline-route-line"
                  pathLength="100"
                />
                <path
                  d={routePath}
                  className="sf-timeline-route-glow"
                  pathLength="100"
                />
              </svg>

              <svg className="sf-timeline-ship-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path
                  id="timeline-ship-route-path"
                  d={shipRoutePath}
                  className="sf-timeline-ship-path"
                  pathLength="100"
                />
                <g className="sf-timeline-ship">
                  <animateMotion dur="18s" repeatCount="indefinite" rotate="auto">
                    <mpath href="#timeline-ship-route-path" />
                  </animateMotion>
                  <g className="sf-timeline-ship-pixel">
                    <image
                      href="/assets/timeline/spaceship-bitmap.png"
                      x="-4.2"
                      y="-2"
                      width="8.4"
                      height="4"
                      preserveAspectRatio="xMidYMid meet"
                    />
                  </g>
                </g>
              </svg>

              {routeNodes.map(({ planet, event }, index) => {
                const isSelected = selectedNodeIndex === index
                const accent = event ? getAccent(event) : planet.color
                return (
                  <button
                    key={`planet-${index}`}
                    className={`sf-timeline-planet sf-timeline-planet-${index % 5} ${isSelected ? 'is-active' : ''} ${event ? '' : 'is-empty'}`}
                    style={{
                      left: `${planet.x}%`,
                      top: `${planet.y}%`,
                      width: planet.size,
                      height: planet.size,
                      '--planet-color': accent,
                    } as CSSProperties}
                    onClick={() => selectNode(index)}
                    onMouseEnter={() => event && setHoverId(event.id)}
                    onMouseLeave={() => setHoverId(null)}
                  >
                    <img
                      className="sf-timeline-planet-img"
                      src={getPlanetSpriteSrc(planet.sprite)}
                      alt=""
                      draggable={false}
                    />
                    <span className="sf-timeline-planet-index">{String(index + 1).padStart(2, '0')}</span>
                    {event && (isSelected || hoverId === event.id) && (
                      <span className="sf-timeline-planet-title">{event.title}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="sf-window sf-timeline-detail">
            <div className="sf-window-header">
              <div className="sf-window-dots">
                <span className="sf-dot sf-dot-red" />
                <span className="sf-dot sf-dot-yellow" />
                <span className="sf-dot sf-dot-green" />
              </div>
              <span className="sf-window-title">PLANET_LOG // {String(selectedNodeIndex + 1).padStart(2, '0')}</span>
            </div>

            <div className="sf-timeline-detail-body">
              <div className="sf-timeline-detail-planet" style={{ '--planet-color': selectedNode?.planet.color || '#00FFCC' } as CSSProperties}>
                <img
                  className="sf-timeline-detail-orb-img"
                  src={getPlanetSpriteSrc(selectedNode?.planet.sprite || 0)}
                  alt=""
                  draggable={false}
                />
              </div>

              {active ? (
                <>
                  <div className="sf-timeline-detail-meta">
                    <span style={{ color: getAccent(active) }}>{active.storyDate}</span>
                    {active.type && <span>{TYPE_LABELS[active.type] || active.type}</span>}
                  </div>

                  <h2>{active.title}</h2>

                  {active.character && (
                    <div className="sf-timeline-character" style={{ color: getAccent(active), borderColor: `${getAccent(active)}42` }}>
                      {active.character === 'both' ? 'Manon × Dylan' : active.character === 'manon' ? 'Manon' : 'Dylan'}
                    </div>
                  )}

                  <p className="sf-timeline-description">
                    {active.description || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>내용 없음</span>}
                  </p>
                </>
              ) : (
                <div className="sf-timeline-empty-log">
                  <span className="sf-label-bright">NO LOG ATTACHED</span>
                  <p>이 행성 노드에는 아직 타임라인 기록이 연결되지 않았습니다.</p>
                </div>
              )}
            </div>

            <div className="sf-timeline-detail-nav">
              <button onClick={() => stepNode(-1)} disabled={selectedNodeIndex === 0}>{'<'}</button>
              <span>{String(selectedNodeIndex + 1).padStart(2, '0')} / {String(routeNodes.length).padStart(2, '0')}</span>
              <button onClick={() => stepNode(1)} disabled={selectedNodeIndex === routeNodes.length - 1}>{'>'}</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
      <span className="block h-px w-16 sketch-jitter-line" style={{ background: 'rgba(255,255,255,0.15)', filter: 'url(#sketchy)' }} />
      <div className="text-center">
        <p className="heading-display text-white/40" style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2rem)', fontStyle: 'italic' }}>
          No events yet.
        </p>
        <p className="heading-condensed text-white/20 mt-3" style={{ fontStyle: 'italic', fontSize: '0.85rem' }}>
          Add timeline events from the admin panel.
        </p>
      </div>
      <span className="block h-px w-16 sketch-jitter-line" style={{ background: 'rgba(255,255,255,0.15)', filter: 'url(#sketchy)' }} />
    </div>
  )
}
