'use client'

import { useState, useEffect, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { ROUTE_DIRECTION_KEY, SKIP_HOME_BOOT_KEY, SunjaeChrome, type RouteDirection } from '@/components/SunjaeChrome'
import type { AU, AUData } from '@/app/api/au/route'

const MANON_COLOR = '#D9809A'
const DYLAN_COLOR = '#C8C8C8'
const PLANET_COUNT = 30
const CHARACTER_LABELS = {
  manon: 'KIM MINJAE',
  dylan: 'LEE SUN',
} as const

function getUniverseIcon(index: number) {
  return `/assets/timeline/planet-${String((index * 7) % PLANET_COUNT).padStart(2, '0')}.png`
}

function getInitial(name: string | undefined, fallback: string) {
  return (name || fallback).charAt(0)
}

function getDisplayName(name: string | undefined, fallback: string) {
  const raw = (name || fallback).trim()
  const key = raw.toLowerCase()
  if (key === 'manon') return CHARACTER_LABELS.manon
  if (key === 'dylan') return CHARACTER_LABELS.dylan
  return raw || fallback
}

export default function AUPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [aus, setAUs] = useState<AU[]>([])
  const [loading, setLoading] = useState(true)
  const [routeDirection, setRouteDirection] = useState<RouteDirection>('prev')
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
    fetch('/api/au')
      .then(r => r.json())
      .then((d: AUData) => { if (d?.aus) setAUs(d.aus) })
      .catch(() => {})
      .finally(() => setLoading(false))
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
        interfaceLabel="UNIVERSE_INTERFACE"
        previousHref="/timeline"
        nextHref="/"
        onNavigate={navigateInterface}
        onAccess={() => navigateInterface('/', 'prev')}
      />

      <div className={`absolute inset-0 sf-route-slide sf-route-${routeDirection} ${routeReady ? 'sf-route-slide-ready' : ''} ${routeLeaving ? 'sf-route-slide-leaving' : ''}`}>
        <div className="sf-au-scroll">
          {loading ? (
            <div className="sf-au-loading">
              <div className="w-6 h-6 border border-white/10 border-t-white/40 rounded-full animate-spin" />
            </div>
          ) : aus.length === 0 ? (
            <EmptyState />
          ) : (
            <div className={`sf-au-grid ${mounted ? 'sf-windows-ready' : ''}`}>
              {aus.map((au, idx) => (
                <AUCard key={au.id} au={au} idx={idx} mounted={mounted} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AUCard({ au, idx, mounted }: { au: AU; idx: number; mounted: boolean }) {
  const accent = au.themeColor || MANON_COLOR
  const cardStyle = {
    '--au-accent': accent,
    '--au-manon': MANON_COLOR,
    '--au-dylan': DYLAN_COLOR,
  } as CSSProperties

  return (
    <article className={`sf-window sf-au-card sf-win-anim sf-win-anim-${(idx % 9) + 1} ${mounted ? '' : 'opacity-0'}`} style={cardStyle}>
      <div className="sf-window-header sf-au-card-header">
        <div className="sf-window-dots">
          <span className="sf-dot sf-dot-red" />
          <span className="sf-dot sf-dot-yellow" />
          <span className="sf-dot sf-dot-green" />
        </div>
        <span className="sf-window-title">AU_FILE_{String(idx + 1).padStart(2, '0')}</span>
        <span className="sf-au-card-signal">WORLD: ACTIVE</span>
      </div>

      <div className="sf-au-card-body">
        <div className="sf-au-title-row">
          <div className="sf-au-orbit-icon">
            <img src={getUniverseIcon(idx)} alt="" draggable={false} />
          </div>
          <div className="sf-au-title-copy">
            <h3>{au.title}</h3>
            {au.subtitle && <p>{au.subtitle}</p>}
          </div>
          <span className="sf-au-index">{String(idx + 1).padStart(2, '0')}</span>
        </div>

        <div className="sf-au-divider" />

        <div className="sf-au-cast-grid">
          <AUCharacterPanel
            person={au.manon}
            fallbackName="KIM MINJAE"
            color={MANON_COLOR}
            side="manon"
          />

          <div className="sf-au-relationship">
            <span className="sf-au-relation-line" />
            <div className="sf-au-relation-core">{au.relationship || '—'}</div>
            <span className="sf-au-relation-line" />
          </div>

          <AUCharacterPanel
            person={au.dylan}
            fallbackName="LEE SUN"
            color={DYLAN_COLOR}
            side="dylan"
          />
        </div>

        {(au.manon.dialogue || au.dylan.dialogue) && (
          <>
            <div className="sf-au-divider" />
            <div className="sf-au-dialogue-grid">
              {au.manon.dialogue && (
                <AUDialogue text={au.manon.dialogue} side="manon" />
              )}
              {au.dylan.dialogue && (
                <AUDialogue text={au.dylan.dialogue} side="dylan" />
              )}
            </div>
          </>
        )}
      </div>
    </article>
  )
}

function AUCharacterPanel({
  person,
  fallbackName,
  color,
  side,
}: {
  person: AU['manon']
  fallbackName: string
  color: string
  side: 'manon' | 'dylan'
}) {
  const displayName = getDisplayName(person.name, fallbackName)

  return (
    <div className={`sf-au-person sf-au-person-${side}`} style={{ '--person-color': color } as CSSProperties}>
      <div className="sf-au-portrait">
        {person.image ? (
          <img src={person.image} alt={displayName} />
        ) : (
          <div className="sf-au-portrait-fallback">
            <span>{getInitial(displayName, fallbackName)}</span>
          </div>
        )}
      </div>
      <p>{displayName}</p>
    </div>
  )
}

function AUDialogue({ text, side }: { text: string; side: 'manon' | 'dylan' }) {
  return (
    <div className={`sf-au-quote sf-au-quote-${side}`}>
      <p>{text}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="sf-window sf-au-empty">
      <div className="sf-window-header">
        <div className="sf-window-dots">
          <span className="sf-dot sf-dot-red" />
          <span className="sf-dot sf-dot-yellow" />
          <span className="sf-dot sf-dot-green" />
        </div>
        <span className="sf-window-title">AU_DIRECTORY</span>
      </div>
      <div className="text-center">
        <p className="heading-display text-white/40" style={{ fontSize: '2rem' }}>
          No universes yet.
        </p>
        <p className="heading-condensed text-white/20 mt-3" style={{ fontStyle: 'italic', fontSize: '0.85rem' }}>
          Add an alternate world from the admin panel.
        </p>
      </div>
    </div>
  )
}
