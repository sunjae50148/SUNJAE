'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import EdgeCurtain from '@/components/EdgeCurtain'
import SketchyFilter from '@/components/SketchyFilter'
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

// Zigzag constellation positions
const JITTERS: [number, number][] = [
  [4, 2], [-5, -3], [3, 5], [-4, -2], [6, 3],
  [-3, -5], [5, -2], [-5, 4], [2, -4], [-2, 5],
  [4, -5], [-3, 3], [5, 4], [-6, -3], [3, -4],
  [-3, 5], [6, -4], [-4, -4], [3, 3], [-2, -3],
]

function getPositions(n: number) {
  if (n === 0) return []
  if (n === 1) return [{ x: 35, y: 50 }]
  const COLS = n <= 3 ? n : n <= 6 ? 3 : n <= 12 ? 4 : 5
  const rows = Math.ceil(n / COLS)
  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / COLS)
    const col = i % COLS
    const goRight = row % 2 === 0
    const colsInRow = row === rows - 1 ? n - row * COLS : COLS
    const norm = colsInRow <= 1 ? 0.5 :
      goRight ? col / (colsInRow - 1) : (colsInRow - 1 - col) / (colsInRow - 1)
    const x = 10 + norm * 80
    const y = rows === 1 ? 50 : 12 + (row / (rows - 1)) * 76
    const [jx, jy] = JITTERS[i % JITTERS.length]
    return { x: Math.max(6, Math.min(94, x + jx)), y: Math.max(8, Math.min(92, y + jy)) }
  })
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

  useEffect(() => { setMounted(true) }, [])

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

  const positions = getPositions(events.length)
  const active = events.find(e => e.id === activeId)

  return (
    <div className="fixed inset-0 z-[60] bg-black overflow-hidden text-white">
      <SketchyFilter />
      <EdgeCurtain side="left" />
      <EdgeCurtain side="right" />

      {/* Sketchy animation (same as main page) */}
      <style>{`
        @keyframes star-twinkle {
          0%, 100% { opacity: 0.03; }
          50% { opacity: 0.12; }
        }
      `}</style>

      {/* Header */}
      <div className={`fixed top-0 left-0 right-0 z-[10] flex items-center justify-between ${mounted ? 'animate-fade-slide-up' : 'opacity-0'}`}
        style={{ padding: 'clamp(28px, 3vw, 44px) clamp(64px, 9vw, 100px) 0' }}>
        <button onClick={() => router.push('/')}
          className="label-caps text-white/40 hover:text-white/80 transition-colors"
          style={{ fontSize: '0.78rem', letterSpacing: '0.25em' }}>
          ← BACK
        </button>
        <div className="flex items-baseline gap-2">
          <span className="label-caps text-white/25" style={{ fontSize: '0.75rem', letterSpacing: '0.3em' }}>TIMELINE</span>
          <span className="text-white/15">·</span>
          <span className="heading-condensed text-white/40" style={{ fontStyle: 'italic', fontSize: '0.88rem' }}>
            The Wheel of Karma
          </span>
        </div>
      </div>

      {/* Top sketchy line (like main page) */}
      <div className="fixed pointer-events-none z-[3] sketch-jitter-line" style={{
        top: 'clamp(28px, 3vw, 48px)', left: '7%', right: '7%', height: '1px',
        background: 'rgba(255,255,255,0.1)', filter: 'url(#sketchy)',
      }} />

      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 border border-white/10 border-t-white/40 rounded-full animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="absolute inset-0 flex flex-col md:flex-row" style={{
          paddingTop: 'clamp(70px, 9vw, 110px)',
          paddingBottom: '16px',
          paddingLeft: '7%', paddingRight: '7%',
        }}>
          {/* Constellation canvas */}
          <div className="relative flex-1 min-h-0" style={{ minHeight: '40vh' }}>
            <svg
              className="absolute inset-0 w-full h-full sketch-jitter-line"
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid meet"
              style={{ filter: 'url(#sketchy)' }}
            >
              {/* Background star dots */}
              {BG_STARS.map((s, i) => (
                <circle key={`bg${i}`} cx={s.x} cy={s.y} r={s.r * 0.4}
                  fill="white" opacity={0.04 + (i % 5) * 0.01}
                  style={i % 9 === 0 ? { animation: `star-twinkle ${3 + i % 4}s ease-in-out ${(i % 7) * 0.4}s infinite` } : undefined}
                />
              ))}

              {/* Constellation lines — ALL connected in order, hand-drawn style */}
              {events.map((_, i) => {
                if (i === 0) return null
                const from = positions[i - 1]
                const to = positions[i]
                if (!from || !to) return null
                const nearActive = events[i].id === activeId || events[i - 1]?.id === activeId
                return (
                  <line key={`ln-${i}`}
                    x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                    stroke={nearActive ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)'}
                    strokeWidth="0.22"
                    style={{ transition: 'stroke 0.4s' }}
                  />
                )
              })}

              {/* Stars — hand-drawn X marks + circles */}
              {events.map((ev, i) => {
                const pos = positions[i]
                if (!pos) return null
                const isActive = ev.id === activeId
                const isHovered = ev.id === hoverId
                const accent = getAccent(ev)
                const sz = ev.type === 'milestone' ? 2.5 : ev.type === 'turning' ? 2.2 : 1.8
                const r = isActive ? sz + 1 : isHovered ? sz + 0.4 : sz

                return (
                  <g key={ev.id} style={{ cursor: 'pointer' }}
                    onClick={() => setActiveId(ev.id)}
                    onMouseEnter={() => setHoverId(ev.id)}
                    onMouseLeave={() => setHoverId(null)}
                  >
                    {/* Outer ring — hand-drawn circle */}
                    {isActive && (
                      <circle cx={pos.x} cy={pos.y} r={r + 2.5}
                        fill="none" stroke={accent} strokeWidth="0.18" opacity="0.3" />
                    )}

                    {/* Star X mark — like hand-drawn tape marks on main page */}
                    <line x1={pos.x - r} y1={pos.y - r * 0.6}
                          x2={pos.x + r} y2={pos.y + r * 0.6}
                          stroke={isActive ? accent : isHovered ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)'}
                          strokeWidth={isActive ? '0.35' : '0.22'}
                          strokeLinecap="round"
                          style={{ transition: 'stroke 0.3s' }} />
                    <line x1={pos.x + r} y1={pos.y - r * 0.6}
                          x2={pos.x - r} y2={pos.y + r * 0.6}
                          stroke={isActive ? accent : isHovered ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)'}
                          strokeWidth={isActive ? '0.35' : '0.22'}
                          strokeLinecap="round"
                          style={{ transition: 'stroke 0.3s' }} />

                    {/* Center dot */}
                    <circle cx={pos.x} cy={pos.y}
                      r={isActive ? 0.8 : 0.5}
                      fill={isActive ? accent : 'rgba(255,255,255,0.6)'}
                      style={{ transition: 'all 0.3s' }} />

                    {/* Glow halo for active */}
                    {isActive && (
                      <circle cx={pos.x} cy={pos.y} r={r * 2}
                        fill="none" stroke={accent} strokeWidth="0.08" opacity="0.15"
                        strokeDasharray="0.5 0.8" />
                    )}

                    {/* Number */}
                    <text x={pos.x} y={pos.y - r - 1.8}
                      textAnchor="middle" fontSize="1.8"
                      fill="rgba(255,255,255,0.22)"
                      fontFamily="'Pretendard Variable', sans-serif"
                    >{String(i + 1).padStart(2, '0')}</text>

                    {/* Title on hover/active */}
                    {(isActive || isHovered) && (
                      <text x={pos.x} y={pos.y + r + 3.2}
                        textAnchor="middle" fontSize="2"
                        fill={isActive ? accent : 'rgba(255,255,255,0.6)'}
                        fontFamily="'Playfair Display', serif"
                        fontStyle="italic"
                      >{ev.title.length > 18 ? ev.title.slice(0, 17) + '…' : ev.title}</text>
                    )}
                  </g>
                )
              })}
            </svg>
          </div>

          {/* Detail panel — right side */}
          {active && (
            <div className="md:w-[300px] lg:w-[340px] flex flex-col overflow-hidden animate-fade-in" key={active.id}
              style={{
                borderLeft: '1px solid rgba(255,255,255,0.06)',
                padding: 'clamp(14px, 1.5vw, 28px) clamp(16px, 2vw, 28px)',
              }}>
              <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
                {/* Decorative divider */}
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="block h-px sketch-jitter-line" style={{
                    width: '24px', background: `${getAccent(active)}50`, filter: 'url(#sketchy)',
                  }} />
                  <span style={{ color: getAccent(active), fontSize: '0.82rem', opacity: 0.6, fontFamily: "'Playfair Display', serif", fontStyle: 'italic' }}>※</span>
                  <span className="block h-px sketch-jitter-line" style={{
                    width: '24px', background: `${getAccent(active)}50`, filter: 'url(#sketchy)',
                  }} />
                </div>

                {/* Date + type */}
                <div className="text-center mb-3">
                  <span className="label-caps" style={{
                    fontSize: '0.75rem', letterSpacing: '0.25em',
                    color: getAccent(active), opacity: 0.9,
                  }}>{active.storyDate}</span>
                  {active.type && (
                    <span className="label-caps ml-2" style={{
                      fontSize: '0.72rem', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.25)',
                    }}>· {TYPE_LABELS[active.type] || active.type}</span>
                  )}
                </div>

                {/* Title */}
                <h2 className="heading-display text-center mb-2" style={{
                  fontSize: 'clamp(1.2rem, 2.2vw, 1.7rem)',
                  color: 'rgba(255,255,255,0.92)', lineHeight: 1.1,
                }}>{active.title}</h2>

                {/* Character */}
                {active.character && (
                  <div className="text-center mb-4">
                    <span className="label-caps" style={{
                      fontSize: '0.75rem', letterSpacing: '0.2em',
                      color: getAccent(active), opacity: 0.5,
                      borderBottom: `1px solid ${getAccent(active)}30`, paddingBottom: '2px',
                    }}>
                      {active.character === 'both' ? 'Manon × Dylan' : active.character === 'manon' ? 'Manon' : 'Dylan'}
                    </span>
                  </div>
                )}

                {/* Sketchy divider */}
                <div className="sketch-jitter-line mb-4" style={{
                  height: '1px', background: 'rgba(255,255,255,0.06)', filter: 'url(#sketchy)',
                }} />

                {/* Description */}
                <p className="text-editorial whitespace-pre-wrap" style={{
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: 'clamp(0.88rem, 1vw, 0.95rem)',
                  lineHeight: 1.85,
                }}>
                  {active.description || <span style={{ fontStyle: 'italic', opacity: 0.4 }}>내용 없음</span>}
                </p>
              </div>

              {/* Nav */}
              <div className="flex items-center justify-between mt-3 pt-2" style={{
                borderTop: '1px solid rgba(255,255,255,0.05)',
              }}>
                <button
                  onClick={() => { const idx = events.findIndex(e => e.id === activeId); if (idx > 0) setActiveId(events[idx - 1].id) }}
                  disabled={events.findIndex(e => e.id === activeId) === 0}
                  className="label-caps disabled:opacity-15 hover:text-white/80"
                  style={{ fontSize: '0.75rem', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)' }}
                >← PREV</button>
                <span className="label-caps text-white/20" style={{ fontSize: '0.72rem' }}>
                  {String(events.findIndex(e => e.id === activeId) + 1).padStart(2, '0')} / {String(events.length).padStart(2, '0')}
                </span>
                <button
                  onClick={() => { const idx = events.findIndex(e => e.id === activeId); if (idx < events.length - 1) setActiveId(events[idx + 1].id) }}
                  disabled={events.findIndex(e => e.id === activeId) === events.length - 1}
                  className="label-caps disabled:opacity-15 hover:text-white/80"
                  style={{ fontSize: '0.75rem', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)' }}
                >NEXT →</button>
              </div>
            </div>
          )}
        </div>
      )}
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
