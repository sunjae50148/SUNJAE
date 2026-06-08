'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { DialogueRecord, Phase, Section, DialogueLine, TRPGSession, TRPGLine, TRPGCharacter } from '@/lib/parseDialogue'
import SketchyFilter from '@/components/SketchyFilter'
import EdgeCurtain from '@/components/EdgeCurtain'
import { BalletRibbon, MagicSparkle } from '@/components/StageMotifs'

// ═══════════════════════════════════════
// 이미지 갤러리 모달
// ═══════════════════════════════════════
function ImageGalleryModal({
  images, initialIndex, onClose
}: {
  images: { src: string; speaker?: string }[]
  initialIndex: number
  onClose: () => void
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setCurrentIndex(prev => prev === 0 ? images.length - 1 : prev - 1)
      if (e.key === 'ArrowRight') setCurrentIndex(prev => prev === images.length - 1 ? 0 : prev + 1)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, images.length])

  const current = images[currentIndex]
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 max-w-[90vw] max-h-[90vh] flex items-center justify-center">
        <img src={current.src} alt={current.speaker || '이미지'} className="max-w-full max-h-[90vh] object-contain" />
      </div>
      <button onClick={onClose} className="absolute top-4 right-4 z-20 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white/80">✕</button>
      {images.length > 1 && (
        <>
          <button onClick={() => setCurrentIndex(prev => prev === 0 ? images.length - 1 : prev - 1)} className="absolute left-4 z-20 w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white/80">←</button>
          <button onClick={() => setCurrentIndex(prev => prev === images.length - 1 ? 0 : prev + 1)} className="absolute right-4 z-20 w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white/80">→</button>
        </>
      )}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full">
        <p className="text-white/80 text-sm">
          {current.speaker && <span className="text-white/60">{current.speaker}</span>}
          {images.length > 1 && <span className="text-white/50 ml-2">{currentIndex + 1} / {images.length}</span>}
        </p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// 역극 대화 말풍선
// ═══════════════════════════════════════
function DialogueBubble({ line, manonAvatar, dylanAvatar, onImageClick }: { line: DialogueLine; manonAvatar?: string; dylanAvatar?: string; onImageClick?: (imageIndex: number) => void }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const isDylan = line.speaker.includes('사드함') || line.speaker.includes('Dylan') || line.speaker.includes('딜런')
  const isManon = line.speaker.includes('메디아') || line.speaker.includes('Manon') || line.speaker.includes('마농')
  const isRight = isDylan
  const images = line.images || []
  const avatar = isDylan ? dylanAvatar : isManon ? manonAvatar : undefined
  const dylanColor = '#C8C8C8'   // grayscale
  const manonColor = '#D9809A'   // ballet pink

  return (
    <div className={`flex gap-2.5 mb-3 ${isRight ? 'flex-row-reverse' : 'flex-row'}`}>
      {avatar ? (
        <img src={avatar} alt={line.speaker} className="w-8 h-8 rounded-full object-cover shrink-0" />
      ) : (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] shrink-0"
          style={{
            backgroundColor: isDylan ? 'rgba(200,200,200,0.08)' : isManon ? 'rgba(217,128,154,0.1)' : 'rgba(255,255,255,0.05)',
            color: isDylan ? dylanColor : isManon ? manonColor : 'rgba(255,255,255,0.4)',
            border: `1px solid ${isDylan ? 'rgba(200,200,200,0.25)' : isManon ? 'rgba(217,128,154,0.25)' : 'rgba(255,255,255,0.1)'}`,
            fontFamily: "'Playfair Display', serif", fontStyle: 'italic',
          }}
        >
          {isDylan ? 'D' : isManon ? 'M' : '?'}
        </div>
      )}
      <div className="max-w-[80%]">
        <div className={`mb-0.5 ${isRight ? 'text-right' : 'text-left'}`}>
          <span className="text-[10px] font-medium" style={{ color: isDylan ? dylanColor : isManon ? manonColor : 'rgba(255,255,255,0.4)' }}>
            {line.speaker}
          </span>
        </div>
        <div
          className="px-3.5 py-2.5 rounded-2xl"
          style={{
            backgroundColor: isDylan ? 'rgba(200,200,200,0.04)' : isManon ? 'rgba(217,128,154,0.05)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${isDylan ? 'rgba(200,200,200,0.12)' : isManon ? 'rgba(217,128,154,0.12)' : 'rgba(255,255,255,0.06)'}`,
            borderTopRightRadius: isRight ? '4px' : undefined,
            borderTopLeftRadius: !isRight ? '4px' : undefined,
          }}
        >
          {images.length > 0 && (
            <div className="mb-2 relative">
              <img src={images[currentImageIndex]} alt={`${line.speaker}의 이미지`} className="rounded-lg max-w-full cursor-pointer hover:opacity-90 transition-opacity" onClick={() => onImageClick?.(currentImageIndex)} />
              {images.length > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full">
                  <button onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(p => p === 0 ? images.length - 1 : p - 1) }} className="text-white/80 hover:text-white text-sm">←</button>
                  <span className="text-white/60 text-xs">{currentImageIndex + 1} / {images.length}</span>
                  <button onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(p => p === images.length - 1 ? 0 : p + 1) }} className="text-white/80 hover:text-white text-sm">→</button>
                </div>
              )}
            </div>
          )}
          {line.text && <p className="text-white/80 text-[13px] font-accent leading-relaxed tracking-[-0.02em] whitespace-pre-wrap">{line.text}</p>}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// TRPG 말풍선
