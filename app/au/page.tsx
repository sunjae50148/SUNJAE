'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import EdgeCurtain from '@/components/EdgeCurtain'
import SketchyFilter from '@/components/SketchyFilter'
import type { AU, AUData } from '@/app/api/au/route'

const MANON_COLOR = '#D9809A'
const DYLAN_COLOR = '#C8C8C8'

export default function AUPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [aus, setAUs] = useState<AU[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    fetch('/api/au')
      .then(r => r.json())
      .then((d: AUData) => { if (d?.aus) setAUs(d.aus) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="fixed inset-0 z-[60] bg-black overflow-hidden text-white">
      <SketchyFilter />
      <EdgeCurtain side="left" />
      <EdgeCurtain side="right" />

      {/* Header */}
      <div className={`fixed top-0 left-0 z-[10] right-0 flex items-center justify-between ${mounted ? 'animate-fade-slide-up' : 'opacity-0'}`}
        style={{ padding: 'clamp(28px, 3vw, 44px) clamp(40px, 6vw, 80px) 0' }}>
        <button onClick={() => router.push('/')}
          className="label-caps text-white/40 hover:text-white/80 transition-colors"
          style={{ fontSize: '0.78rem', letterSpacing: '0.25em' }}>
          ← BACK
        </button>
        <div className="flex items-baseline gap-2">
          <span className="label-caps text-white/25" style={{ fontSize: '0.75rem', letterSpacing: '0.3em' }}>UNIVERSES</span>
          <span className="text-white/15">·</span>
          <span className="heading-condensed text-white/40" style={{ fontStyle: 'italic', fontSize: '0.88rem' }}>
            Alternate Worlds
          </span>
        </div>
      </div>

      {/* Scrollable card area — inside curtains */}
      <div className="absolute inset-0 overflow-y-auto" style={{
        paddingTop: 'clamp(72px, 9vw, 110px)',
        paddingBottom: 'clamp(32px, 4vh, 60px)',
        paddingLeft: '8%',
        paddingRight: '8%',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(255,255,255,0.08) transparent',
      }}>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border border-white/10 border-t-white/40 rounded-full animate-spin" />
          </div>
        ) : aus.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 420px), 1fr))',
            gap: 'clamp(16px, 2vw, 28px)',
          }}>
            {aus.map((au, idx) => (
              <AUCard key={au.id} au={au} idx={idx} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AUCard({ au, idx }: { au: AU; idx: number }) {
  const accent = au.themeColor || MANON_COLOR

  return (
    <div className="relative" style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {/* Top accent bar */}
      <div style={{ height: '3px', background: accent, opacity: 0.7 }} />

      {/* Header: title + subtitle */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            {/* Star decoration */}
            <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0 }}>
              <path d="M5,1 L5.8,3.8 L8.5,3.8 L6.3,5.5 L7.1,8.3 L5,6.7 L2.9,8.3 L3.7,5.5 L1.5,3.8 L4.2,3.8 Z"
                fill={accent} opacity="0.5" />
            </svg>
            <h3 className="heading-display truncate" style={{
              fontSize: 'clamp(1rem, 1.5vw, 1.3rem)',
              color: 'rgba(255,255,255,0.9)',
              fontStyle: 'italic', lineHeight: 1.2,
            }}>
              {au.title}
            </h3>
          </div>
          {au.subtitle && (
            <p className="heading-condensed mt-0.5 pl-5" style={{
              fontSize: '0.82rem', color: 'rgba(255,255,255,0.35)',
              fontStyle: 'italic',
            }}>
              {au.subtitle}
            </p>
          )}
        </div>
        <span className="label-caps" style={{
          fontSize: '0.72rem', letterSpacing: '0.18em',
          color: 'rgba(255,255,255,0.2)',
        }}>
          {String(idx + 1).padStart(2, '0')}
        </span>
      </div>

      {/* Divider */}
      <div className="mx-4 sketch-jitter-line" style={{
        height: '1px', background: 'rgba(255,255,255,0.06)', filter: 'url(#sketchy)',
      }} />

      {/* Characters row: image + name + relationship + image + name */}
      <div className="flex items-stretch">
        {/* Manon (left) */}
        <div className="flex-1 flex flex-col items-center p-3 min-w-0">
          <div className="relative w-full mb-2 overflow-hidden" style={{
            aspectRatio: '1',
            border: `1px solid ${MANON_COLOR}30`,
            background: 'rgba(255,255,255,0.01)',
          }}>
            {au.manon.image ? (
              <img src={au.manon.image} alt={au.manon.name || 'Manon'}
                className="absolute inset-0 w-full h-full object-cover object-top" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="heading-display" style={{
                  color: `${MANON_COLOR}20`, fontSize: '3rem', fontStyle: 'italic',
                }}>{(au.manon.name || 'M').charAt(0)}</span>
              </div>
            )}
          </div>
          <p className="heading-display text-center" style={{
            color: MANON_COLOR, fontSize: '0.88rem', fontStyle: 'italic',
            lineHeight: 1.2,
          }}>{au.manon.name || 'Manon'}</p>
        </div>

        {/* Center: relationship */}
        <div className="flex flex-col items-center justify-center px-2" style={{ minWidth: '60px' }}>
          <span className="block w-px h-6 sketch-jitter-line" style={{
            background: 'rgba(255,255,255,0.1)', filter: 'url(#sketchy)',
          }} />
          <div className="py-2 text-center">
            <span className="heading-display" style={{
              color: accent, fontSize: 'clamp(0.88rem, 1vw, 0.98rem)',
              fontStyle: 'italic', whiteSpace: 'nowrap',
            }}>{au.relationship || '—'}</span>
          </div>
          <span className="block w-px h-6 sketch-jitter-line" style={{
            background: 'rgba(255,255,255,0.1)', filter: 'url(#sketchy)',
          }} />
        </div>

        {/* Dylan (right) */}
        <div className="flex-1 flex flex-col items-center p-3 min-w-0">
          <div className="relative w-full mb-2 overflow-hidden" style={{
            aspectRatio: '1',
            border: `1px solid ${DYLAN_COLOR}25`,
            background: 'rgba(255,255,255,0.01)',
          }}>
            {au.dylan.image ? (
              <img src={au.dylan.image} alt={au.dylan.name || 'Dylan'}
                className="absolute inset-0 w-full h-full object-cover object-top" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="heading-display" style={{
                  color: `${DYLAN_COLOR}20`, fontSize: '3rem', fontStyle: 'italic',
                }}>{(au.dylan.name || 'D').charAt(0)}</span>
              </div>
            )}
          </div>
          <p className="heading-display text-center" style={{
            color: DYLAN_COLOR, fontSize: '0.88rem', fontStyle: 'italic',
            lineHeight: 1.2,
          }}>{au.dylan.name || 'Dylan'}</p>
        </div>
      </div>

      {/* Dialogues */}
      {(au.manon.dialogue || au.dylan.dialogue) && (
        <>
          <div className="mx-4 sketch-jitter-line" style={{
            height: '1px', background: 'rgba(255,255,255,0.06)', filter: 'url(#sketchy)',
          }} />
          <div className="flex gap-3 p-4">
            {/* Manon dialogue */}
            <div className="flex-1 min-w-0">
              {au.manon.dialogue && (
                <div style={{
                  padding: '8px 10px',
                  background: `${MANON_COLOR}08`,
                  border: `1px solid ${MANON_COLOR}18`,
                }}>
                  <p className="text-editorial whitespace-pre-wrap" style={{
                    color: 'rgba(255,255,255,0.65)',
                    fontSize: 'clamp(0.85rem, 0.9vw, 0.92rem)',
                    lineHeight: 1.7,
                  }}>{au.manon.dialogue}</p>
                </div>
              )}
            </div>
            {/* Dylan dialogue */}
            <div className="flex-1 min-w-0">
              {au.dylan.dialogue && (
                <div style={{
                  padding: '8px 10px',
                  background: `${DYLAN_COLOR}06`,
                  border: `1px solid ${DYLAN_COLOR}15`,
                }}>
                  <p className="text-editorial whitespace-pre-wrap" style={{
                    color: 'rgba(255,255,255,0.65)',
                    fontSize: 'clamp(0.85rem, 0.9vw, 0.92rem)',
                    lineHeight: 1.7, textAlign: 'right',
                  }}>{au.dylan.dialogue}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24">
      <span className="block h-px w-16" style={{ background: 'rgba(255,255,255,0.15)' }} />
      <div className="text-center">
        <p className="heading-display text-white/40" style={{ fontSize: '2rem', fontStyle: 'italic' }}>
          No universes yet.
        </p>
        <p className="heading-condensed text-white/20 mt-3" style={{ fontStyle: 'italic', fontSize: '0.85rem' }}>
          Add an alternate world from the admin panel.
        </p>
      </div>
      <span className="block h-px w-16" style={{ background: 'rgba(255,255,255,0.15)' }} />
    </div>
  )
}
