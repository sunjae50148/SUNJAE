'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import EdgeCurtain from '@/components/EdgeCurtain'
import SketchyFilter from '@/components/SketchyFilter'
import { BalletRibbon, MagicSparkle } from '@/components/StageMotifs'
import type { Sheet, SheetsData } from '@/app/api/sheets/route'

export default function SheetsPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [sheets, setSheets] = useState<Sheet[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const ok = typeof window !== 'undefined' && localStorage.getItem('same_admin_login') === 'true'
    setAuthed(!!ok)
    setAuthChecked(true)
  }, [])

  useEffect(() => {
    if (!authed) return
    fetch('/api/sheets')
      .then(r => r.json())
      .then((d: SheetsData) => {
        if (Array.isArray(d?.sheets)) setSheets(d.sheets)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [authed])

  if (!authChecked) {
    return <div className="fixed inset-0 bg-black" />
  }

  if (!authed) {
    return <AccessDenied onBack={() => router.push('/')} />
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black overflow-hidden text-white">
      <SketchyFilter />
      <EdgeCurtain side="left" />
      <EdgeCurtain side="right" />

      {/* Frame line */}
      <div className="fixed pointer-events-none z-[3] sketch-jitter-line" style={{
        top: 'clamp(28px, 3vw, 48px)', left: '7%', right: '7%', height: '1px',
        background: 'rgba(255,255,255,0.1)', filter: 'url(#sketchy)',
      }} />

      {/* Top bar */}
      <div className={`fixed top-0 left-0 right-0 z-[10] flex items-center justify-between ${mounted ? 'animate-fade-slide-up' : 'opacity-0'}`}
        style={{ padding: 'clamp(28px, 3vw, 44px) clamp(64px, 9vw, 100px) 0' }}>
        <button onClick={() => router.push('/')}
          className="label-caps text-white/40 hover:text-white/80 transition-colors"
          style={{ fontSize: '0.55rem', letterSpacing: '0.25em' }}>
          ← BACK
        </button>
        <div className="flex items-baseline gap-2">
          <span className="label-caps text-white/25" style={{ fontSize: '0.5rem', letterSpacing: '0.3em' }}>SHEETS</span>
          <span className="text-white/15">·</span>
          <span className="heading-condensed text-white/40" style={{ fontStyle: 'italic', fontSize: '0.7rem' }}>
            Admin only
          </span>
        </div>
      </div>

      {/* Side motifs */}
      <div className="fixed pointer-events-none z-[2]" style={{ top: '12%', left: '8%' }}>
        <BalletRibbon opacity={0.08} size={1} />
      </div>
      <div className="fixed pointer-events-none z-[2]" style={{ bottom: '12%', right: '8%' }}>
        <MagicSparkle opacity={0.12} size={1} count={5} />
      </div>

      {/* Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" aria-hidden>
        <span className="heading-display" style={{
          fontSize: 'clamp(12rem, 24vw, 22rem)',
          lineHeight: 0.8,
          fontStyle: 'italic',
          color: 'rgba(255,255,255,0.022)',
          letterSpacing: '-0.04em',
          transform: 'rotate(-4deg)',
        }}>
          冊
        </span>
      </div>

      {/* Top spotlight */}
      <div className="absolute pointer-events-none" style={{
        top: 0, left: '20%', right: '20%', height: '40%',
        background: 'radial-gradient(ellipse 70% 100% at 50% 0%, rgba(217,128,154,0.04) 0%, transparent 70%)',
      }} />

      {/* Main content */}
      <div className="absolute inset-0 flex flex-col" style={{
        paddingTop: 'clamp(80px, 9vw, 120px)',
        paddingBottom: 'clamp(60px, 6vh, 90px)',
        paddingLeft: '9%', paddingRight: '9%',
      }}>

        {/* Header — centered, like record section title */}
        <div className={`text-center mb-8 md:mb-10 ${mounted ? 'animate-fade-slide-up stagger-1' : 'opacity-0'}`}>
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="block h-px sketch-jitter-line" style={{
              width: 'clamp(40px, 8vw, 90px)',
              background: 'rgba(255,255,255,0.2)', filter: 'url(#sketchy)',
            }} />
            <span style={{
              color: '#D9809A', fontSize: '0.65rem',
              fontFamily: "'Playfair Display', serif", fontStyle: 'italic',
              letterSpacing: '0.15em', opacity: 0.7,
            }}>※</span>
            <span className="block h-px sketch-jitter-line" style={{
              width: 'clamp(40px, 8vw, 90px)',
              background: 'rgba(255,255,255,0.2)', filter: 'url(#sketchy)',
            }} />
          </div>
          <h1 className="heading-display" style={{
            fontSize: 'clamp(1.6rem, 3vw, 2.4rem)',
            color: 'rgba(255,255,255,0.92)',
            letterSpacing: '-0.01em', lineHeight: 1.1,
          }}>
            시트 리스트
          </h1>
          <p className="heading-condensed mt-2" style={{
            color: 'rgba(255,255,255,0.4)', fontStyle: 'italic',
            fontSize: 'clamp(0.88rem, 1.05vw, 0.98rem)', letterSpacing: '0.04em',
          }}>
            sheet list — 체크리스트, 외부 시트, 링크
          </p>
        </div>

        {/* Sheet grid */}
        <div className={`flex-1 overflow-y-auto pb-4 ${mounted ? 'animate-fade-slide-up stagger-2' : 'opacity-0'}`}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border border-white/10 border-t-white/40 rounded-full animate-spin" />
            </div>
          ) : sheets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 opacity-60">
              <span className="block h-px w-12" style={{ background: 'rgba(255,255,255,0.15)' }} />
              <p className="heading-condensed text-white/40" style={{ fontStyle: 'italic', fontSize: '0.95rem' }}>
                — No sheets yet —
              </p>
              <p className="text-white/25 text-xs" style={{ fontFamily: "'Pretendard Variable', sans-serif" }}>
                Add sheets from the admin panel.
              </p>
              <span className="block h-px w-12" style={{ background: 'rgba(255,255,255,0.15)' }} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
              {sheets.map((sheet, i) => (
                <SheetCard key={sheet.id} sheet={sheet} index={i} />
              ))}
            </div>
          )}
        </div>

        {/* Bottom nav to admin */}
        <div className={`mt-4 flex items-center justify-center gap-2 text-center ${mounted ? 'animate-fade-slide-up stagger-3' : 'opacity-0'}`}>
          <button onClick={() => router.push('/admin')}
            className="label-caps text-white/30 hover:text-white/60 transition-colors"
            style={{ fontSize: '0.5rem', letterSpacing: '0.3em' }}>
            ⟢ EDIT IN ADMIN
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className={`fixed bottom-3 left-0 right-0 z-[5] flex justify-between items-center ${mounted ? 'animate-fade-slide-up stagger-4' : 'opacity-0'}`}
        style={{ padding: '0 clamp(64px, 9vw, 100px)' }}>
        <span className="label-caps text-white/15" style={{ fontSize: '0.45rem', letterSpacing: '0.3em' }}>SOMBRE · ADMIN</span>
        <span className="heading-condensed text-white/25" style={{ fontStyle: 'italic', fontSize: '0.6rem' }}>Sheets</span>
      </div>
    </div>
  )
}