// ═══════════════════════════════════════
function TRPGBubble({ line, characters, onImageClick }: { line: TRPGLine; characters: TRPGCharacter[]; onImageClick?: (imageIndex: number) => void }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const character = characters.find(c => c.name === line.speaker)
  const color = character?.color || '#666666'
  const avatar = character?.avatar
  const isPC = character?.isPC
  const isRight = isPC
  const images = line.images || []

  // ── 내레이션 ──
  if (line.type === 'narration') {
    return (
      <div className="my-3 px-4 py-2 text-center">
        {images.length > 0 && (
          <div className="mb-2 flex justify-center">
            <img src={images[0]} alt="" className="rounded-lg max-w-full max-h-[300px] cursor-pointer hover:opacity-90 transition-opacity" onClick={() => onImageClick?.(0)} />
          </div>
        )}
        {line.text && <p className="text-white/45 text-xs italic leading-relaxed" dangerouslySetInnerHTML={{ __html: line.text }} />}
      </div>
    )
  }

  // ── emote ──
  if (line.type === 'emote') {
    return (
      <div className="my-3 px-6 py-2 text-center">
        <p className="text-white/55 text-xs italic leading-relaxed" style={{ fontFamily: '"Noto Serif KR", serif' }}>
          {line.text}
        </p>
      </div>
    )
  }

  // ── CoC 판정 주사위 ──
  if (line.type === 'roll' && line.rollData) {
    const { skillName, target, rolled, result, rolledAll, bonusResults } = line.rollData
    const resultColors: Record<string, string> = { critical: 'bg-yellow-500', extreme: 'bg-green-500', hard: 'bg-green-400', success: 'bg-blue-400', fail: 'bg-red-500', fumble: 'bg-red-700' }
    const resultTexts: Record<string, string> = { critical: '대성공', extreme: '극단적 성공', hard: '어려운 성공', success: '성공', fail: '실패', fumble: '대실패' }
    const sortedBonus = bonusResults ? [...bonusResults].sort((a, b) => b.bonus - a.bonus) : null
    return (
      <div className="my-2 flex justify-center">
        <div className="bg-white/[0.04] border border-white/10 rounded-lg p-2.5 min-w-[180px]">
          <div className="text-center text-white/50 text-[10px] mb-1">{line.speaker}</div>
          <div className="text-center text-white/85 font-medium text-sm mb-1.5">{skillName}</div>
          <div className="flex items-center justify-center gap-4 text-xs">
            <span className="text-white/45">목표: {target}</span>
            {rolledAll && rolledAll.length > 1 ? (
              <span className="text-white/85 font-bold">{rolledAll.join(', ')}</span>
            ) : (
              <span className="text-white/85 font-bold">{rolled}</span>
            )}
          </div>
          {sortedBonus ? (
            <div className="mt-2 space-y-0.5">
              {sortedBonus.map(({ bonus, result: r }) => (
                <div key={bonus} className="flex items-center gap-2 text-[10px]">
                  <span className="text-white/40 w-7 text-right tabular-nums">{bonus > 0 ? `+${bonus}` : bonus}:</span>
                  <span className={`flex-1 text-center text-white py-0.5 px-2 rounded ${resultColors[r]}`}>{resultTexts[r]}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className={`mt-1.5 text-center text-white text-[10px] py-0.5 px-2 rounded ${resultColors[result]}`}>{resultTexts[result]}</div>
          )}
        </div>
      </div>
    )
  }

  // ── 주사위 굴림 (rollresult) ──
  if (line.type === 'diceroll' && line.diceData) {
    const { formula, dice, total } = line.diceData
    const sideColors: Record<number, string> = { 3: '#16a085', 4: '#e67e22', 6: '#3498db', 8: '#9b59b6', 10: '#1abc9c', 12: '#e74c3c', 20: '#f39c12', 100: '#2c3e50' }
    return (
      <div className="my-2 flex justify-center">
        <div className="bg-white/[0.04] border border-white/10 rounded-lg p-2.5 min-w-[140px]">
          {line.speaker && <div className="text-center text-white/50 text-[10px] mb-1">{line.speaker}</div>}
          <div className="text-center text-white/45 text-[10px] mb-1.5">{formula}</div>
          <div className="flex items-center justify-center gap-1.5 flex-wrap mb-1.5">
            {dice.map((d, i) => (
              <span key={i} className="inline-flex items-center justify-center w-7 h-7 rounded text-white text-xs font-bold"
                style={{
                  backgroundColor: d.crit === 'fail' ? '#c0392b' : d.crit === 'success' ? '#27ae60' : (sideColors[d.sides] || '#555'),
                  boxShadow: d.crit ? `0 0 6px ${d.crit === 'fail' ? 'rgba(192,57,43,0.5)' : 'rgba(39,174,96,0.5)'}` : undefined
                }}>
                {d.value}
              </span>
            ))}
          </div>
          <div className="text-center text-white/85 font-bold text-lg">{total}</div>
        </div>
      </div>
    )
  }

  // ── 광기의 발작 ──
  if (line.type === 'madness' && line.madnessData) {
    const { title, effectName, effectDesc, rounds, duration } = line.madnessData
    return (
      <div className="my-3 flex justify-center">
        <div className="bg-red-950/40 border border-red-500/30 rounded-lg p-3 min-w-[220px] max-w-[340px]">
          <div className="text-center text-red-300/80 text-[10px] font-bold mb-1">{line.speaker}</div>
          <div className="text-center text-red-300 font-bold text-sm mb-2">{title}</div>
          {effectName && <div className="text-center text-red-400 text-xs font-bold mb-1">{effectName}</div>}
          {effectDesc && <p className="text-red-300/70 text-[11px] leading-relaxed text-center mb-2">{effectDesc}</p>}
          <div className="flex items-center justify-center gap-3 text-[10px] text-red-300/60">
            {rounds != null && <span>라운드: {rounds}</span>}
            {duration != null && <span>지속시간: {duration}h</span>}
          </div>
        </div>
      </div>
    )
  }

  // ── 시스템 ──
  if (line.type === 'system') {
    return (
      <div className="my-2 flex justify-center">
        <div className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5">
          <p className="text-white/55 text-xs text-center" dangerouslySetInnerHTML={{ __html: line.text }} />
        </div>
      </div>
    )
  }

  // ── 일반 대사 ──
  return (
    <div className={`flex gap-2.5 mb-3 ${isRight ? 'flex-row-reverse' : 'flex-row'}`}>
      {avatar ? (
        <img src={avatar} alt={line.speaker || ''} className="w-8 h-8 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0" style={{ backgroundColor: `${color}15`, color }}>
          {line.speaker?.charAt(0) || '?'}
        </div>
      )}
      <div className="max-w-[80%]">
        <div className={`mb-0.5 ${isRight ? 'text-right' : 'text-left'}`}>
          <span className="text-[10px] font-medium" style={{ color }}>{line.speaker}</span>
        </div>
        <div className="px-3.5 py-2.5 rounded-2xl" style={{ backgroundColor: `${color}14`, border: `1px solid ${color}22`, borderTopRightRadius: isRight ? '4px' : undefined, borderTopLeftRadius: !isRight ? '4px' : undefined }}>
          {images.length > 0 && (
            <div className="mb-2 relative">
              <img src={images[currentImageIndex]} alt={`${line.speaker}의 이미지`} className="rounded-lg max-w-full cursor-pointer hover:opacity-90 transition-opacity" onClick={() => onImageClick?.(currentImageIndex)} />
              {images.length > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full">
                  <button onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(p => p === 0 ? images.length - 1 : p - 1) }} className="text-white/80 hover:text-white text-sm">←</button>
                  <span className="text-white/60 text-xs">{currentImageIndex + 1} / {images.length}</span>
                  <button onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(p => p === images.length - 1 ? 0 : p + 1) }} className="text-white/80 hover:text-white text-sm">→</button>
                </div>
              )}
            </div>
          )}
          {line.text && <p className="text-white/80 text-[13px] font-accent leading-relaxed tracking-[-0.02em] whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: line.text }} />}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// 빈 상태 컴포넌트
// ═══════════════════════════════════════
function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 opacity-60">
      <span className="block h-px w-12" style={{ background: 'rgba(255,255,255,0.15)' }} />
      <p className="heading-condensed text-white/40 text-sm tracking-wide" style={{ fontStyle: 'italic' }}>
        {text}
      </p>
      <span className="block h-px w-12" style={{ background: 'rgba(255,255,255,0.15)' }} />
    </div>
  )
}

