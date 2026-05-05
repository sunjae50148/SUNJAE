'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const ChatPopupDynamic = dynamic(() => import('@/components/ChatPopup'), { ssr: false })

const PROPS = [
  { label: 'Prologue', sub: 'Only poison grows from the seed of poison', href: '/', vx: 24, vy: 50, rot: -3, sz: 0.92 },
  { label: 'Characters', sub: 'Manon × Dylan', href: '/character', vx: 68, vy: 47, rot: 2, sz: 0.88 },
  { label: 'Records', sub: 'Roleplay Session Archive', href: '/record', vx: 35, vy: 65, rot: -1.5, sz: 1.0 },
  { label: 'Timeline', sub: 'The Wheel of Karma', href: '/timeline', vx: 66, vy: 70, rot: 2.5, sz: 1.05 },
  { label: 'Universes', sub: 'Alternate Worlds', href: '/au', vx: 50, vy: 56, rot: 0.5, sz: 0.94 },
]

const EXTRAS = [
  { label: 'Interview with Manon', by: 'Manon', href: '/foreword', vx: 20, vy: 82, rot: -1.5 },
  { label: 'Interview with Dylan', by: 'Dylan', href: '/rebuttal', vx: 80, vy: 78, rot: 1 },
]

const ADMIN_PROPS = [
  { label: 'Admin', sub: 'Stage Door', href: '/admin', vx: 24, vy: 90, rot: -2, sz: 0.85 },
  { label: 'Sheets', sub: 'Documents & Links', href: '/sheets', vx: 50, vy: 88, rot: 0.5, sz: 0.85 },
  { label: 'Logout', sub: '', href: '__logout__', vx: 80, vy: 90, rot: 1.5, sz: 0.8 },
]

function SvgDefs({ turbRef }: { turbRef: React.MutableRefObject<SVGFETurbulenceElement | null> }) {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        <filter id="sketchy">
          <feTurbulence ref={turbRef} type="turbulence" baseFrequency="0.015" numOctaves="3" seed="2" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  )
}

function Curtain({ side, open }: { side: 'left' | 'right'; open: boolean }) {
  const isLeft = side === 'left'
  const folds = [8, 17, 27, 38, 50, 62, 74, 85, 95]
  return (
    <div className="fixed top-0 h-full z-[100]" style={{
      [side]: 0, width: '52%', background: '#000',
      transform: open ? `translateX(${isLeft ? '-85%' : '85%'})` : 'translateX(0)',
      transition: 'transform 1.8s cubic-bezier(0.76, 0, 0.24, 1)',
    }}>
      {folds.map((pct, i) => (
        <div key={i} className="absolute top-0 bottom-0 sketch-jitter-line" style={{
          [isLeft ? 'right' : 'left']: `${pct}%`,
          width: `${1.5 + i * 0.3}px`,
          background: `rgba(255,255,255,${0.15 + i * 0.08})`,
          filter: 'url(#sketchy)', animationDelay: `${i * -0.07}s`,
        }} />
      ))}
      {/* Curtain inner edge — the side facing the stage */}
      <div className="absolute top-0 bottom-0 sketch-jitter-line" style={{
        [isLeft ? 'left' : 'right']: '100%',
        width: '2px',
        background: 'rgba(255,255,255,0.55)',
        filter: 'url(#sketchy)',
        boxShadow: `${isLeft ? '4px' : '-4px'} 0 8px rgba(255,255,255,0.08)`,
      }} />
      <div className="absolute left-0 right-0 sketch-jitter-line" style={{
        top: '3%', height: '1.5px', background: 'rgba(255,255,255,0.5)', filter: 'url(#sketchy)',
      }} />
    </div>
  )
}