function SheetCard({ sheet, index }: { sheet: Sheet; index: number }) {
  const accent = '#D9809A'
  return (
    <div className="relative group sketch-jitter-line" style={{
      border: '1px solid rgba(255,255,255,0.1)',
      background: 'rgba(255,255,255,0.02)',
      padding: '18px 22px',
      filter: 'url(#sketchy)',
    }}>
      {/* Inner thin border */}
      <span className="absolute inset-1 pointer-events-none" style={{ border: '1px solid rgba(255,255,255,0.04)' }} />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="label-caps text-white/25 shrink-0" style={{ fontSize: '0.4rem', letterSpacing: '0.25em' }}>
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="heading-display truncate" style={{
              color: 'rgba(255,255,255,0.92)',
              fontSize: '1.05rem',
              fontStyle: 'italic',
              letterSpacing: '-0.005em',
            }}>
              {sheet.title || '(제목 없음)'}
            </h3>
          </div>
          {sheet.description && (
            <p className="text-white/40 mt-1 truncate" style={{
              fontSize: '0.78rem',
              fontFamily: "'Noto Serif KR', serif",
              lineHeight: 1.5,
            }}>
              {sheet.description}
            </p>
          )}
        </div>

        {sheet.url ? (
          <a href={sheet.url} target="_blank" rel="noreferrer"
            className="shrink-0 self-center label-caps transition-all hover:gap-2"
            style={{
              color: accent, opacity: 0.75,
              fontSize: '0.5rem', letterSpacing: '0.25em',
              padding: '8px 12px',
              border: `1px solid ${accent}40`,
              filter: 'url(#sketchy)',
            }}>
            바로가기 →
          </a>
        ) : (
          <span className="shrink-0 self-center label-caps text-white/15"
            style={{ fontSize: '0.5rem', letterSpacing: '0.25em' }}>
            (링크 없음)
          </span>
        )}
      </div>
    </div>
  )
}

function AccessDenied({ onBack }: { onBack: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black overflow-hidden text-white flex items-center justify-center">
      <div className="text-center max-w-sm px-8">
        <p className="label-caps text-white/30 mb-4" style={{ fontSize: '0.55rem', letterSpacing: '0.3em' }}>
          ⟢ RESTRICTED
        </p>
        <h2 className="heading-display mb-3" style={{
          fontSize: 'clamp(1.4rem, 2.5vw, 2rem)',
          color: 'rgba(255,255,255,0.85)',
          fontStyle: 'italic',
          letterSpacing: '-0.01em',
        }}>
          Admin only
        </h2>
        <p className="heading-condensed text-white/40 mb-8" style={{ fontStyle: 'italic', fontSize: '0.9rem' }}>
          메인 페이지에서 로그인해주세요.
        </p>
        <button onClick={onBack}
          className="label-caps text-white/40 hover:text-white/70 transition-colors"
          style={{ fontSize: '0.55rem', letterSpacing: '0.25em' }}>
          ← BACK TO STAGE
        </button>
      </div>
    </div>
  )
}