// ═══════════════════════════════════════
// 메뉴 아이템
// ═══════════════════════════════════════
const menuItems = [
  { href: '/', label: '서장', chapter: 'CHAPTER ONE', en: 'Prologue', page: '01' },
  { href: '/character', label: '캐릭터', chapter: 'CHAPTER TWO', en: 'Characters', page: '03' },
  { href: '/record', label: '기록', chapter: 'CHAPTER THREE', en: 'Records', page: '05' },
  { href: '/timeline', label: '연대기', chapter: 'CHAPTER FOUR', en: 'Timeline', page: '07' },
]

// ═══════════════════════════════════════
// 메인 Record 페이지
// ═══════════════════════════════════════
export default function RecordPage() {
  const [activeTab, setActiveTab] = useState<'roleplay' | 'trpg'>('roleplay')
  const [records, setRecords] = useState<DialogueRecord[]>([])
  const [selectedRecord, setSelectedRecord] = useState<DialogueRecord | null>(null)
  const [selectedPhase, setSelectedPhase] = useState<Phase | null>(null)
  const [selectedSection, setSelectedSection] = useState<Section | null>(null)

  const [trpgSessions, setTrpgSessions] = useState<TRPGSession[]>([])
  const [selectedTRPGSession, setSelectedTRPGSession] = useState<TRPGSession | null>(null)

  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  const [galleryImages, setGalleryImages] = useState<{ src: string; speaker?: string }[]>([])
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [showGallery, setShowGallery] = useState(false)

  const [unlockedSections, setUnlockedSections] = useState<Set<string>>(new Set())
  const [pendingSection, setPendingSection] = useState<Section | null>(null)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState(false)

  const dialogueScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    Promise.all([
      fetch('/api/records', { cache: 'no-store' }).then(r => r.json()).catch(() => []),
      fetch('/api/trpg', { cache: 'no-store' }).then(r => r.json()).catch(() => []),
    ]).then(([recordsData, trpgData]) => {
      if (Array.isArray(recordsData)) {
        setRecords(recordsData)
        if (recordsData.length > 0) {
          const first = recordsData[0]
          setSelectedRecord(first)
          if (first.phases?.length > 0) {
            setSelectedPhase(first.phases[0])
            if (first.phases[0].sections?.length > 0) {
              const firstUnlocked = first.phases[0].sections.find((s: Section) => !s.password)
              setSelectedSection(firstUnlocked || null)
            }
          }
        }
      }
      if (Array.isArray(trpgData)) {
        setTrpgSessions(trpgData)
        if (trpgData.length > 0) {
          const firstUnlocked = trpgData.find((s: any) => !s.password)
          setSelectedTRPGSession(firstUnlocked || null)
        }
      }
    }).finally(() => setLoading(false))
  }, [])

  const [pendingTRPG, setPendingTRPG] = useState<TRPGSession | null>(null)

  // 잠금 안 된 첫 번째 섹션 찾기 (없으면 null)
  const findFirstOpen = (sections: Section[]) =>
    sections.find(s => !s.password || unlockedSections.has(s.id)) || null

  // pending 상태 초기화
  const clearPending = () => {
    setPendingSection(null)
    setPendingTRPG(null)
    setPasswordInput('')
    setPasswordError(false)
  }

  const handleRecordChange = (record: DialogueRecord) => {
    clearPending()
    setSelectedRecord(record)
    const phase = record.phases?.[0] || null
    setSelectedPhase(phase)
    setSelectedSection(phase ? findFirstOpen(phase.sections || []) : null)
  }

  const handlePhaseChange = (phase: Phase) => {
    clearPending()
    setSelectedPhase(phase)
    setSelectedSection(findFirstOpen(phase.sections || []))
  }

  const handleSectionChange = (section: Section) => {
    if (section.password && !unlockedSections.has(section.id)) {
      setPendingTRPG(null)
      setPendingSection(section)
      setPasswordInput('')
      setPasswordError(false)
      return
    }
    clearPending()
    setSelectedSection(section)
    dialogueScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleTRPGSessionChange = (session: TRPGSession) => {
    if (session.password && !unlockedSections.has(session.id)) {
      setPendingSection(null)
      setPendingTRPG(session)
      setPasswordInput('')
      setPasswordError(false)
      return
    }
    clearPending()
    setSelectedTRPGSession(session)
  }

  const handlePasswordSubmit = () => {
    if (pendingSection) {
      if (passwordInput === pendingSection.password) {
        setUnlockedSections(prev => { const next = new Set(Array.from(prev)); next.add(pendingSection.id); return next })
        setSelectedSection(pendingSection)
        clearPending()
        dialogueScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        setPasswordError(true)
      }
    } else if (pendingTRPG) {
      if (passwordInput === pendingTRPG.password) {
        setUnlockedSections(prev => { const next = new Set(Array.from(prev)); next.add(pendingTRPG.id); return next })
        setSelectedTRPGSession(pendingTRPG)
        clearPending()
      } else {
        setPasswordError(true)
      }
    }
  }

  const handleImageClick = (lines: DialogueLine[] | TRPGLine[], lineIndex: number, imageIndex: number) => {
    const allImages: { src: string; speaker?: string }[] = []
    let clickedGlobalIndex = 0
    let currentGlobalIndex = 0
    lines.forEach((line, lIdx) => {
      if (line.images) {
        line.images.forEach((img, imgIdx) => {
          allImages.push({ src: img, speaker: line.speaker })
          if (lIdx === lineIndex && imgIdx === imageIndex) clickedGlobalIndex = currentGlobalIndex
          currentGlobalIndex++
        })
      }
    })
    setGalleryImages(allImages)
    setGalleryIndex(clickedGlobalIndex)
    setShowGallery(true)
  }

  // 현재 표시할 콘텐츠
  const currentSectionTitle = activeTab === 'roleplay'
    ? selectedSection?.title || ''
    : selectedTRPGSession?.title || ''

  const ACCENT = '#D9809A'      // Manon — ballet pink
  const TRPG_ACCENT = '#C8C8C8' // Dylan — grayscale

  return (
    <div className="fixed inset-0 z-[60] bg-black overflow-hidden text-white">
      <SketchyFilter />
      <EdgeCurtain side="left" />
      <EdgeCurtain side="right" />

      {/* ═══ Subtle motifs in corners ═══ */}
      <div className="fixed pointer-events-none z-[2]" style={{ top: '8%', right: '10%' }}>
        {activeTab === 'roleplay'
          ? <BalletRibbon opacity={0.1} size={1.4} />
          : <MagicSparkle opacity={0.18} size={1.4} count={6} />}
      </div>
      <div className="fixed pointer-events-none z-[2]" style={{ bottom: '6%', right: '4%' }}>
        {activeTab === 'roleplay'
          ? <MagicSparkle opacity={0.1} size={0.9} count={4} />
          : <BalletRibbon opacity={0.06} size={1} />}
      </div>

      {/* ═══ Sketchy frame lines ═══ */}
      <div className="fixed pointer-events-none z-[3] sketch-jitter-line" style={{ top: 'clamp(28px, 3vw, 48px)', left: '7%', right: '7%', height: '1px', background: 'rgba(255,255,255,0.12)', filter: 'url(#sketchy)' }} />
      <div className="fixed pointer-events-none z-[3] sketch-jitter-line" style={{ bottom: 'clamp(28px, 3vw, 48px)', left: '7%', right: '7%', height: '1px', background: 'rgba(255,255,255,0.12)', filter: 'url(#sketchy)' }} />
      <div className="fixed pointer-events-none z-[3] sketch-jitter-line" style={{ left: 'clamp(220px, 24vw, 300px)', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.15)', filter: 'url(#sketchy)' }} />

      {/* ═══ 햄버거 메뉴 버튼 ═══ */}
      <button
        onClick={() => setMenuOpen(true)}
        className="fixed top-5 z-[80] w-9 h-9 flex flex-col items-center justify-center gap-[5px] group"
        style={{ right: 'calc(7% + 16px)' }}
        aria-label="Menu"
      >
        <span className="block w-5 h-px bg-white/40 group-hover:bg-white/80 transition-colors" />
        <span className="block w-5 h-px bg-white/40 group-hover:bg-white/80 transition-colors" />
        <span className="block w-5 h-px bg-white/40 group-hover:bg-white/80 transition-colors" />
      </button>

      {/* ═══ 챕터 메뉴 오버레이 ═══ */}
      {menuOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-[#141414]/95 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-lg px-8" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setMenuOpen(false)} className="absolute -top-12 right-0 text-white/30 hover:text-white/70 transition-colors label-caps" style={{ fontSize: '0.55rem', letterSpacing: '0.2em' }}>CLOSE</button>
            <div className="mb-12 text-center">
              <span className="label-caps text-white/15" style={{ fontSize: '0.5rem', letterSpacing: '0.25em' }}>TABLE OF CONTENTS</span>
            </div>
            <div className="space-y-0">
              {menuItems.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="group block py-5 border-b border-white/[0.06] first:border-t transition-colors hover:bg-white/[0.02]">
                  <div className="flex items-baseline justify-between gap-6">
                    <div className="flex items-baseline gap-5">
                      <span className="label-caps text-white/15 shrink-0" style={{ fontSize: '0.45rem', letterSpacing: '0.15em', minWidth: '1.5rem' }}>{item.page}</span>
                      <div>
                        <span className="heading-condensed text-white/25 text-xs" style={{ fontStyle: 'italic', letterSpacing: '0.08em' }}>{item.chapter}</span>
                        <h3 className="heading-display text-[clamp(1.3rem,3vw,1.8rem)] text-white/80 group-hover:text-white transition-colors leading-tight mt-1">{item.label}</h3>
                      </div>
                    </div>
                    <span className="heading-condensed text-white/15 text-sm shrink-0" style={{ fontStyle: 'italic' }}>{item.en}</span>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-12 text-center">
              <span className="label-caps text-white/10" style={{ fontSize: '0.45rem', letterSpacing: '0.2em' }}>SOMBRE</span>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 메인 레이아웃 ═══ */}
      <div className="h-full flex relative z-[10]">

        {/* ═══ 왼쪽: 목차 사이드바 ═══ */}
        <div className="shrink-0 h-full flex flex-col overflow-hidden relative" style={{
          width: 'clamp(220px, 24vw, 300px)',
          paddingLeft: '7%',
          backgroundColor: 'rgba(0,0,0,0.5)',
        }}>

          {/* 상단 */}
          <div className="px-7 pb-5" style={{ paddingTop: 'clamp(40px, 5vw, 64px)' }}>

            {/* CHAPTER 라벨 */}
            <div className={`mb-6 ${mounted ? 'animate-fade-slide-up' : 'opacity-0'}`}>
              <span className="label-caps text-white/20 block" style={{ fontSize: '0.45rem', letterSpacing: '0.25em' }}>
                CHAPTER · III
              </span>
              <h2 className="heading-display text-white/85 mt-2" style={{
                fontSize: 'clamp(1.5rem, 2.6vw, 2rem)',
                lineHeight: 0.95, letterSpacing: '-0.02em',
              }}>
                Records
              </h2>
              <p className="heading-condensed text-white/25 mt-1" style={{ fontStyle: 'italic', fontSize: '0.7rem' }}>
                기록
              </p>
            </div>

            {/* 가는 구분선 */}
            <div className="sketch-jitter-line h-px mb-5" style={{ background: 'rgba(255,255,255,0.1)', filter: 'url(#sketchy)' }} />

            {/* 탭 셀렉터 — Act I / Act II 느낌 */}
            <div className={`flex items-center gap-4 mb-5 ${mounted ? 'animate-fade-slide-up stagger-1' : 'opacity-0'}`}>
              <button onClick={() => setActiveTab('roleplay')} className="group flex flex-col items-start transition-all">
                <span className="label-caps" style={{ fontSize: '0.4rem', letterSpacing: '0.2em', color: activeTab === 'roleplay' ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)' }}>ACT I</span>
                <span className="heading-condensed text-sm mt-0.5" style={{ fontStyle: 'italic', color: activeTab === 'roleplay' ? ACCENT : 'rgba(255,255,255,0.2)', transition: 'color 0.3s' }}>
                  Roleplay
                </span>
              </button>
              <span className="text-white/10 text-xs select-none mt-3">·</span>
              <button onClick={() => setActiveTab('trpg')} className="group flex flex-col items-start transition-all">
                <span className="label-caps" style={{ fontSize: '0.4rem', letterSpacing: '0.2em', color: activeTab === 'trpg' ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)' }}>ACT II</span>
                <span className="heading-condensed text-sm mt-0.5" style={{ fontStyle: 'italic', color: activeTab === 'trpg' ? TRPG_ACCENT : 'rgba(255,255,255,0.2)', transition: 'color 0.3s' }}>
                  TRPG
                </span>
              </button>
            </div>

            {/* 레코드 선택 (여러 개일 때) */}
            {activeTab === 'roleplay' && records.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {records.map((r) => (
                  <button key={r.id} onClick={() => handleRecordChange(r)}
                    className="heading-condensed text-xs transition-colors"
                    style={{ fontStyle: 'italic', color: selectedRecord?.id === r.id ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)' }}>
                    {r.title}
                  </button>
                ))}
              </div>
            )}

            {/* 페이즈 — 작은 점 마커와 함께 */}
            {activeTab === 'roleplay' && selectedRecord && selectedRecord.phases.length > 0 && (
              <div className={`flex items-center gap-3 mt-2 ${mounted ? 'animate-fade-slide-up stagger-2' : 'opacity-0'}`}>
                {selectedRecord.phases.map((p, pi) => {
                  const active = selectedPhase?.id === p.id
                  return (
                    <button key={p.id} onClick={() => handlePhaseChange(p)}
                      className="flex items-center gap-1.5 transition-colors">
                      <span className="block rounded-full transition-all" style={{
                        width: active ? '4px' : '3px', height: active ? '4px' : '3px',
                        background: active ? ACCENT : 'rgba(255,255,255,0.15)',
                      }} />
                      <span className="label-caps" style={{
                        fontSize: '0.42rem', letterSpacing: '0.15em',
                        color: active ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)',
                      }}>{p.name}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* 목차 리스트 — Scene I, Scene II ... */}
          <div className={`flex-1 overflow-y-auto px-7 pb-4 ${mounted ? 'animate-fade-slide-up stagger-3' : 'opacity-0'}`}>
            <div className="label-caps text-white/15 mb-3" style={{ fontSize: '0.4rem', letterSpacing: '0.25em' }}>
              {activeTab === 'roleplay' ? 'SCENES' : 'SESSIONS'}
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-5 h-5 border border-white/10 border-t-white/30 rounded-full animate-spin" />
              </div>
            ) : activeTab === 'roleplay' ? (
              selectedPhase && selectedPhase.sections.length > 0 ? (
                <div className="space-y-0">
                  {selectedPhase.sections.map((section, i) => {
                    const isActive = selectedSection?.id === section.id
                    return (
                      <button key={section.id} onClick={() => handleSectionChange(section)}
                        className="group relative block w-full text-left py-3 transition-colors">
                        {/* Active indicator: vertical line on left */}
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 transition-all" style={{
                          width: isActive ? '2px' : '0px', height: isActive ? '60%' : '0%',
                          background: ACCENT,
                        }} />
                        <div className="flex items-baseline gap-2.5 pl-2">
                          <span className="heading-condensed shrink-0" style={{
                            fontStyle: 'italic',
                            fontSize: '0.7rem',
                            color: isActive ? ACCENT : 'rgba(255,255,255,0.2)',
                            transition: 'color 0.3s',
                            minWidth: '2rem',
                          }}>
                            {`Sc.${String(i + 1).padStart(2, '0')}`}
                          </span>
                          <span className={`heading-condensed text-[13px] leading-snug transition-all ${isActive ? 'text-white/85' : 'text-white/30 group-hover:text-white/55'}`} style={{ fontStyle: 'italic' }}>
                            {section.password && !unlockedSections.has(section.id) && (
                              <span style={{ fontStyle: 'normal', marginRight: '4px', fontSize: '0.6rem' }}>🔒</span>
                            )}
                            {section.title}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="heading-condensed text-white/15 text-sm pt-4" style={{ fontStyle: 'italic' }}>
                  {records.length === 0 ? 'No records yet.' : 'No sections.'}
                </p>
              )
            ) : (
              trpgSessions.length > 0 ? (
                <div className="space-y-0">
                  {trpgSessions.map((session, i) => {
                    const isActive = selectedTRPGSession?.id === session.id
                    return (
                      <button key={session.id} onClick={() => handleTRPGSessionChange(session)}
                        className="group relative block w-full text-left py-3 transition-colors">
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 transition-all" style={{
                          width: isActive ? '2px' : '0px', height: isActive ? '60%' : '0%',
                          background: TRPG_ACCENT,
                        }} />
                        <div className="flex items-baseline gap-2.5 pl-2">
                          <span className="heading-condensed shrink-0" style={{
                            fontStyle: 'italic',
                            fontSize: '0.7rem',
                            color: isActive ? TRPG_ACCENT : 'rgba(255,255,255,0.2)',
                            transition: 'color 0.3s',
                            minWidth: '2rem',
                          }}>
                            {`Ss.${String(i + 1).padStart(2, '0')}`}
                          </span>
                          <div>
                            <span className={`heading-condensed text-[13px] leading-snug transition-all block ${isActive ? 'text-white/85' : 'text-white/30 group-hover:text-white/55'}`} style={{ fontStyle: 'italic' }}>
                              {session.password && !unlockedSections.has(session.id) && (
                                <span style={{ fontStyle: 'normal', marginRight: '4px', fontSize: '0.6rem' }}>🔒</span>
                              )}
                              {session.title}
                            </span>
                            {session.date && <span className="text-white/15 text-[10px] mt-0.5 block">{session.date}</span>}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="heading-condensed text-white/15 text-sm pt-4" style={{ fontStyle: 'italic' }}>No sessions yet.</p>
              )
            )}
          </div>

          {/* 하단: 페이지 번호 + 장식 */}
          <div className="px-7 py-5 sketch-jitter-line" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', filter: 'url(#sketchy)' }}>
            <div className="flex items-center justify-between">
              <span className="label-caps text-white/15" style={{ fontSize: '0.45rem', letterSpacing: '0.25em' }}>P · 05</span>
              <span className="text-white/15" style={{ fontSize: '0.6rem', fontStyle: 'italic', fontFamily: "'Playfair Display', serif" }}>※</span>
            </div>
          </div>
        </div>

        {/* ═══ 오른쪽: 본문 ═══ */}
        <div className="flex-1 flex flex-col overflow-hidden relative">

          {/* 배경 워터마크 — 거대한 흐릿한 글자 */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" aria-hidden>
            <span className="heading-display" style={{
              fontSize: 'clamp(12rem, 24vw, 22rem)',
              lineHeight: 0.8,
              fontStyle: 'italic',
              color: 'rgba(255,255,255,0.025)',
              letterSpacing: '-0.04em',
              transform: 'rotate(-4deg)',
            }}>
              {activeTab === 'roleplay' ? '記' : '骰'}
            </span>
          </div>

          {/* 상단 스포트라이트 그라데이션 */}
          <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{
            height: '40%',
            background: `radial-gradient(ellipse 80% 100% at 50% 0%, ${activeTab === 'roleplay' ? 'rgba(217,128,154,0.04)' : 'rgba(166,184,204,0.04)'} 0%, transparent 70%)`,
          }} />

          {/* 상단: 섹션 제목 — 중앙 정렬, 양쪽 장식선 */}
          <div className="relative px-10 md:px-16 lg:px-20 pt-8 md:pt-12 shrink-0">
            {currentSectionTitle ? (
              <div className={`text-center ${mounted ? 'animate-fade-slide-up stagger-2' : 'opacity-0'}`}>
                <div className="flex items-center justify-center gap-4 mb-3">
                  <span className="block h-px sketch-jitter-line" style={{
                    width: 'clamp(40px, 8vw, 90px)',
                    background: 'rgba(255,255,255,0.2)',
                    filter: 'url(#sketchy)',
                  }} />
                  <span className="label-caps shrink-0" style={{
                    fontSize: '0.45rem', letterSpacing: '0.3em',
                    color: activeTab === 'roleplay' ? ACCENT : TRPG_ACCENT, opacity: 0.5,
                  }}>
                    {activeTab === 'roleplay'
                      ? (selectedPhase?.name ?? 'SCENE')
                      : (selectedTRPGSession?.date ?? 'SESSION')}
                  </span>
                  <span className="block h-px sketch-jitter-line" style={{
                    width: 'clamp(40px, 8vw, 90px)',
                    background: 'rgba(255,255,255,0.2)',
                    filter: 'url(#sketchy)',
                  }} />
                </div>
                <h2 className="heading-display leading-tight" style={{
                  color: activeTab === 'roleplay' ? ACCENT : TRPG_ACCENT,
                  fontSize: 'clamp(1.4rem, 2.6vw, 2rem)',
                  letterSpacing: '-0.01em',
                }}>
                  {currentSectionTitle}
                </h2>
                <span className="block mx-auto mt-3 sketch-jitter-line" style={{
                  width: '3px', height: '3px', borderRadius: '50%',
                  background: activeTab === 'roleplay' ? ACCENT : TRPG_ACCENT,
                  opacity: 0.4, filter: 'url(#sketchy)',
                }} />
              </div>
            ) : null}
          </div>

          {/* 대화 본문 (스크롤) */}
          <div ref={dialogueScrollRef} className={`relative flex-1 overflow-y-auto min-h-0 px-10 md:px-16 lg:px-20 py-8 ${mounted ? 'animate-fade-slide-up stagger-3' : 'opacity-0'}`}>
            {(pendingSection || pendingTRPG) ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-full max-w-xs text-center">
                  <h3 style={{
                    marginBottom: '6px',
                    color: 'rgba(255,255,255,0.85)', fontSize: '0.95rem',
                    fontFamily: "'Playfair Display', serif", fontStyle: 'italic',
                  }}>{pendingSection?.title || pendingTRPG?.title}</h3>
                  <p style={{
                    marginBottom: '24px',
                    color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem',
                    fontFamily: "'Pretendard Variable', sans-serif", letterSpacing: '0.15em',
                  }}>비밀번호를 입력하세요</p>
                  <input
                    type="password"
                    placeholder="Password"
                    value={passwordInput}
                    onChange={e => { setPasswordInput(e.target.value); setPasswordError(false) }}
                    onKeyDown={e => { if (e.key === 'Enter') handlePasswordSubmit() }}
                    autoFocus
                    style={{
                      width: '100%', background: 'transparent',
                      border: `1px solid ${passwordError ? 'rgba(255,100,100,0.5)' : 'rgba(255,255,255,0.1)'}`,
                      padding: '12px 16px', color: 'white', fontSize: '0.85rem',
                      textAlign: 'center', outline: 'none',
                      fontFamily: "'Pretendard Variable', sans-serif",
                      transition: 'border-color 0.2s',
                    }}
                  />
                  {passwordError && (
                    <p style={{ color: 'rgba(255,100,100,0.7)', fontSize: '0.72rem', marginTop: '8px',
                      fontFamily: "'Pretendard Variable', sans-serif" }}>
                      비밀번호가 틀렸습니다
                    </p>
                  )}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => { setPendingSection(null); setPendingTRPG(null); setPasswordInput(''); setPasswordError(false) }}
                      style={{
                        flex: 1, padding: '10px', background: 'transparent', cursor: 'pointer',
                        border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.35)',
                        fontSize: '0.78rem', fontFamily: "'Pretendard Variable', sans-serif", letterSpacing: '0.1em',
                      }}>취소</button>
                    <button
                      onClick={handlePasswordSubmit}
                      style={{
                        flex: 1, padding: '10px', background: 'transparent', cursor: 'pointer',
                        border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)',
                        fontSize: '0.78rem', fontFamily: "'Pretendard Variable', sans-serif", letterSpacing: '0.1em',
                      }}>확인</button>
                  </div>
                </div>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border border-white/10 border-t-white/40 rounded-full animate-spin" />
              </div>
            ) : activeTab === 'roleplay' ? (
              selectedSection ? (
                selectedSection.lines.length === 0 ? (
                  <p className="text-white/30 text-center py-10 heading-condensed" style={{ fontStyle: 'italic' }}>Empty.</p>
                ) : (
                  <div className="space-y-0.5 max-w-2xl mx-auto">
                    {selectedSection.lines.map((line, index) => (
                      <DialogueBubble key={line.id} line={line} manonAvatar={selectedSection?.manonAvatar} dylanAvatar={selectedSection?.dylanAvatar} onImageClick={(imageIndex) => handleImageClick(selectedSection.lines, index, imageIndex)} />
                    ))}
                    {/* 막 내림 표시 */}
                    <div className="flex items-center justify-center gap-3 py-10 opacity-40">
                      <span className="block h-px w-8" style={{ background: 'rgba(255,255,255,0.25)' }} />
                      <span className="label-caps text-white/30" style={{ fontSize: '0.45rem', letterSpacing: '0.3em' }}>FIN</span>
                      <span className="block h-px w-8" style={{ background: 'rgba(255,255,255,0.25)' }} />
                    </div>
                  </div>
                )
              ) : (
                <EmptyState text={records.length === 0 ? 'No records yet.' : 'Select a scene to read.'} />
              )
            ) : (
              selectedTRPGSession ? (
                selectedTRPGSession.lines.length === 0 ? (
                  <p className="text-white/30 text-center py-10 heading-condensed" style={{ fontStyle: 'italic' }}>Empty.</p>
                ) : (
                  <div className="space-y-0.5 max-w-2xl mx-auto">
                    {selectedTRPGSession.lines.map((line, index) => (
                      <TRPGBubble key={line.id} line={line} characters={selectedTRPGSession.characters} onImageClick={(imageIndex) => handleImageClick(selectedTRPGSession.lines, index, imageIndex)} />
                    ))}
                    <div className="flex items-center justify-center gap-3 py-10 opacity-40">
                      <span className="block h-px w-8" style={{ background: 'rgba(255,255,255,0.25)' }} />
                      <span className="label-caps text-white/30" style={{ fontSize: '0.45rem', letterSpacing: '0.3em' }}>FIN</span>
                      <span className="block h-px w-8" style={{ background: 'rgba(255,255,255,0.25)' }} />
                    </div>
                  </div>
                )
              ) : (
                <EmptyState text={trpgSessions.length === 0 ? 'No sessions yet.' : 'Select a session to read.'} />
              )
            )}
          </div>

          {/* 하단 */}
          <div className="relative px-10 md:px-16 lg:px-20 pb-6 md:pb-9 shrink-0 flex items-center justify-between">
            <span className="label-caps text-white/15" style={{ fontSize: '0.45rem', letterSpacing: '0.3em' }}>
              SOMBRE
            </span>
            <span className="heading-condensed text-white/30" style={{ fontSize: '0.65rem', fontStyle: 'italic' }}>Records</span>
          </div>
        </div>
      </div>

      {/* 이미지 갤러리 */}
      {showGallery && galleryImages.length > 0 && (
        <ImageGalleryModal images={galleryImages} initialIndex={galleryIndex} onClose={() => setShowGallery(false)} />
      )}
    </div>
  )
}