// ── Stage scenery (jitters) — no center triangle ──
function StageDrawing() {
  const H = 40
  const lightXs = [18, 30, 42, 58, 70, 82]

  // Perspective floor planks: rows get taller toward front
  const plankRows: { y1: number; y2: number }[] = []
  let cy = H + 1.5
  let rowH = 2.2
  while (cy < 95) {
    const nextY = Math.min(cy + rowH, 95)
    plankRows.push({ y1: cy, y2: nextY })
    cy = nextY
    rowH *= 1.12
  }

  // Staggered seam positions per row (like real floorboards)
  const seamPatterns = [
    [12, 28, 45, 61, 78, 92],
    [8, 22, 38, 55, 70, 85, 96],
    [15, 33, 48, 65, 82, 95],
    [10, 25, 42, 58, 74, 88],
    [18, 35, 50, 68, 80, 94],
    [7, 20, 37, 52, 66, 83, 96],
    [14, 30, 46, 62, 76, 90],
    [9, 26, 40, 56, 72, 86, 97],
    [16, 32, 48, 64, 80, 93],
    [11, 28, 44, 58, 74, 88],
    [13, 30, 47, 63, 78, 92],
    [8, 24, 39, 55, 70, 84, 96],
  ]

  return (
    <svg
      className="absolute inset-0 w-full h-full sketch-jitter-line"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ filter: 'url(#sketchy)' }}
    >
      {/* ── Lighting rig ── */}
      <line x1={8} y1={4} x2={92} y2={4}
            stroke="rgba(255,255,255,0.25)" strokeWidth="0.35" />
      <line x1={8} y1={4.6} x2={92} y2={4.6}
            stroke="rgba(255,255,255,0.08)" strokeWidth="0.12" />
      {lightXs.map(lx => (
        <g key={`lt${lx}`}>
          <polygon
            points={`${lx - 1.5},4 ${lx + 1.5},4 ${lx + 2.2},7 ${lx - 2.2},7`}
            stroke="rgba(255,255,255,0.2)" strokeWidth="0.15" fill="rgba(255,255,255,0.03)" />
          <line x1={lx} y1={7} x2={lx} y2={8.5}
                stroke="rgba(255,255,255,0.1)" strokeWidth="0.1" />
        </g>
      ))}

      {/* ── Center spotlight fixture (the light source) ── */}
      <circle cx={50} cy={4} r={2.5}
              stroke="rgba(255,255,255,0.35)" strokeWidth="0.2" fill="rgba(255,255,255,0.05)" />
      <circle cx={50} cy={4} r={0.9}
              fill="rgba(255,255,255,0.3)" />

      {/* ── Ropes ── */}
      <line x1={10} y1={0} x2={10} y2={4} stroke="rgba(255,255,255,0.04)" strokeWidth="0.08" />
      <line x1={90} y1={0} x2={90} y2={4} stroke="rgba(255,255,255,0.04)" strokeWidth="0.08" />

      {/* (side wings removed — curtains handle this) */}

      {/* ── Back wall texture ── */}
      {[12, 20, 28, 36].map(y => (
        <line key={`wh${y}`} x1={8} y1={y} x2={92} y2={y}
              stroke="rgba(255,255,255,0.018)" strokeWidth="0.08" />
      ))}
      {[20, 35, 50, 65, 80].map(x => (
        <line key={`wv${x}`} x1={x} y1={8} x2={x} y2={H}
              stroke="rgba(255,255,255,0.012)" strokeWidth="0.06" />
      ))}
      {/* Scenic flat outlines */}
      <rect x={12} y={14} width={18} height={22} rx={0.3}
            stroke="rgba(255,255,255,0.025)" strokeWidth="0.1" fill="none" />
      <rect x={70} y={12} width={16} height={24} rx={0.3}
            stroke="rgba(255,255,255,0.02)" strokeWidth="0.08" fill="none" />

      {/* ── Proscenium arch ── */}
      <polyline points={`7,8 7,${H} 93,${H} 93,8`}
                stroke="rgba(255,255,255,0.07)" strokeWidth="0.2" fill="none" />
      <path d="M7,8 Q50,4 93,8"
            stroke="rgba(255,255,255,0.05)" strokeWidth="0.15" fill="none" />

      {/* ── Horizon line ── */}
      <line x1={0} y1={H} x2={100} y2={H}
            stroke="rgba(255,255,255,0.22)" strokeWidth="0.3" />
      <line x1={3} y1={H + 0.6} x2={97} y2={H + 0.6}
            stroke="rgba(255,255,255,0.06)" strokeWidth="0.1" />

      {/* ── Wood floor planks with perspective ── */}
      {plankRows.map((row, ri) => {
        const t = (row.y1 - H) / (95 - H)
        const margin = Math.max(3, 16 - t * 14)
        const lineO = 0.07 + t * 0.09
        const seams = seamPatterns[ri % seamPatterns.length]
        const midY = (row.y1 + row.y2) / 2
        const rowHeight = row.y2 - row.y1

        return (
          <g key={`pr${ri}`}>
            {/* Horizontal plank line */}
            <line x1={margin} y1={row.y1} x2={100 - margin} y2={row.y1}
                  stroke={`rgba(255,255,255,${lineO})`} strokeWidth="0.12" />

            {/* Vertical seams for this row */}
            {seams.filter(sx => sx > margin && sx < 100 - margin).map((sx, si) => (
              <line key={`s${ri}-${si}`} x1={sx} y1={row.y1 + 0.3} x2={sx} y2={row.y2 - 0.3}
                    stroke={`rgba(255,255,255,${lineO * 0.8})`} strokeWidth="0.1" />
            ))}

            {/* Wood grain lines within planks */}
            {seams.filter(sx => sx > margin && sx < 100 - margin).map((sx, si) => {
              const prevX = si === 0 ? margin : seams[si - 1] || margin
              const plankMid = (prevX + sx) / 2
              const pw = (sx - prevX) * 0.6
              if (pw < 3) return null
              const grainCount = rowHeight > 4 ? 3 : rowHeight > 2.5 ? 2 : 1
              return Array.from({ length: grainCount }, (_, gi) => {
                const gy = row.y1 + rowHeight * (0.25 + gi * 0.28)
                const waver = ((ri + si + gi) % 3 - 1) * 0.3
                return (
                  <path key={`g${ri}-${si}-${gi}`}
                    d={`M${plankMid - pw / 2} ${gy} Q${plankMid} ${gy + waver} ${plankMid + pw / 2} ${gy}`}
                    stroke={`rgba(255,255,255,${lineO * 0.3})`} strokeWidth="0.05" fill="none" />
                )
              })
            })}

            {/* Occasional knot */}
            {ri % 3 === 0 && seams.length > 2 && (
              <ellipse cx={seams[1] - 4} cy={midY}
                       rx={0.5 + (ri % 2) * 0.3} ry={0.3 + (ri % 2) * 0.15}
                       stroke={`rgba(255,255,255,${lineO * 0.4})`} strokeWidth="0.06" fill="none" />
            )}
          </g>
        )
      })}

      {/* ── Front stage edge ── */}
      <line x1={0} y1={95} x2={100} y2={95}
            stroke="rgba(255,255,255,0.1)" strokeWidth="0.25" />
      <line x1={0} y1={95.5} x2={100} y2={95.5}
            stroke="rgba(255,255,255,0.04)" strokeWidth="0.1" />

      {/* ── Prop marks (X tape) ── */}
      {PROPS.map((p, i) => {
        const s = 1.5
        return (
          <g key={`pm${i}`}>
            <line x1={p.vx - s} y1={p.vy - s * 0.6} x2={p.vx + s} y2={p.vy + s * 0.6}
                  stroke="rgba(255,255,255,0.06)" strokeWidth="0.1" />
            <line x1={p.vx + s} y1={p.vy - s * 0.6} x2={p.vx - s} y2={p.vy + s * 0.6}
                  stroke="rgba(255,255,255,0.06)" strokeWidth="0.1" />
          </g>
        )
      })}
      {EXTRAS.map((e, i) => (
        <circle key={`em${i}`} cx={e.vx} cy={e.vy} r={0.6}
                stroke="rgba(255,255,255,0.04)" strokeWidth="0.08" fill="none" />
      ))}
      {ADMIN_PROPS.map((p, i) => (
        <circle key={`ap${i}`} cx={p.vx} cy={p.vy} r={0.5}
                stroke="rgba(255,255,255,0.03)" strokeWidth="0.06" fill="none" />
      ))}

      {/* ── Magic wand (lying on floor, slightly angled) ── */}
      <g transform="translate(82, 52) rotate(-25)" opacity="0.2">
        {/* Wand shaft — slightly tapered */}
        <path d="M0,0.3 L10,0.12 L12.8,0 L10,-0.12 L0,-0.3 Z"
              stroke="white" strokeWidth="0.1" fill="rgba(255,255,255,0.03)" />
        {/* Handle detail — ornate grip */}
        <ellipse cx={0.3} cy={0} rx={0.5} ry={0.45}
                 stroke="white" strokeWidth="0.1" fill="none" />
        <line x1={1.2} y1={-0.28} x2={1.2} y2={0.28}
              stroke="white" strokeWidth="0.08" />
        <line x1={1.8} y1={-0.25} x2={1.8} y2={0.25}
              stroke="white" strokeWidth="0.08" />
        <line x1={2.4} y1={-0.22} x2={2.4} y2={0.22}
              stroke="white" strokeWidth="0.08" />
        <path d="M2.8,-0.2 Q3.2,0 2.8,0.2" stroke="white" strokeWidth="0.07" fill="none" />
        {/* Wood texture along shaft */}
        <path d="M3.5,0.08 Q6,0.15 9,0.05" stroke="white" strokeWidth="0.04" fill="none" opacity="0.5" />
        <path d="M4,-0.06 Q7,-0.12 10,-0.04" stroke="white" strokeWidth="0.04" fill="none" opacity="0.4" />
        {/* Sparkles at tip */}
        <line x1={13.2} y1={-1} x2={13.2} y2={1}
              stroke="white" strokeWidth="0.07" />
        <line x1={12.2} y1={0} x2={14.2} y2={0}
              stroke="white" strokeWidth="0.07" />
        <line x1={12.5} y1={-0.7} x2={13.9} y2={0.7}
              stroke="white" strokeWidth="0.05" />
        <line x1={13.9} y1={-0.7} x2={12.5} y2={0.7}
              stroke="white" strokeWidth="0.05" />
        <circle cx={13.2} cy={0} r={0.2} fill="rgba(255,255,255,0.4)" />
      </g>

      {/* ── Ribbon lying on floor ── */}
      <foreignObject x="33" y="78" width="14" height="14">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 110" style={{ width: '100%', height: '100%' }}>
          <g opacity="0.22">
            {/* Ribbon — long satin strip loosely curled on floor */}
            <path d="M10,90 C15,70 5,50 15,35 C25,20 40,25 35,40 C30,55 15,55 20,40 C25,25 45,15 60,20 C75,25 70,45 55,50 C40,55 50,35 65,30 C80,25 95,30 100,50 C105,70 90,80 85,65 C80,50 95,40 110,45 C125,50 130,70 120,85"
                  stroke="white" strokeWidth="1" fill="none" />
            {/* Ribbon width — parallel offset for satin feel */}
            <path d="M12,92 C17,72 7,52 17,37 C27,22 42,27 37,42 C32,57 17,57 22,42 C27,27 47,17 62,22 C77,27 72,47 57,52 C42,57 52,37 67,32 C82,27 97,32 102,52 C107,72 92,82 87,67 C82,52 97,42 112,47 C127,52 132,72 122,87"
                  stroke="white" strokeWidth="0.6" fill="none" opacity="0.4" />
          </g>
        </svg>
      </foreignObject>
    </svg>
  )
}

// ── Stage text content (still) ──
function StageContent({ color, dim, router, hovered, onHover, onArchive, isOverlay, isAdmin, loggedUser }: {
  color: string; dim: string; router: any
  hovered: number | null; onHover: (i: number | null) => void
  onArchive: () => void; isOverlay?: boolean; isAdmin?: boolean
  loggedUser?: string | null
}) {
  const El = isOverlay ? 'div' : 'button'

  return (
    <div className="absolute inset-0">
      {/* ── Back wall: title ── */}
      <div className="absolute flex flex-col items-center justify-center"
        style={{ top: 0, left: 0, right: 0, height: '40%', paddingTop: 'clamp(28px, 5vh, 52px)' }}>
        <h1 style={{
          color, fontSize: 'clamp(3.5rem, 11vw, 9rem)',
          fontFamily: "'Playfair Display', serif", fontWeight: 900,
          letterSpacing: '-0.06em', lineHeight: 0.85,
          marginBottom: 'clamp(4px, 0.8vh, 10px)',
        }}>SOMBRE</h1>
        <p style={{
          color: dim, fontSize: 'clamp(0.95rem, 1.5vw, 1.15rem)',
          fontFamily: "'Playfair Display', serif", fontStyle: 'italic',
          letterSpacing: '0.06em', marginBottom: '3px',
        }}>Wizard and Ballerina</p>
        <p style={{
          color: dim, fontSize: 'clamp(0.82rem, 0.9vw, 0.9rem)',
          fontFamily: "'Playfair Display', serif", opacity: 0.7,
        }}>of <em>Dylan</em> &times; <em>Manon</em></p>
      </div>

      {/* ── Props on floor ── */}
      {PROPS.map((prop, i) => (
        <El
          key={prop.href}
          {...(!isOverlay && {
            onClick: () => router.push(prop.href),
            onMouseEnter: () => onHover(i),
            onMouseLeave: () => onHover(null),
          })}
          className={isOverlay ? '' : 'cursor-pointer'}
          style={{
            position: 'absolute',
            left: `${prop.vx}%`, top: `${prop.vy}%`,
            transform: `translate(-50%, -50%) rotate(${prop.rot}deg)`,
            background: 'none', border: 'none',
            textAlign: 'center' as const, color,
            fontFamily: "'Playfair Display', serif", fontWeight: 400,
            fontSize: `calc(clamp(1.2rem, 2vw, 1.5rem) * ${prop.sz})`,
            letterSpacing: hovered === i ? '0.2em' : '0.06em',
            transition: 'letter-spacing 0.4s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.3s',
            fontStyle: hovered === i ? 'italic' as const : 'normal' as const,
            opacity: hovered !== null && hovered !== i ? 0.2 : 1,
            padding: 'clamp(6px, 1vh, 12px) clamp(12px, 2vw, 24px)',
          }}
        >
          <span style={{
            display: 'block',
            fontSize: 'clamp(0.82rem, 0.65vw, 0.82rem)',
            fontFamily: "'Pretendard Variable', sans-serif",
            letterSpacing: '0.2em', opacity: 0.5,
            marginBottom: '2px', fontStyle: 'normal',
          }}>{String(i + 1).padStart(2, '0')}</span>
          {prop.label}
          <span style={{
            display: 'block',
            fontSize: 'clamp(0.65rem, 0.75vw, 0.72rem)',
            fontStyle: 'italic', letterSpacing: '0.02em',
            opacity: hovered === i ? 0.65 : 0,
            maxHeight: hovered === i ? '18px' : '0px',
            overflow: 'hidden',
            transition: 'opacity 0.35s, max-height 0.35s',
            marginTop: hovered === i ? '3px' : '0px',
          }}>{prop.sub}</span>
        </El>
      ))}

      {/* ── Extras ── */}
      {EXTRAS.map((ext) => (
        <El key={ext.href}
          {...(!isOverlay && { onClick: () => router.push(ext.href) })}
          className={isOverlay ? '' : 'cursor-pointer'}
          style={{
            position: 'absolute',
            left: `${ext.vx}%`, top: `${ext.vy}%`,
            transform: `translate(-50%, -50%) rotate(${ext.rot}deg)`,
            background: 'none', border: 'none', color: dim,
            fontSize: 'clamp(0.85rem, 1.1vw, 1rem)',
            fontFamily: "'Playfair Display', serif", fontStyle: 'italic',
            textAlign: 'center' as const,
          }}>
          {ext.label}
        </El>
      ))}

      {/* ── Admin props (visible when logged in) ── */}
      {isAdmin ? (
        <>
          {ADMIN_PROPS.map((prop, i) => (
            <El
              key={prop.href}
              {...(!isOverlay && {
                onClick: () => prop.href === '__logout__' ? onArchive() : router.push(prop.href),
                onMouseEnter: () => onHover(100 + i),
                onMouseLeave: () => onHover(null),
              })}
              className={isOverlay ? '' : 'cursor-pointer'}
              style={{
                position: 'absolute',
                left: `${prop.vx}%`, top: `${prop.vy}%`,
                transform: `translate(-50%, -50%) rotate(${prop.rot}deg)`,
                background: 'none', border: 'none',
                textAlign: 'center' as const,
                color: dim,
                fontFamily: "'Playfair Display', serif", fontWeight: 400,
                fontSize: `calc(clamp(1rem, 1.5vw, 1.2rem) * ${prop.sz})`,
                letterSpacing: hovered === 100 + i ? '0.2em' : '0.06em',
                transition: 'letter-spacing 0.4s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.3s',
                fontStyle: hovered === 100 + i ? 'italic' as const : 'normal' as const,
                opacity: hovered !== null && hovered !== 100 + i ? 0.3 : 0.85,
              }}
            >
              {prop.label}
              {prop.sub && (
                <span style={{
                  display: 'block',
                  fontSize: 'clamp(0.82rem, 0.75vw, 0.88rem)',
                  fontStyle: 'italic', letterSpacing: '0.02em',
                  opacity: hovered === 100 + i ? 0.65 : 0,
                  maxHeight: hovered === 100 + i ? '18px' : '0px',
                  overflow: 'hidden',
                  transition: 'opacity 0.35s, max-height 0.35s',
                  marginTop: hovered === 100 + i ? '3px' : '0px',
                }}>{prop.sub}</span>
              )}
            </El>
          ))}
          {/* Logged-in indicator */}
          <div className="absolute" style={{
            left: '50%', bottom: '2%', transform: 'translateX(-50%)',
            textAlign: 'center',
          }}>
            <span style={{
              color: loggedUser === 'manon' ? '#D9809A' : '#C8C8C8',
              fontSize: 'clamp(0.82rem, 0.7vw, 0.85rem)',
              fontFamily: "'Pretendard Variable', sans-serif",
              letterSpacing: '0.2em', opacity: 0.7,
              textTransform: 'uppercase' as const,
            }}>logged in as {loggedUser}</span>
          </div>
        </>
      ) : (
        <El
          {...(!isOverlay && { onClick: onArchive })}
          className={isOverlay ? '' : 'cursor-pointer group'}
          style={{
            position: 'absolute',
            left: '50%', bottom: '5%',
            transform: 'translateX(-50%)',
            background: 'none', border: 'none',
            textAlign: 'center' as const,
            display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '4px',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ opacity: 0.6 }}>
            <circle cx="5" cy="5" r="3.5" stroke={color} strokeWidth="0.9" />
            <line x1="7.5" y1="7.5" x2="12" y2="12" stroke={color} strokeWidth="0.9" strokeLinecap="round" />
            <line x1="10" y1="11" x2="10" y2="13" stroke={color} strokeWidth="0.9" strokeLinecap="round" />
            <line x1="11.5" y1="11.5" x2="12.5" y2="11.5" stroke={color} strokeWidth="0.9" strokeLinecap="round" />
          </svg>
          <span style={{
            color, opacity: 0.65,
            fontSize: 'clamp(0.82rem, 0.85vw, 0.9rem)',
            fontFamily: "'Pretendard Variable', sans-serif",
            letterSpacing: '0.22em', textTransform: 'uppercase' as const,
            transition: 'opacity 0.3s',
          }}>Login</span>
        </El>
      )}

      {/* ── Bottom links ── */}
      <div className="absolute flex items-center gap-4" style={{
        right: 'clamp(20px, 3vw, 40px)', bottom: '3%',
      }}>
        <El {...(!isOverlay && { onClick: () => window.open('https://x.com/4rgonautika', '_blank') })}
          className={isOverlay ? '' : 'cursor-pointer'}
          style={{
            background: 'none', border: 'none', color: dim, opacity: 0.5,
            fontSize: 'clamp(0.82rem, 0.75vw, 0.88rem)',
            fontFamily: "'Pretendard Variable', sans-serif",
            letterSpacing: '0.15em', textTransform: 'uppercase' as const,
          }}>Twitter</El>
      </div>

      {/* ── Quote ── */}
      <div className="absolute" style={{
        right: 'clamp(20px, 3.5vw, 40px)', top: 'clamp(12px, 2vh, 24px)',
        textAlign: 'right', maxWidth: 'clamp(150px, 18vw, 240px)',
      }}>
        <p style={{ color: dim, opacity: 0.4,
          fontSize: 'clamp(0.82rem, 0.88vw, 0.9rem)',
          fontFamily: "'Playfair Display', serif", fontStyle: 'italic', lineHeight: 1.5,
        }}>&ldquo;One must still have chaos in oneself to give birth to a dancing star.&rdquo;</p>
        <p style={{ color: dim, opacity: 0.28,
          fontSize: 'clamp(0.82rem, 0.65vw, 0.85rem)',
          fontFamily: "'Pretendard Variable', sans-serif",
          letterSpacing: '0.12em', marginTop: '2px',
        }}>NIETZSCHE</p>
      </div>
    </div>
  )
}

// ── Main ──
export default function Home() {
  const router = useRouter()
  const [curtainOpen, setCurtainOpen] = useState(false)
  const [stageVisible, setStageVisible] = useState(false)
  const [mouse, setMouse] = useState({ x: -400, y: -400 })
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState<'manon' | 'dylan'>('manon')
  const [isAdmin, setIsAdmin] = useState(false)
  const [loggedUser, setLoggedUser] = useState<string | null>(null)
  const [srcX, setSrcX] = useState(400)
  const [viewH, setViewH] = useState(800)
  const turbRef = useRef<SVGFETurbulenceElement>(null)

  const srcY = 35

  useEffect(() => {
    const t1 = setTimeout(() => setCurtainOpen(true), 1800)
    const t2 = setTimeout(() => setStageVisible(true), 3000)
    setIsAdmin(localStorage?.getItem('same_admin_login') === 'true')
    setLoggedUser(localStorage?.getItem('same_logged_user') || null)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  useEffect(() => {
    const move = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', move)
    return () => window.removeEventListener('mousemove', move)
  }, [])

  useEffect(() => {
    const update = () => { setSrcX(window.innerWidth / 2); setViewH(window.innerHeight) }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    let frame: number
    let last = 0
    const tick = (t: number) => {
      if (t - last > 100) {
        turbRef.current?.setAttribute('seed', String(Math.floor(Math.random() * 200)))
        last = t
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) {
        localStorage?.setItem('same_admin_login', 'true')
        localStorage?.setItem('same_logged_user', username)
        localStorage?.setItem('sombre_chat_as', username)
        setIsAdmin(true)
        setLoggedUser(username)
        setShowLogin(false)
        setPassword('')
      } else {
        alert('비밀번호가 일치하지 않습니다.')
      }
    } catch {
      alert('인증 처리 중 오류가 발생했습니다.')
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' })
    } catch {}
    localStorage?.removeItem('same_admin_login')
    localStorage?.removeItem('same_logged_user')
    setIsAdmin(false)
    setLoggedUser(null)
  }

  // Perspective ellipse: shape changes based on mouse position
  const dy = Math.max(mouse.y - srcY, 1)
  const dx = mouse.x - srcX
  const vertFactor = Math.min(1, dy / (viewH * 0.75))
  const spotRx = 80
  const spotRy = 80 * Math.max(0.18, vertFactor * 0.55)
  const arcRot = (dx / (viewH || 800)) * 20

  const mask = `radial-gradient(ellipse ${spotRx}px ${spotRy}px at ${mouse.x}px ${mouse.y}px, white 12%, transparent 100%)`

  const conePath = mouse.y > srcY + 20
    ? `M${srcX - 3} ${srcY} L${mouse.x - spotRx} ${mouse.y} A${spotRx} ${spotRy} ${arcRot} 0 1 ${mouse.x + spotRx} ${mouse.y} L${srcX + 3} ${srcY} Z`
    : ''

  return (
    <div className="fixed inset-0 z-[60] bg-black overflow-hidden">
      <SvgDefs turbRef={turbRef} />

      <Curtain side="left" open={curtainOpen} />
      <Curtain side="right" open={curtainOpen} />

      {/* Stage drawing */}
      <div className="absolute inset-0 transition-opacity duration-[1.5s]" style={{ opacity: stageVisible ? 1 : 0 }}>
        <StageDrawing />
      </div>

      {/* Base text — white */}
      <div className="absolute inset-0 transition-opacity duration-[1.5s]" style={{ opacity: stageVisible ? 1 : 0 }}>
        <StageContent color="rgba(235,235,235,0.88)" dim="rgba(235,235,235,0.55)"
          router={router} hovered={hoveredIdx} onHover={setHoveredIdx}
          onArchive={isAdmin ? handleLogout : () => setShowLogin(true)} isAdmin={isAdmin}
          loggedUser={loggedUser} />
      </div>

      {/* ── Spotlight ── */}
      {stageVisible && (
        <>
          {/* Light source glow at top center */}
          <div className="absolute pointer-events-none" style={{
            left: srcX - 25, top: srcY - 20, width: 50, height: 40,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.08) 40%, transparent 100%)',
          }} />

          {/* Cone + ellipse as one shape (path with arc) */}
          {conePath && (
            <div className="absolute inset-0 pointer-events-none" style={{
              background: `linear-gradient(to bottom, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.2) 100%)`,
              clipPath: `path('${conePath}')`,
            }} />
          )}

          {/* Floor ellipse outline */}
          {mouse.y > srcY + 20 && (
            <div className="absolute pointer-events-none" style={{
              left: mouse.x - spotRx, top: mouse.y - spotRy,
              width: spotRx * 2, height: spotRy * 2,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.15)',
              transform: `rotate(${arcRot}deg)`,
              boxShadow: '0 0 20px 2px rgba(255,255,255,0.06)',
            }} />
          )}
        </>
      )}

      {/* Pink text — masked to spotlight */}
      {stageVisible && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ WebkitMaskImage: mask, maskImage: mask }}>
          <StageContent color="#FF6B9D" dim="rgba(255,107,157,0.5)"
            router={router} hovered={hoveredIdx} onHover={() => {}}
            onArchive={() => {}} isOverlay isAdmin={isAdmin} loggedUser={loggedUser} />
        </div>
      )}

      {/* Login modal */}
      {showLogin && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowLogin(false)}>
          <div className="p-8 w-full max-w-xs"
            style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.92)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ textAlign: 'center', marginBottom: '24px',
              color: 'rgba(255,255,255,0.3)', fontSize: '0.6rem',
              letterSpacing: '0.3em', textTransform: 'uppercase',
              fontFamily: "'Pretendard Variable', sans-serif",
            }}>Login</h3>
            {/* Username selector */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {(['manon', 'dylan'] as const).map(u => (
                <button key={u} onClick={() => setUsername(u)}
                  style={{
                    flex: 1, padding: '10px 0', cursor: 'pointer',
                    background: username === u ? (u === 'manon' ? 'rgba(217,128,154,0.15)' : 'rgba(200,200,200,0.1)') : 'transparent',
                    border: `1px solid ${username === u ? (u === 'manon' ? '#D9809A' : '#C8C8C8') + '60' : 'rgba(255,255,255,0.08)'}`,
                    color: username === u ? (u === 'manon' ? '#D9809A' : '#C8C8C8') : 'rgba(255,255,255,0.3)',
                    fontSize: '0.75rem', fontFamily: "'Playfair Display', serif",
                    fontStyle: 'italic', letterSpacing: '0.08em',
                    transition: 'all 0.3s',
                    textTransform: 'capitalize',
                  }}>
                  {u}
                </button>
              ))}
            </div>
            <input type="password" placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleLogin(e as any) }}
              style={{ width: '100%', background: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '12px 16px', color: 'white', fontSize: '0.85rem',
                textAlign: 'center', outline: 'none',
                fontFamily: "'Pretendard Variable', sans-serif",
              }} autoFocus />
            <button onClick={e => handleLogin(e as any)}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,107,157,0.65)'; e.currentTarget.style.borderColor = '#FF6B9D'; e.currentTarget.style.color = 'white' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
              style={{ width: '100%', marginTop: '12px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent', color: 'rgba(255,255,255,0.6)',
                padding: '12px', fontSize: '0.8rem', cursor: 'pointer',
                fontFamily: "'Pretendard Variable', sans-serif",
                letterSpacing: '0.1em', transition: 'all 0.3s',
              }}>ENTER</button>
          </div>
        </div>
      )}

      {/* Chat popup — visible when logged in */}
      {isAdmin && <ChatPopupDynamic />}
    </div>
  )
}
