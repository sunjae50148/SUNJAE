'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { parseDialogue, DialogueRecord, DialogueLine, Phase, Section, TRPGSession, TRPGLine, TRPGCharacter } from '@/lib/parseDialogue'
import type { CharacterData, CharacterPhaseData } from '@/app/api/characters/route'
import type { GameDialogueData, BodyPart } from '@/app/api/game-dialogues/route'
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// --- 유틸리티 함수 ---
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

function toRoman(num: number): string {
  const map: [number, string][] = [
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ]
  let result = ''
  let n = num
  for (const [v, s] of map) {
    while (n >= v) { result += s; n -= v }
  }
  return result || 'I'
}

const CHARACTER_LABELS = {
  manon: 'KIM MINJAE',
  dylan: 'LEE SUN',
} as const

function normalizeCharacterDisplayName(value = '') {
  const key = value.trim().toLowerCase()
  if (key === 'manon') return CHARACTER_LABELS.manon
  if (key === 'dylan') return CHARACTER_LABELS.dylan
  return value
}

function normalizeCharacterPhase(phase: CharacterPhaseData): CharacterPhaseData {
  return {
    ...phase,
    nameKr: normalizeCharacterDisplayName(phase.nameKr),
    nameEn: normalizeCharacterDisplayName(phase.nameEn),
  }
}

function normalizeCharacterData(data: CharacterData): CharacterData {
  return {
    ...data,
    manon: (data.manon || []).map(normalizeCharacterPhase),
    dylan: (data.dylan || []).map(normalizeCharacterPhase),
  }
}

function normalizeAUEntry(au: any) {
  return {
    ...au,
    manon: {
      ...(au.manon || {}),
      name: normalizeCharacterDisplayName(au.manon?.name || CHARACTER_LABELS.manon),
    },
    dylan: {
      ...(au.dylan || {}),
      name: normalizeCharacterDisplayName(au.dylan?.name || CHARACTER_LABELS.dylan),
    },
  }
}

// 이미지를 압축하고 서버에 업로드
async function uploadImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const MAX_WIDTH = 1920
        const MAX_HEIGHT = 1920
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width
            width = MAX_WIDTH
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height
            height = MAX_HEIGHT
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)
        
        const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')
        const outputType = isPng ? 'image/png' : 'image/jpeg'
        const quality = isPng ? undefined : 0.8

        canvas.toBlob(async (blob) => {
          if (!blob) {
            reject(new Error('이미지 압축 실패'))
            return
          }

          const formData = new FormData()
          formData.append('image', blob, file.name)

          try {
            const response = await fetch('/api/upload-image', {
              method: 'POST',
              body: formData
            })

            if (!response.ok) {
              const errorText = await response.text()
              throw new Error(`서버 응답 실패 (${response.status}): ${errorText}`)
            }

            const data = await response.json()
            if (!data.path) {
              throw new Error('서버에서 경로를 반환하지 않음')
            }
            resolve(data.path)
          } catch (err: any) {
            reject(new Error(`업로드 실패: ${err.message}`))
          }
        }, outputType, quality)
      }
      img.onerror = () => reject(new Error('이미지 로드 실패'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('파일 읽기 실패'))
    reader.readAsDataURL(file)
  })
}

// Roll20 HTML 파싱 함수

// 오디오 파일을 서버에 업로드
async function uploadAudio(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('audio', file, file.name)
  
  const response = await fetch('/api/upload-audio', {
    method: 'POST',
    body: formData
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`서버 응답 실패 (${response.status}): ${errorText}`)
  }
  
  const data = await response.json()
  if (!data.path) throw new Error('서버에서 경로를 반환하지 않음')
  return data.path
}

// 기본 캐릭터 데이터 — 비어있는 첫 페이즈 (admin에서 채움)
const defaultCharacterData: CharacterData = {
  manon: [
    {
      id: 'manon-0', symbol: '❀', label: 'VARIATION · I', name: '[ Première ]', quote: '""',
      nameKr: 'KIM MINJAE', nameEn: 'KIM MINJAE',
      age: '', height: '', weight: '',
      personality: [],
      abilityName: '', abilityDesc: '', mainQuote: '""',
    },
  ],
  dylan: [
    {
      id: 'dylan-0', symbol: '✦', label: 'INCANTATION · I', name: '[ Cantus ]', quote: '""',
      nameKr: 'LEE SUN', nameEn: 'LEE SUN',
      age: '', height: '', weight: '',
      personality: [],
      abilityName: '', abilityDesc: '', mainQuote: '""',
    },
  ]
}

// Roll20 HTML 파싱 함수
function parseRoll20HTML(html: string): { lines: TRPGLine[], characters: TRPGCharacter[] } {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const lines: TRPGLine[] = []
  const characterMap = new Map<string, TRPGCharacter>()
  const colors = ['#E74C3C', '#3498DB', '#2ECC71', '#9B59B6', '#F39C12', '#1ABC9C', '#E91E63', '#00BCD4']

  // 캐릭터 등록 헬퍼
  const ensureCharacter = (name: string, isPC: boolean, avatarSrc?: string) => {
    if (!characterMap.has(name)) {
      characterMap.set(name, {
        name,
        color: colors[characterMap.size % colors.length],
        isPC,
        avatar: avatarSrc && !avatarSrc.startsWith('/users/avatar/') ? avatarSrc : undefined
      })
    } else if (avatarSrc && !avatarSrc.startsWith('/users/avatar/') && !characterMap.get(name)!.avatar) {
      characterMap.get(name)!.avatar = avatarSrc
    }
  }

  // 아바타 URL 추출 헬퍼
  const getAvatarSrc = (msg: Element): string | undefined => {
    const avatarImg = msg.querySelector('.avatar img') as HTMLImageElement | null
    return avatarImg?.getAttribute('src') || undefined
  }

  const messages = doc.querySelectorAll('.message')
  let lastSpeaker = ''
  let lastIsPC = false

  messages.forEach((msg) => {
    const id = generateId()
    const classes = msg.className

    // ── emote 메시지 ──
    if (classes.includes('emote')) {
      const textEl = msg.cloneNode(true) as HTMLElement
      textEl.querySelectorAll('.spacer, .avatar, .tstamp, .by, .flyout').forEach(el => el.remove())
      let text = textEl.innerHTML.trim()
      text = text.replace(/<a[^>]*>([^<]*)<\/a>/g, '$1')
      text = text.replace(/<[^>]+>/g, '').trim()
      if (text) {
        lines.push({ id, type: 'emote', text })
      }
      return
    }

    // ── 내레이션 (desc) ──
    if (classes.includes('desc')) {
      const textEl = msg.cloneNode(true) as HTMLElement
      textEl.querySelectorAll('.spacer, .avatar, .tstamp, .by, .flyout').forEach(el => el.remove())

      let text = textEl.innerHTML.trim()
      // 이미지 태그 처리 (imgur 등)
      const imgMatches = Array.from(textEl.querySelectorAll('img'))
      const imgSrcs = imgMatches.map(img => img.getAttribute('src')).filter(Boolean) as string[]

      if (imgSrcs.length > 0) {
        // 이미지 외에 텍스트가 있는지 확인
        let remainingText = text.replace(/<a[^>]*>[\s\S]*?<\/a>/g, '').replace(/<img[^>]*>/g, '').replace(/<[^>]+>/g, '').trim()
        lines.push({
          id,
          type: 'narration',
          text: remainingText,
          images: imgSrcs
        })
      } else {
        text = text.replace(/<a[^>]*>([^<]*)<\/a>/g, '$1')
        text = text.replace(/<[^>]+>/g, '').trim()

        if (text && text !== '*') {
          if (msg.innerHTML.includes('background-color')) {
            lines.push({ id, type: 'system', text })
          } else {
            lines.push({ id, type: 'narration', text })
          }
        }
      }
      return
    }

    // ── 주사위 굴림 (rollresult) — em/메디아/플레이어 직접 주사위 ──
    if (classes.includes('rollresult')) {
      const byEl = msg.querySelector('.by')
      let speaker = byEl?.textContent?.replace(':', '').trim() || lastSpeaker
      const avatarSrc = getAvatarSrc(msg)
      if (speaker) {
        ensureCharacter(speaker, classes.includes('you'), avatarSrc)
        lastSpeaker = speaker
        lastIsPC = classes.includes('you')
      }

      // 공식 텍스트
      const formulaEl = msg.querySelector('.formula:not(.formattedformula)')
      const formula = formulaEl?.textContent?.replace('rolling ', '').trim() || ''

      // 개별 주사위 파싱
      const diceEls = msg.querySelectorAll('.diceroll')
      const dice: { value: number; sides: number; crit?: 'success' | 'fail' }[] = []
      diceEls.forEach(d => {
        const value = parseInt(d.querySelector('.didroll')?.textContent || '0')
        const sidesMatch = d.className.match(/d(\d+)/)
        const sides = sidesMatch ? parseInt(sidesMatch[1]) : 6
        let crit: 'success' | 'fail' | undefined
        if (d.classList.contains('critsuccess')) crit = 'success'
        if (d.classList.contains('critfail')) crit = 'fail'
        dice.push({ value, sides, crit })
      })

      // 합계
      const total = parseInt(msg.querySelector('.rolled')?.textContent || '0')

      lines.push({
        id,
        type: 'diceroll',
        speaker: speaker || undefined,
        text: formula,
        diceData: { formula, dice, total }
      })
      return
    }

    // ── 일반 대사 (general) ──
    if (classes.includes('general')) {
      const byEl = msg.querySelector('.by')
      let speaker = byEl?.textContent?.replace(':', '').trim() || lastSpeaker
      if (!speaker) return

      const avatarSrc = getAvatarSrc(msg)
      const isPC = byEl ? classes.includes('you') : lastIsPC
      ensureCharacter(speaker, isPC, avatarSrc)
      lastSpeaker = speaker
      lastIsPC = isPC

      // 텍스트 추출
      const textEl = msg.cloneNode(true) as HTMLElement
      textEl.querySelectorAll('.spacer, .avatar, .tstamp, .by, .flyout').forEach(el => el.remove())

      // ── 광기의 발작 체크 ──
      const madnessTemplate = textEl.querySelector('.sheet-rolltemplate-coc-bomadness-rt')
      if (madnessTemplate) {
        const title = madnessTemplate.querySelector('caption')?.textContent || '광기의 발작'
        const valueEls = madnessTemplate.querySelectorAll('.sheet-template_value')
        let effectName = ''
        let effectDesc = ''
        let rounds: number | undefined
        let duration: number | undefined

        valueEls.forEach(el => {
          const bold = el.querySelector('b')
          const text = el.textContent?.trim() || ''
          if (bold) {
            const boldText = bold.textContent?.trim() || ''
            if (text.includes('Rounds:') || text.includes('라운드')) {
              const numMatch = text.match(/\d+/)
              if (numMatch) rounds = parseInt(numMatch[0])
            } else if (text.includes('Duration') || text.includes('Underlying')) {
              const numMatch = text.match(/\d+/)
              if (numMatch) duration = parseInt(numMatch[0])
            } else {
              effectName = boldText
            }
          } else if (text.length > 10 && !effectDesc) {
            effectDesc = text
          } else if (text.includes('Rounds:') || text.includes('라운드')) {
            const numMatch = text.match(/\d+/)
            if (numMatch) rounds = parseInt(numMatch[0])
          } else if (text.includes('Duration') || text.includes('Underlying')) {
            const numMatch = text.match(/\d+/)
            if (numMatch) duration = parseInt(numMatch[0])
          }
        })

        lines.push({
          id,
          type: 'madness',
          speaker,
          text: title,
          madnessData: { title, effectName, effectDesc, rounds, duration }
        })
        return
      }

      // ── CoC 판정 주사위 체크 (일반 + 보너스/페널티 다이스) ──
      const rollTemplate = textEl.querySelector('.sheet-rolltemplate-coc-1') || textEl.querySelector('.sheet-rolltemplate-coc')
      if (rollTemplate) {
        const caption = rollTemplate.querySelector('caption')?.textContent || ''
        const valueSpans = rollTemplate.querySelectorAll('.sheet-template_value span')
        const target = parseInt(valueSpans[0]?.textContent || '0')

        const parseResult = (text: string): 'critical' | 'extreme' | 'hard' | 'success' | 'fail' | 'fumble' => {
          const t = text.toLowerCase()
          if (t.includes('대성공') || t.includes('critical')) return 'critical'
          if (t.includes('극단적') || t.includes('extreme')) return 'extreme'
          if (t.includes('어려운') || t.includes('hard')) return 'hard'
          if (t.includes('성공') || t.includes('success')) return 'success'
          if (t.includes('대실패') || t.includes('fumble')) return 'fumble'
          return 'fail'
        }

        const rows = Array.from(rollTemplate.querySelectorAll('tr'))
        const bonusRows: { row: Element; bonus: number }[] = []
        rows.forEach(row => {
          const label = row.querySelector('.sheet-template_label')?.textContent?.trim().replace(/\s+/g, '') || ''
          const m = label.match(/^([+-]?\d+):$/)
          if (m) bonusRows.push({ row, bonus: parseInt(m[1]) })
        })

        type RollResult = 'critical' | 'extreme' | 'hard' | 'success' | 'fail' | 'fumble'
        let rolled = 0
        let result: RollResult = 'fail'
        let rolledAll: number[] | undefined
        let bonusResults: { bonus: number; result: RollResult }[] | undefined

        if (bonusRows.length > 0) {
          // 보너스/페널티 다이스 — 굴림 행에 여러 d100, 각 보너스 행이 결과
          const rolledRow = rows.find(row => row.querySelector('.sheet-template_label')?.getAttribute('data-i18n') === 'rolled')
          const rolledSpans = rolledRow?.querySelectorAll('.sheet-template_value span')
          rolledAll = Array.from(rolledSpans || []).map(s => parseInt(s.textContent || '0'))
          rolled = rolledAll[0] || 0
          bonusResults = bonusRows.map(({ row, bonus }) => {
            const cell = row.querySelector('.sheet-template_value')
            const resText = cell?.getAttribute('data-i18n') || cell?.textContent || ''
            return { bonus, result: parseResult(resText) }
          })
          const zero = bonusResults.find(b => b.bonus === 0)
          result = zero?.result || bonusResults[0]?.result || 'fail'
        } else {
          rolled = parseInt(valueSpans[3]?.textContent || '0')
          const resultCell = rollTemplate.querySelector('tr:last-child td:last-child')
          result = parseResult(resultCell?.textContent || '')
        }

        lines.push({
          id,
          type: 'roll',
          speaker,
          text: caption,
          rollData: { skillName: caption, target, rolled, result, rolledAll, bonusResults }
        })
        return
      }

      // ── 이미지 추출 (imgur 등) ──
      const imgEls = textEl.querySelectorAll('img:not(.avatar img)')
      const imgSrcs = Array.from(imgEls)
        .map(img => img.getAttribute('src'))
        .filter(src => src && !src.startsWith('/users/avatar/')) as string[]

      let text = textEl.innerHTML
      // 이미지 링크 제거
      text = text.replace(/<a[^>]*>\s*<img[^>]*>\s*<\/a>/g, '')
      text = text.replace(/<img[^>]*>/g, '')
        .replace(/<strong>([^<]*)<\/strong>/g, '<b>$1</b>')
        .replace(/<em>([^<]*)<\/em>/g, '<i>$1</i>')
        .replace(/<[^bi/][^>]*>/g, '')
        .replace(/<\/[^bi][^>]*>/g, '')
        .trim()

      if (text || imgSrcs.length > 0) {
        lines.push({
          id,
          type: 'dialogue',
          speaker,
          text: text || '',
          images: imgSrcs.length > 0 ? imgSrcs : undefined
        })
      }
    }
  })

  return {
    lines,
    characters: Array.from(characterMap.values())
  }
}

// --- 드래그 가능한 말풍선 컴포넌트 ---
function SortableLine({
  line,
  onChange,
  onDelete,
  onImagesUpload,
  onImageDelete,
}: {
  line: DialogueLine
  onChange: (id: string, field: 'speaker'|'text', val: string) => void
  onDelete: (id: string) => void
  onImagesUpload: (id: string, paths: string[]) => void
  onImageDelete: (id: string, imageIndex: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: line.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const handleImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    
    try {
      const pathArray: string[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (!file.type.startsWith('image/')) continue
        const path = await uploadImage(file)
        pathArray.push(path)
      }
      if (pathArray.length > 0) {
        onImagesUpload(line.id, pathArray)
      }
    } catch (err: any) {
      alert(`이미지 업로드 실패: ${err.message}`)
    }
  }

  const images = line.images || []
  const hasImages = images.length > 0

  return (
    <div ref={setNodeRef} style={style} className="flex gap-2 mb-2 bg-white/50 p-3 rounded border border-ink/5 items-start group">
      <div {...attributes} {...listeners} className="cursor-grab text-ink/20 hover:text-ink/50 mt-2 px-1 text-lg">⣿</div>
      <div className="flex-1 space-y-2">
        <input
          value={line.speaker}
          onChange={(e) => onChange(line.id, 'speaker', e.target.value)}
          className={`bg-transparent border-b border-ink/10 w-32 text-sm italic focus:outline-none focus:border-[#D9809A] transition-colors ${(line.speaker.includes('LEE SUN') || line.speaker.includes('딜런') || line.speaker.includes('사드함')) ? 'text-ink/70' : 'text-[#D9809A]'}`}
        />

        {hasImages && (
          <div className="relative inline-block">
            <img src={images[currentImageIndex]} alt="" className="max-w-xs rounded border border-ink/20" />
            {images.length > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 px-3 py-1 rounded-full">
                <button onClick={() => setCurrentImageIndex(p => p === 0 ? images.length - 1 : p - 1)} className="text-white/80 text-sm">←</button>
                <span className="text-white/60 text-xs">{currentImageIndex + 1} / {images.length}</span>
                <button onClick={() => setCurrentImageIndex(p => p === images.length - 1 ? 0 : p + 1)} className="text-white/80 text-sm">→</button>
              </div>
            )}
            <button onClick={() => { onImageDelete(line.id, currentImageIndex); setCurrentImageIndex(Math.max(0, currentImageIndex - 1)) }}
              className="absolute top-1 right-1 bg-red-500/80 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">✕</button>
          </div>
        )}

        <textarea value={line.text} onChange={(e) => onChange(line.id, 'text', e.target.value)}
          className="w-full bg-white/60 text-ink/90 text-sm p-2 rounded focus:outline-none resize-none"
          rows={Math.max(2, line.text.split('\n').length)} />

        <div className="flex items-center gap-2 flex-wrap">
          <label className="inline-flex items-center gap-2 px-3 py-1 bg-ink/[0.03] hover:bg-ink/[0.06] rounded cursor-pointer text-xs text-ink/60">
            <span>+ 이미지</span>
            <input type="file" accept="image/*" multiple onChange={handleImagesUpload} className="hidden" />
          </label>
        </div>
      </div>
      <button onClick={() => onDelete(line.id)} className="text-ink/10 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100">✕</button>
    </div>
  )
}

// --- 드래그 가능한 소제목 컴포넌트 ---
function SortableSection({ section, pIdx, sIdx, selectedPhaseIdx, selectedSectionIdx, onSelectSection, onEditSectionName, onDeleteSection }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const [isEditing, setIsEditing] = useState(false)

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1 group">
      <div {...attributes} {...listeners} className="cursor-grab text-ink/15 hover:text-ink/40 text-xs px-0.5">⣿</div>
      {isEditing ? (
        <input autoFocus value={section.title} onChange={(e) => onEditSectionName(pIdx, sIdx, e.target.value)}
          onBlur={() => setIsEditing(false)} onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
          className="bg-white/70 text-ink text-sm px-2 py-1 rounded focus:outline-none flex-1" />
      ) : (
        <button onClick={() => onSelectSection(pIdx, sIdx)} onDoubleClick={() => setIsEditing(true)}
          className={`text-left text-sm flex-1 py-1 px-2 rounded ${selectedPhaseIdx === pIdx && selectedSectionIdx === sIdx ? 'bg-[#8B1538]/20 text-[#8B1538]' : 'text-ink/50 hover:bg-ink/[0.04]'}`}>
          {section.title}
        </button>
      )}
      <button onClick={() => onDeleteSection(pIdx, sIdx)} className="text-ink/20 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100">✕</button>
    </div>
  )
}

// --- 드래그 가능한 Phase 컴포넌트 (소제목은 별도 DnD) ---
function SortablePhase({ phase, pIdx, selectedPhaseIdx, selectedSectionIdx, onSelectPhase, onSelectSection, onEditPhaseName, onDeletePhase, onAddSection, onEditSectionName, onDeleteSection }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: phase.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const [isEditing, setIsEditing] = useState(false)

  return (
    <div ref={setNodeRef} style={style} className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <div {...attributes} {...listeners} className="cursor-grab text-ink/20 hover:text-ink/50">⣿</div>
        {isEditing ? (
          <input autoFocus value={phase.name} onChange={(e) => onEditPhaseName(pIdx, e.target.value)}
            onBlur={() => setIsEditing(false)} onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
            className="bg-white/70 text-[#8B1538] font-bold px-2 py-1 rounded focus:outline-none flex-1" />
        ) : (
          <button onClick={() => onSelectPhase(pIdx)} onDoubleClick={() => setIsEditing(true)}
            className={`text-left font-bold flex-1 ${selectedPhaseIdx === pIdx ? 'text-[#8B1538]' : 'text-ink/40'}`}>
            {phase.name}
          </button>
        )}
        <button onClick={() => onDeletePhase(pIdx)} className="text-ink/20 hover:text-red-500 text-sm">🗑️</button>
      </div>

      <div className="space-y-1 pl-6 border-l border-ink/10 ml-2">
        {phase.sections.map((section: Section, sIdx: number) => (
          <SortableSection key={section.id} section={section} pIdx={pIdx} sIdx={sIdx}
            selectedPhaseIdx={selectedPhaseIdx} selectedSectionIdx={selectedSectionIdx}
            onSelectSection={onSelectSection} onEditSectionName={onEditSectionName} onDeleteSection={onDeleteSection} />
        ))}
      </div>
      
      <button onClick={() => onAddSection(pIdx)} className="ml-8 mt-2 text-sm text-ink/30 hover:text-ink/60">+ 소제목 추가</button>
    </div>
  )
}

// --- TRPG Line 편집 컴포넌트 ---
function TRPGLineEditor({ line, characters, onChange, onDelete }: {
  line: TRPGLine
  characters: TRPGCharacter[]
  onChange: (line: TRPGLine) => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: line.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  
  const character = characters.find(c => c.name === line.speaker)
  const color = character?.color || '#666'

  return (
    <div ref={setNodeRef} style={style} className="flex gap-2 mb-2 bg-white/50 p-3 rounded border border-ink/5 items-start group">
      <div {...attributes} {...listeners} className="cursor-grab text-ink/20 hover:text-ink/50 mt-2 px-1">⣿</div>
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <select value={line.type} onChange={(e) => onChange({ ...line, type: e.target.value as any })}
            className="bg-white/70 text-ink/70 text-xs px-2 py-1 rounded">
            <option value="dialogue">대사</option>
            <option value="narration">내레이션</option>
            <option value="system">시스템</option>
            <option value="roll">판정</option>
            <option value="diceroll">주사위</option>
            <option value="emote">감정표현</option>
            <option value="madness">광기</option>
          </select>
          {(line.type === 'dialogue' || line.type === 'roll' || line.type === 'diceroll' || line.type === 'madness') && (
            <input value={line.speaker || ''} onChange={(e) => onChange({ ...line, speaker: e.target.value })}
              className="bg-transparent border-b border-ink/10 w-32 text-sm focus:outline-none" style={{ color }}
              placeholder="화자" />
          )}
        </div>
        <textarea value={line.text} onChange={(e) => onChange({ ...line, text: e.target.value })}
          className="w-full bg-white/60 text-ink/90 text-sm p-2 rounded focus:outline-none resize-none"
          rows={Math.max(1, line.text.split('\n').length)} placeholder="내용" />
      </div>
      <button onClick={onDelete} className="text-ink/10 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100">✕</button>
    </div>
  )
}

// --- 컬러 피커 ---
function ColorPicker({ color, onChange }: { color: string, onChange: (c: string) => void }) {
  const presets = ['#E74C3C', '#3498DB', '#2ECC71', '#9B59B6', '#F39C12', '#1ABC9C', '#E91E63', '#00BCD4', '#FF5722', '#795548', '#607D8B', '#8BC34A']
  return (
    <div className="flex flex-wrap gap-1">
      {presets.map(c => (
        <button key={c} onClick={() => onChange(c)}
          className={`w-6 h-6 rounded-full border-2 ${color === c ? 'border-ink' : 'border-transparent'}`}
          style={{ backgroundColor: c }} />
      ))}
      <input type="color" value={color} onChange={(e) => onChange(e.target.value)}
        className="w-6 h-6 rounded cursor-pointer" />
    </div>
  )
}

type AdminTabId = 'roleplay' | 'trpg' | 'character' | 'game' | 'au' | 'sheets' | 'timeline' | 'chat'

// 드래그 핸들이 있는 정렬 가능한 리스트 아이템
function SortableListItem({
  id,
  active,
  onClick,
  onDelete,
  children,
  activeClass = 'bg-[#8B1538]/15 text-[#8B1538] border border-[#8B1538]/40',
  inactiveClass = 'text-ink/60 hover:bg-ink/[0.04] border border-transparent',
}: {
  id: string
  active?: boolean
  onClick?: () => void
  onDelete?: () => void
  children: React.ReactNode
  activeClass?: string
  inactiveClass?: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1 group">
      <span {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-ink/20 hover:text-ink/50 px-1 select-none" title="드래그하여 순서 변경">⣿</span>
      <button type="button" onClick={onClick}
        className={`flex-1 text-left px-3 py-2 rounded text-sm transition-colors ${active ? activeClass : inactiveClass}`}>
        {children}
      </button>
      {onDelete && (
        <button type="button" onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-ink/30 hover:text-red-500 px-2 text-xs"
          title="삭제">×</button>
      )}
    </div>
  )
}

function SortableSheetCard({ sheet, idx, onDelete, onUpdate }: {
  sheet: any; idx: number; onDelete: () => void; onUpdate: (updates: any) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sheet.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style}
      className="group relative p-4 bg-white/60 border border-ink/10 rounded hover:border-ink/25 transition-colors">
      <span {...attributes} {...listeners}
        className="absolute top-2 left-2 cursor-grab active:cursor-grabbing text-ink/20 hover:text-ink/50 px-1 select-none"
        title="드래그하여 순서 변경">⣿</span>
      <button onClick={onDelete}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-ink/30 hover:text-red-500 px-1 text-xs"
        title="삭제">×</button>
      <div className="flex items-baseline gap-2 mb-1 pl-6">
        <input value={sheet.title || ''}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="시트 제목"
          className="font-bold text-sm text-ink/80 bg-transparent border-none outline-none focus:bg-ink/[0.02] flex-1 min-w-0" />
      </div>
      <input value={sheet.description || ''}
        onChange={(e) => onUpdate({ description: e.target.value })}
        placeholder="한 줄 설명"
        className="w-full text-xs text-ink/45 bg-transparent border-none outline-none focus:bg-ink/[0.02] mb-3 pl-6" />
      <div className="flex items-center gap-2 pl-6">
        <input value={sheet.url || ''}
          onChange={(e) => onUpdate({ url: e.target.value })}
          placeholder="https://..."
          className="flex-1 text-[11px] text-ink/50 bg-ink/[0.03] px-2 py-1.5 rounded border border-ink/10 outline-none focus:border-ink/30 font-mono min-w-0" />
        {sheet.url && (
          <a href={sheet.url} target="_blank" rel="noreferrer"
            className="shrink-0 px-3 py-1.5 bg-ink text-bg text-xs rounded hover:bg-ink/85 transition-colors whitespace-nowrap">
            바로가기 →
          </a>
        )}
      </div>
    </div>
  )
}

export default function AdminPage() {
  // 공통 상태
  const [password, setPassword] = useState('')
  const [adminUser, setAdminUser] = useState('manon')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<AdminTabId>('roleplay')
  const [message, setMessage] = useState('')
  
  // 역극 상태
  const [recordsList, setRecordsList] = useState<DialogueRecord[]>([])
  const [editingRecord, setEditingRecord] = useState<DialogueRecord | null>(null)
  const [selectedPhaseIdx, setSelectedPhaseIdx] = useState(0)
  const [selectedSectionIdx, setSelectedSectionIdx] = useState(0)
  
  // TRPG 상태
  const [trpgList, setTrpgList] = useState<TRPGSession[]>([])
  const [editingTRPG, setEditingTRPG] = useState<TRPGSession | null>(null)

  // 캐릭터 상태
  const [characterData, setCharacterData] = useState<CharacterData>(defaultCharacterData)
  const [charTab, setCharTab] = useState<'manon' | 'dylan'>('manon')
  const [charPhaseIdx, setCharPhaseIdx] = useState(0)
  const [charUploading, setCharUploading] = useState(false)

  // AU 상태
  const [auList, setAUList] = useState<any[]>([])
  const [auSelectedIdx, setAUSelectedIdx] = useState(0)
  const [auUploadingFor, setAUUploadingFor] = useState<{ idx: number; who: 'manon' | 'dylan' } | null>(null)

  // 시트 리스트 상태
  const [sheetsList, setSheetsList] = useState<any[]>([])

  // 타임라인 상태
  const [timelineEvents, setTimelineEvents] = useState<any[]>([])
  const [timelineSelectedIdx, setTimelineSelectedIdx] = useState(0)

  // 채팅 상태
  const [chatMessages, setChatMessages] = useState<any[]>([])

  // 게임 대사 상태
  const [gameData, setGameData] = useState<GameDialogueData>({ foreword: { parts: [] }, rebuttal: { parts: [] } })
  const [gameTab, setGameTab] = useState<'foreword' | 'rebuttal'>('foreword')
  const [gameUploading, setGameUploading] = useState(false)
  const [drawingPartIdx, setDrawingPartIdx] = useState<number | null>(null)  // 현재 그리기 중인 부위
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([])  // 임시 꼭짓점
  const [draggingVertex, setDraggingVertex] = useState<{ partIdx: number; pointIdx: number } | null>(null)
  const gameImgRef = useRef<HTMLImageElement>(null)
  const gameCanvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('same_admin_login')
    if (saved === 'true') setIsLoggedIn(true)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (isLoggedIn) {
      fetchRecords()
      fetchTRPG()
      fetchCharacterData()
      fetchGameData()
      fetchAUs()
      fetchSheets()
      fetchTimeline()
      fetchChat()
    }
  }, [isLoggedIn])

  const fetchRecords = async () => {
    try {
      const res = await fetch('/api/records')
      const data = await res.json()
      if (Array.isArray(data)) setRecordsList(data)
    } catch (e) { console.error(e) }
  }

  const fetchTRPG = async () => {
    try {
      const res = await fetch('/api/trpg')
      const data = await res.json()
      if (Array.isArray(data)) setTrpgList(data)
    } catch (e) { console.error(e) }
  }

  const fetchAUs = async () => {
    try {
      const res = await fetch('/api/au')
      const data = await res.json()
      if (Array.isArray(data?.aus)) setAUList(data.aus.map(normalizeAUEntry))
    } catch (e) { console.error(e) }
  }

  const fetchTimeline = async () => {
    try {
      const res = await fetch('/api/timeline')
      const data = await res.json()
      if (Array.isArray(data?.events)) setTimelineEvents(data.events.sort((a: any, b: any) => a.order - b.order))
    } catch (e) { console.error(e) }
  }

  const saveTimeline = async (next: any[]) => {
    setTimelineEvents(next)
    try {
      const res = await fetch('/api/timeline', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: next }),
      })
      if (res.ok) { setMessage('타임라인 저장됨'); setTimeout(() => setMessage(''), 2000) }
      else { setMessage('저장 실패'); setTimeout(() => setMessage(''), 2500) }
    } catch { setMessage('저장 실패'); setTimeout(() => setMessage(''), 2500) }
  }

  const handleAddTimelineEvent = () => {
    const newEvent = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      storyDate: '새 날짜',
      title: '새 이벤트',
      description: '',
      character: 'both',
      type: 'event',
      order: timelineEvents.length,
    }
    const next = [...timelineEvents, newEvent]
    setTimelineSelectedIdx(next.length - 1)
    saveTimeline(next)
  }

  const handleDeleteTimelineEvent = (idx: number) => {
    const next = timelineEvents.filter((_, i) => i !== idx).map((ev, i) => ({ ...ev, order: i }))
    setTimelineSelectedIdx(Math.max(0, idx - 1))
    saveTimeline(next)
  }

  const updateTimelineEvent = (idx: number, patch: any) => {
    const next = timelineEvents.map((ev, i) => i === idx ? { ...ev, ...patch } : ev)
    setTimelineEvents(next)
  }

  const fetchChat = async () => {
    try {
      const res = await fetch('/api/chat')
      const data = await res.json()
      if (Array.isArray(data?.messages)) setChatMessages(data.messages)
    } catch (e) { console.error(e) }
  }

  const clearChat = async () => {
    if (!confirm('채팅 내역을 모두 삭제할까요?')) return
    try {
      await fetch('/api/chat', { method: 'DELETE' })
      setChatMessages([])
      setMessage('채팅 삭제됨'); setTimeout(() => setMessage(''), 2000)
    } catch { setMessage('삭제 실패'); setTimeout(() => setMessage(''), 2500) }
  }

  const saveAUs = async (next: any[]) => {
    setAUList(next)
    try {
      const res = await fetch('/api/au', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aus: next }),
      })
      if (res.ok) {
        setMessage('AU 저장됨'); setTimeout(() => setMessage(''), 2000)
      } else {
        setMessage('AU 저장 실패'); setTimeout(() => setMessage(''), 2500)
      }
    } catch (e) { console.error(e) }
  }

  const handleAddAU = () => {
    const newAU = {
      id: generateId(),
      title: '새 AU',
      subtitle: '',
      relationship: '',
      themeColor: '#D9809A',
      manon: { name: 'KIM MINJAE', image: '', dialogue: '' },
      dylan: { name: 'LEE SUN', image: '', dialogue: '' },
    }
    const next = [...auList, newAU]
    saveAUs(next)
    setAUSelectedIdx(next.length - 1)
  }

  const handleDeleteAU = (idx: number) => {
    if (!confirm(`"${auList[idx].title}" AU를 삭제하시겠습니까?`)) return
    const next = auList.filter((_, i) => i !== idx)
    saveAUs(next)
    setAUSelectedIdx(Math.max(0, Math.min(auSelectedIdx, next.length - 1)))
  }

  const updateAU = (idx: number, updates: any) => {
    const next = auList.map((a, i) => i === idx ? { ...a, ...updates } : a)
    saveAUs(next)
  }

  const updateAUCharacter = (idx: number, who: 'manon' | 'dylan', updates: any) => {
    const next = auList.map((a, i) => i === idx
      ? { ...a, [who]: { ...a[who], ...updates } }
      : a)
    saveAUs(next)
  }

  const handleAUImageUpload = async (idx: number, who: 'manon' | 'dylan', file: File) => {
    setAUUploadingFor({ idx, who })
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch('/api/upload-image', { method: 'POST', body: formData })
      const data = await res.json()
      if (data?.path) {
        updateAUCharacter(idx, who, { image: data.path })
      } else {
        alert('이미지 업로드 실패')
      }
    } catch (e) { console.error(e); alert('이미지 업로드 실패') }
    finally { setAUUploadingFor(null) }
  }

  const fetchSheets = async () => {
    try {
      const res = await fetch('/api/sheets')
      const data = await res.json()
      if (Array.isArray(data?.sheets)) setSheetsList(data.sheets)
    } catch (e) { console.error(e) }
  }

  const saveSheets = async (next: any[]) => {
    setSheetsList(next)
    try {
      const res = await fetch('/api/sheets', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheets: next }),
      })
      if (res.ok) { setMessage('시트 저장됨'); setTimeout(() => setMessage(''), 1500) }
    } catch (e) { console.error(e) }
  }

  const handleAddSheet = () => {
    const newSheet = { id: generateId(), title: '새 시트', description: '', url: '' }
    saveSheets([...sheetsList, newSheet])
  }

  const handleDeleteSheet = (idx: number) => {
    if (!confirm(`"${sheetsList[idx].title}" 시트를 삭제하시겠습니까?`)) return
    saveSheets(sheetsList.filter((_, i) => i !== idx))
  }

  const updateSheet = (idx: number, updates: any) => {
    saveSheets(sheetsList.map((s, i) => i === idx ? { ...s, ...updates } : s))
  }

  const fetchGameData = async () => {
    try {
      const res = await fetch('/api/game-dialogues')
      const data = await res.json()
      if (data) setGameData(data)
    } catch (e) { console.error(e) }
  }

  const fetchCharacterData = async () => {
    try {
      const res = await fetch('/api/characters')
      const data = await res.json()
      if (data?.manon?.length || data?.dylan?.length) {
        setCharacterData(normalizeCharacterData(data))
      }
    } catch (e) { console.error(e) }
  }

  const getCurrentCharPhase = (): CharacterPhaseData => {
    const phases = characterData[charTab]
    return phases[charPhaseIdx] || phases[0]
  }

  const updateCharPhase = (updates: Partial<CharacterPhaseData>) => {
    setCharacterData(prev => {
      const phases = [...prev[charTab]]
      if (phases[charPhaseIdx]) {
        phases[charPhaseIdx] = { ...phases[charPhaseIdx], ...updates }
      }
      return { ...prev, [charTab]: phases }
    })
  }

  const handleAddPhase = () => {
    const phases = characterData[charTab]
    const newPhase: CharacterPhaseData = {
      id: generateId(),
      symbol: charTab === 'manon' ? '❀' : '✦',
      label: charTab === 'manon'
        ? `VARIATION · ${toRoman(phases.length + 1)}`
        : `INCANTATION · ${toRoman(phases.length + 1)}`,
      name: '[ 새 페이즈 ]', quote: '""',
      nameKr: CHARACTER_LABELS[charTab],
      nameEn: CHARACTER_LABELS[charTab],
      age: '', height: '', weight: '',
      personality: [],
      abilityName: '', abilityDesc: '', mainQuote: '',
    }
    setCharacterData(prev => ({ ...prev, [charTab]: [...prev[charTab], newPhase] }))
    setCharPhaseIdx(phases.length)
  }

  const handleDeletePhase = (idx: number) => {
    const phases = characterData[charTab]
    if (phases.length <= 1) return
    if (!confirm(`"${phases[idx].label}" 페이즈를 삭제하시겠습니까?`)) return
    setCharacterData(prev => ({
      ...prev,
      [charTab]: prev[charTab].filter((_, i) => i !== idx)
    }))
    setCharPhaseIdx(Math.max(0, idx - 1))
  }

  const handleCharProfileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCharUploading(true)
    try {
      const path = await uploadImage(file)
      updateCharPhase({ profileImage: path })
    } catch (err: any) {
      alert(`업로드 실패: ${err.message}`)
    }
    setCharUploading(false)
  }

  const handleVoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCharUploading(true)
    try {
      const path = await uploadAudio(file)
      updateCharPhase({ voiceFile: path, voiceLabel: file.name })
    } catch (err: any) {
      alert(`업로드 실패: ${err.message}`)
    }
    setCharUploading(false)
  }

  // 리스트 재정렬 핸들러들
  const reorderRecords = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = recordsList.findIndex(r => r.id === active.id)
    const newIdx = recordsList.findIndex(r => r.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    const next = arrayMove(recordsList, oldIdx, newIdx)
    setRecordsList(next)
    await fetch('/api/records', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: next.map(r => r.id) })
    })
  }
  const reorderTRPG = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = trpgList.findIndex(s => s.id === active.id)
    const newIdx = trpgList.findIndex(s => s.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    const next = arrayMove(trpgList, oldIdx, newIdx)
    setTrpgList(next)
    await fetch('/api/trpg', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: next.map(s => s.id) })
    })
  }
  const reorderCharPhases = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const phases = characterData[charTab]
    const oldIdx = phases.findIndex(p => p.id === active.id)
    const newIdx = phases.findIndex(p => p.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    const nextPhases = arrayMove(phases, oldIdx, newIdx)
    setCharacterData(prev => ({ ...prev, [charTab]: nextPhases }))
    const newSelectedIdx = nextPhases.findIndex(p => p.id === phases[charPhaseIdx]?.id)
    if (newSelectedIdx !== -1) setCharPhaseIdx(newSelectedIdx)
  }
  const reorderAU = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = auList.findIndex(a => a.id === active.id)
    const newIdx = auList.findIndex(a => a.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    const next = arrayMove(auList, oldIdx, newIdx)
    saveAUs(next)
    const newSelectedIdx = next.findIndex(a => a.id === auList[auSelectedIdx]?.id)
    if (newSelectedIdx !== -1) setAUSelectedIdx(newSelectedIdx)
  }
  const reorderSheets = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = sheetsList.findIndex(s => s.id === active.id)
    const newIdx = sheetsList.findIndex(s => s.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    saveSheets(arrayMove(sheetsList, oldIdx, newIdx))
  }
  const reorderTimeline = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = timelineEvents.findIndex(e => e.id === active.id)
    const newIdx = timelineEvents.findIndex(e => e.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    const next = arrayMove(timelineEvents, oldIdx, newIdx).map((ev, i) => ({ ...ev, order: i }))
    saveTimeline(next)
    const newSelectedIdx = next.findIndex(e => e.id === timelineEvents[timelineSelectedIdx]?.id)
    if (newSelectedIdx !== -1) setTimelineSelectedIdx(newSelectedIdx)
  }

  const handleSaveCharacterData = async () => {
    setMessage('저장 중...')
    try {
      const res = await fetch('/api/characters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(characterData)
      })
      if (res.ok) {
        setMessage('저장 완료!')
      } else {
        setMessage('저장 실패')
      }
    } catch (e) { setMessage('저장 실패') }
    setTimeout(() => setMessage(''), 2000)
  }

  const handleAddStat = () => {
    const phase = getCurrentCharPhase()
    const stats = [...(phase.stats || []), { label: '새 스탯', value: 5 }]
    updateCharPhase({ stats })
  }

  const handleUpdateStat = (idx: number, field: 'label' | 'value', val: string | number) => {
    const phase = getCurrentCharPhase()
    const stats = [...(phase.stats || [])]
    stats[idx] = { ...stats[idx], [field]: val }
    updateCharPhase({ stats })
  }

  const handleDeleteStat = (idx: number) => {
    const phase = getCurrentCharPhase()
    const stats = [...(phase.stats || [])]
    stats.splice(idx, 1)
    updateCharPhase({ stats: stats.length > 0 ? stats : undefined })
  }

  const handleAddPersonality = () => {
    const phase = getCurrentCharPhase()
    updateCharPhase({ personality: [...phase.personality, '새 태그'] })
  }

  const handleUpdatePersonality = (idx: number, val: string) => {
    const phase = getCurrentCharPhase()
    const p = [...phase.personality]
    p[idx] = val
    updateCharPhase({ personality: p })
  }

  const handleDeletePersonality = (idx: number) => {
    const phase = getCurrentCharPhase()
    const p = [...phase.personality]
    p.splice(idx, 1)
    updateCharPhase({ personality: p })
  }

  // 게임 대사 핸들러들
  const currentGameSection = gameData[gameTab]

  const handleSaveGameData = async () => {
    setMessage('저장 중...')
    try {
      const res = await fetch('/api/game-dialogues', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gameData)
      })
      if (res.ok) setMessage('저장 완료!')
      else setMessage('저장 실패')
    } catch (e) { setMessage('저장 실패') }
    setTimeout(() => setMessage(''), 2000)
  }

  const updateGameSection = (updates: Partial<typeof currentGameSection>) => {
    setGameData(prev => ({ ...prev, [gameTab]: { ...prev[gameTab], ...updates } }))
  }

  const handleAddBodyPart = () => {
    const newPart: BodyPart = { id: generateId(), label: '새 부위', x: 50, y: 50, width: 10, height: 10, dialogue: '', points: [] }
    const newParts = [...currentGameSection.parts, newPart]
    updateGameSection({ parts: newParts })
    // 바로 그리기 모드 시작
    setDrawingPartIdx(newParts.length - 1)
    setDrawingPoints([])
  }

  const handleUpdateBodyPart = (idx: number, updates: Partial<BodyPart>) => {
    const parts = [...currentGameSection.parts]
    parts[idx] = { ...parts[idx], ...updates }
    updateGameSection({ parts })
  }

  const handleDeleteBodyPart = (idx: number) => {
    const parts = [...currentGameSection.parts]
    parts.splice(idx, 1)
    updateGameSection({ parts })
    if (drawingPartIdx === idx) { setDrawingPartIdx(null); setDrawingPoints([]) }
    else if (drawingPartIdx !== null && drawingPartIdx > idx) setDrawingPartIdx(drawingPartIdx - 1)
  }

  // 이미지 위 클릭 → 다각형 꼭짓점 추가
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (drawingPartIdx === null) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    const newPoints: [number, number][] = [...drawingPoints, [x, y]]
    setDrawingPoints(newPoints)
    handleUpdateBodyPart(drawingPartIdx, { points: newPoints })
  }

  // 그리기 완료
  const finishDrawing = () => {
    if (drawingPartIdx !== null && drawingPoints.length >= 3) {
      handleUpdateBodyPart(drawingPartIdx, { points: drawingPoints })
    }
    setDrawingPartIdx(null)
    setDrawingPoints([])
  }

  // 마지막 점 취소
  const undoLastPoint = () => {
    if (drawingPoints.length === 0) return
    const newPoints = drawingPoints.slice(0, -1)
    setDrawingPoints(newPoints)
    if (drawingPartIdx !== null) handleUpdateBodyPart(drawingPartIdx, { points: newPoints })
  }

  // 다시 그리기
  const restartDrawing = (idx: number) => {
    setDrawingPartIdx(idx)
    setDrawingPoints([])
    handleUpdateBodyPart(idx, { points: [] })
  }

  // 꼭짓점 드래그 시작
  const handleVertexMouseDown = (e: React.MouseEvent, partIdx: number, pointIdx: number) => {
    e.stopPropagation()
    e.preventDefault()
    setDraggingVertex({ partIdx, pointIdx })
  }

  // 꼭짓점 드래그 중
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingVertex) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
    const part = currentGameSection.parts[draggingVertex.partIdx]
    if (!part?.points) return
    const newPoints: [number, number][] = part.points.map((p, i) => i === draggingVertex.pointIdx ? [x, y] : p)
    handleUpdateBodyPart(draggingVertex.partIdx, { points: newPoints })
  }

  // 꼭짓점 드래그 끝
  const handleCanvasMouseUp = () => {
    setDraggingVertex(null)
  }

  const handleGameImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setGameUploading(true)
    try {
      const path = await uploadImage(file)
      updateGameSection({ characterImage: path })
    } catch (err: any) { alert(`업로드 실패: ${err.message}`) }
    setGameUploading(false)
  }

  // 역극 핸들러들
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, mode: 'new' | 'append') => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const parsed = parseDialogue(text, file.name.replace('.txt', ''))
      if (mode === 'new') {
        setEditingRecord(parsed)
        setSelectedPhaseIdx(0)
        setSelectedSectionIdx(0)
      } else if (editingRecord) {
        const newRecord = { ...editingRecord, phases: editingRecord.phases.map(p => ({ ...p, sections: [...p.sections] })) }
        parsed.phases.forEach(newPhase => {
          // 같은 이름의 차수가 있으면 소제목을 합침
          const existingPhase = newRecord.phases.find(p => p.name.trim() === newPhase.name.trim())
          if (existingPhase) {
            newPhase.sections.forEach(s => existingPhase.sections.push(s))
          } else {
            newRecord.phases.push(newPhase)
          }
        })
        setEditingRecord(newRecord)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleSaveRecord = async () => {
    if (!editingRecord) return
    setMessage('저장 중...')
    try {
      const exists = recordsList.some(r => r.id === editingRecord.id)
      const res = await fetch('/api/records', {
        method: exists ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRecord)
      })
      if (res.ok) {
        setMessage('저장 완료!')
        fetchRecords()
      }
    } catch (e) { setMessage('저장 실패') }
    setTimeout(() => setMessage(''), 2000)
  }

  const handleDeleteRecord = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/records?id=${id}`, { method: 'DELETE' })
    fetchRecords()
    if (editingRecord?.id === id) setEditingRecord(null)
  }

  const handleLineChange = (id: string, field: 'speaker' | 'text', val: string) => {
    if (!editingRecord) return
    const newRecord = { ...editingRecord }
    const line = newRecord.phases[selectedPhaseIdx].sections[selectedSectionIdx].lines.find(l => l.id === id)
    if (line) (line as any)[field] = val
    setEditingRecord(newRecord)
  }

  const handleLineDelete = (id: string) => {
    if (!editingRecord) return
    const newRecord = { ...editingRecord }
    newRecord.phases[selectedPhaseIdx].sections[selectedSectionIdx].lines = 
      newRecord.phases[selectedPhaseIdx].sections[selectedSectionIdx].lines.filter(l => l.id !== id)
    setEditingRecord(newRecord)
  }

  const handleImagesUpload = (id: string, paths: string[]) => {
    if (!editingRecord) return
    const newRecord = { ...editingRecord }
    const line = newRecord.phases[selectedPhaseIdx].sections[selectedSectionIdx].lines.find(l => l.id === id)
    if (line) line.images = [...(line.images || []), ...paths]
    setEditingRecord(newRecord)
  }

  const handleImageDelete = (id: string, idx: number) => {
    if (!editingRecord) return
    const newRecord = { ...editingRecord }
    const line = newRecord.phases[selectedPhaseIdx].sections[selectedSectionIdx].lines.find(l => l.id === id)
    if (line?.images) line.images.splice(idx, 1)
    setEditingRecord(newRecord)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    if (!editingRecord) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    
    const lines = editingRecord.phases[selectedPhaseIdx].sections[selectedSectionIdx].lines
    const oldIdx = lines.findIndex(l => l.id === active.id)
    const newIdx = lines.findIndex(l => l.id === over.id)
    
    if (oldIdx !== -1 && newIdx !== -1) {
      const newRecord = { ...editingRecord }
      newRecord.phases[selectedPhaseIdx].sections[selectedSectionIdx].lines = arrayMove(lines, oldIdx, newIdx)
      setEditingRecord(newRecord)
    }
  }

  // TRPG 핸들러들
  const handleTRPGUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const html = ev.target?.result as string
      const { lines, characters } = parseRoll20HTML(html)
      
      // 파일명에서 날짜와 제목 추출 시도
      const fileName = file.name.replace('.html', '')
      const dateMatch = fileName.match(/^(\d{8})_/)
      const date = dateMatch ? `${dateMatch[1].slice(0,4)}.${dateMatch[1].slice(4,6)}.${dateMatch[1].slice(6,8)}` : ''
      const title = dateMatch ? fileName.replace(dateMatch[0], '').replace(/_/g, ' ') : fileName
      
      setEditingTRPG({
        id: generateId(),
        title,
        date,
        characters,
        lines,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editingTRPG) return
    try {
      const path = await uploadImage(file)
      setEditingTRPG({ ...editingTRPG, coverImage: path })
    } catch (err: any) {
      alert(`업로드 실패: ${err.message}`)
    }
  }

  const handleSaveTRPG = async () => {
    if (!editingTRPG) return
    setMessage('저장 중...')
    try {
      const exists = trpgList.some(s => s.id === editingTRPG.id)
      const res = await fetch('/api/trpg', {
        method: exists ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTRPG)
      })
      if (res.ok) {
        setMessage('저장 완료!')
        fetchTRPG()
      }
    } catch (e) { setMessage('저장 실패') }
    setTimeout(() => setMessage(''), 2000)
  }

  const handleDeleteTRPG = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/trpg?id=${id}`, { method: 'DELETE' })
    fetchTRPG()
    if (editingTRPG?.id === id) setEditingTRPG(null)
  }

  const handleTRPGLineChange = (idx: number, line: TRPGLine) => {
    if (!editingTRPG) return
    const newLines = [...editingTRPG.lines]
    newLines[idx] = line
    setEditingTRPG({ ...editingTRPG, lines: newLines })
  }

  const handleTRPGLineDragEnd = (event: DragEndEvent) => {
    if (!editingTRPG) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    
    const oldIdx = editingTRPG.lines.findIndex(l => l.id === active.id)
    const newIdx = editingTRPG.lines.findIndex(l => l.id === over.id)
    
    if (oldIdx !== -1 && newIdx !== -1) {
      setEditingTRPG({ ...editingTRPG, lines: arrayMove(editingTRPG.lines, oldIdx, newIdx) })
    }
  }

  const handleCharacterColorChange = (name: string, color: string) => {
    if (!editingTRPG) return
    const newChars = editingTRPG.characters.map(c => c.name === name ? { ...c, color } : c)
    setEditingTRPG({ ...editingTRPG, characters: newChars })
  }

  const handleCharacterPCToggle = (name: string) => {
    if (!editingTRPG) return
    const newChars = editingTRPG.characters.map(c => c.name === name ? { ...c, isPC: !c.isPC } : c)
    setEditingTRPG({ ...editingTRPG, characters: newChars })
  }

  if (isLoading) return <div className="min-h-screen bg-bg" />

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-bg-cream border border-ink/10 rounded-lg p-8">
          <h1 className="font-display text-center text-[#8B1538] mb-6">ADMIN ACCESS</h1>
          <form onSubmit={async (e) => { e.preventDefault(); try { const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: adminUser, password }) }); if (res.ok) { setIsLoggedIn(true); localStorage.setItem('same_admin_login', 'true'); localStorage.setItem('same_logged_user', adminUser); localStorage.setItem('sunjae_chat_as', adminUser) } else alert('비밀번호 불일치') } catch { alert('인증 오류') } }}>
            <div className="flex gap-2 mb-4">
              {(['manon', 'dylan'] as const).map(u => (
                <button key={u} type="button" onClick={() => setAdminUser(u)}
                  className={`flex-1 py-2 rounded border text-sm capitalize transition-all ${adminUser === u ? 'border-[#8B1538] bg-[#8B1538]/10 text-[#8B1538]' : 'border-ink/10 text-ink/40'}`}>
                  {CHARACTER_LABELS[u]}
                </button>
              ))}
            </div>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-white/60 border border-ink/10 rounded px-4 py-3 text-ink focus:outline-none focus:border-[#8B1538] mb-4 placeholder-ink/40" placeholder="비밀번호" />
            <button type="submit" className="w-full bg-[#8B1538] hover:bg-[#A01840] text-white py-3 rounded">로그인</button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-bg text-ink overflow-hidden">
      {/* 사이드바 */}
      <div className="w-80 bg-bg-cream border-r border-ink/10 flex flex-col">
        <div className="p-6 border-b border-ink/10">
          <h1 className="font-display text-xl mb-4" style={{ color: '#D9809A', fontStyle: 'italic', letterSpacing: '0.04em' }}>SUNJAE · ADMIN</h1>
          
          {/* 탭 선택 */}
          <div className="flex gap-2 mb-4">
            <button onClick={() => setActiveTab('roleplay')}
              className={`flex-1 py-2 rounded text-sm ${activeTab === 'roleplay' ? 'bg-[#8B1538] text-white' : 'bg-ink/[0.03] text-ink/40'}`}>
              역극
            </button>
            <button onClick={() => setActiveTab('trpg')}
              className={`flex-1 py-2 rounded text-sm ${activeTab === 'trpg' ? 'bg-[#8B1538] text-white' : 'bg-ink/[0.03] text-ink/40'}`}>
              TRPG
            </button>
            <button onClick={() => setActiveTab('character')}
              className={`flex-1 py-2 rounded text-sm ${activeTab === 'character' ? 'bg-[#8B1538] text-white' : 'bg-ink/[0.03] text-ink/40'}`}>
              캐릭터
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={() => setActiveTab('game')}
              className={`flex-1 py-2 rounded text-sm ${activeTab === 'game' ? 'bg-[#8B1538] text-white' : 'bg-ink/[0.03] text-ink/40'}`}>
              게임 대사
            </button>
            <button onClick={() => setActiveTab('au')}
              className={`flex-1 py-2 rounded text-sm ${activeTab === 'au' ? 'bg-[#8B1538] text-white' : 'bg-ink/[0.03] text-ink/40'}`}>
              AU
            </button>
            <button onClick={() => setActiveTab('sheets')}
              className={`flex-1 py-2 rounded text-sm ${activeTab === 'sheets' ? 'bg-[#8B1538] text-white' : 'bg-ink/[0.03] text-ink/40'}`}>
              시트
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={() => setActiveTab('timeline')}
              className={`flex-1 py-2 rounded text-sm ${activeTab === 'timeline' ? 'bg-[#8B1538] text-white' : 'bg-ink/[0.03] text-ink/40'}`}>
              타임라인
            </button>
            <button onClick={() => { setActiveTab('chat'); fetchChat() }}
              className={`flex-1 py-2 rounded text-sm ${activeTab === 'chat' ? 'bg-[#8B1538] text-white' : 'bg-ink/[0.03] text-ink/40'}`}>
              채팅
            </button>
          </div>
          
          {activeTab === 'roleplay' ? (
            <div className="space-y-2">
              <label className="flex items-center justify-center gap-2 w-full bg-ink/[0.03] hover:bg-ink/[0.06] text-ink/80 py-3 rounded cursor-pointer border border-dashed border-ink/20">
                <span>+ 새 파일로 시작</span>
                <input type="file" className="hidden" accept=".txt" onChange={(e) => handleFileUpload(e, 'new')} />
              </label>
              {editingRecord && (
                <label className="flex items-center justify-center gap-2 w-full bg-[#8B1538]/10 text-[#8B1538] py-3 rounded cursor-pointer border border-[#8B1538]/30">
                  <span>+ 현재 레코드에 추가</span>
                  <input type="file" className="hidden" accept=".txt" onChange={(e) => handleFileUpload(e, 'append')} />
                </label>
              )}
            </div>
          ) : activeTab === 'trpg' ? (
            <label className="flex items-center justify-center gap-2 w-full bg-ink/[0.03] hover:bg-ink/[0.06] text-ink/80 py-3 rounded cursor-pointer border border-dashed border-ink/20">
              <span>+ Roll20 HTML 업로드</span>
              <input type="file" className="hidden" accept=".html" onChange={handleTRPGUpload} />
            </label>
          ) : activeTab === 'character' ? (
            <div className="space-y-3">
              <div className="flex gap-1">
                <button onClick={() => { setCharTab('manon'); setCharPhaseIdx(0) }}
                  className={`flex-1 py-2 rounded text-xs font-bold italic ${charTab === 'manon' ? 'bg-[#D9809A]/20 text-[#D9809A] border border-[#D9809A]/50' : 'bg-ink/[0.03] text-ink/40'}`}>
                  KIM MINJAE
                </button>
                <button onClick={() => { setCharTab('dylan'); setCharPhaseIdx(0) }}
                  className={`flex-1 py-2 rounded text-xs font-bold italic ${charTab === 'dylan' ? 'bg-[#888]/30 text-ink/70 border border-ink/30' : 'bg-ink/[0.03] text-ink/40'}`}>
                  LEE SUN
                </button>
              </div>
              <div className="space-y-1">
                <DndContext collisionDetection={closestCenter} onDragEnd={reorderCharPhases}>
                  <SortableContext items={characterData[charTab].map(p => p.id)} strategy={verticalListSortingStrategy}>
                    {characterData[charTab].map((p, idx) => (
                      <SortableListItem key={p.id} id={p.id}
                        active={charPhaseIdx === idx}
                        activeClass={charTab === 'manon' ? 'bg-[#8B1538]/20 text-[#8B1538] border border-[#8B1538]/40' : 'bg-[#5E7B97]/20 text-[#5E7B97] border border-[#5E7B97]/40'}
                        inactiveClass="text-ink/50 hover:bg-ink/[0.04] border border-transparent"
                        onClick={() => setCharPhaseIdx(idx)}
                        onDelete={characterData[charTab].length > 1 ? () => handleDeletePhase(idx) : undefined}>
                        {p.label} · {p.name.replace(/[\[\]]/g, '').trim()}
                      </SortableListItem>
                    ))}
                  </SortableContext>
                </DndContext>
                <button onClick={handleAddPhase}
                  className="w-full py-2 border border-dashed border-ink/15 rounded text-ink/30 hover:text-ink/60 text-xs">+ 페이즈 추가</button>
              </div>
            </div>
          ) : null}
        </div>
        
        {/* 목록 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {activeTab === 'roleplay' ? (
            <DndContext collisionDetection={closestCenter} onDragEnd={reorderRecords}>
              <SortableContext items={recordsList.map(r => r.id)} strategy={verticalListSortingStrategy}>
                {recordsList.map(rec => (
                  <SortableListItem key={rec.id} id={rec.id}
                    active={editingRecord?.id === rec.id}
                    activeClass="bg-[#8B1538]/20 text-ink border border-[#8B1538]/50"
                    inactiveClass="text-ink hover:bg-ink/[0.04] border border-transparent"
                    onClick={() => { setEditingRecord(rec); setSelectedPhaseIdx(0); setSelectedSectionIdx(0) }}
                    onDelete={() => handleDeleteRecord(rec.id, { stopPropagation: () => {} } as any)}>
                    <div className="font-medium text-sm truncate">{rec.title}</div>
                    <div className="text-xs text-ink/30">{new Date(rec.createdAt).toLocaleDateString()}</div>
                  </SortableListItem>
                ))}
              </SortableContext>
            </DndContext>
          ) : activeTab === 'trpg' ? (
            <DndContext collisionDetection={closestCenter} onDragEnd={reorderTRPG}>
              <SortableContext items={trpgList.map(s => s.id)} strategy={verticalListSortingStrategy}>
                {trpgList.map(session => (
                  <SortableListItem key={session.id} id={session.id}
                    active={editingTRPG?.id === session.id}
                    activeClass="bg-[#8B1538]/20 text-ink border border-[#8B1538]/50"
                    inactiveClass="text-ink hover:bg-ink/[0.04] border border-transparent"
                    onClick={() => setEditingTRPG(session)}
                    onDelete={() => handleDeleteTRPG(session.id, { stopPropagation: () => {} } as any)}>
                    <div className="font-medium text-sm truncate">{session.title}</div>
                    <div className="text-xs text-ink/30">{session.date || new Date(session.createdAt).toLocaleDateString()}</div>
                  </SortableListItem>
                ))}
              </SortableContext>
            </DndContext>
          ) : activeTab === 'character' ? (
            <div className="text-center text-ink/30 text-sm py-4">
              <p className="mb-2">좌측에서 캐릭터와<br/>차수를 선택하세요</p>
              <div className="w-12 h-px bg-ink/10 mx-auto"></div>
            </div>
          ) : activeTab === 'game' ? (
            <div className="space-y-3 p-2">
              <div className="flex gap-1">
                <button onClick={() => setGameTab('foreword')}
                  className={`flex-1 py-2 rounded text-xs font-bold italic ${gameTab === 'foreword' ? 'bg-[#D9809A]/20 text-[#D9809A] border border-[#D9809A]/50' : 'bg-ink/[0.03] text-ink/40'}`}>
                  Foreword (KIM MINJAE)
                </button>
                <button onClick={() => setGameTab('rebuttal')}
                  className={`flex-1 py-2 rounded text-xs font-bold italic ${gameTab === 'rebuttal' ? 'bg-[#888]/30 text-ink/70 border border-ink/30' : 'bg-ink/[0.03] text-ink/40'}`}>
                  Rebuttal (LEE SUN)
                </button>
              </div>
              <p className="text-xs text-ink/25">캐릭터 이미지 위에 클릭 가능한 부위를 추가하고 각 부위에 대사를 지정합니다.</p>
              <div className="space-y-1">
                {currentGameSection.parts.map((part, idx) => (
                  <div key={part.id} className="flex items-center gap-1 group">
                    <button onClick={() => {}}
                      className="flex-1 text-left px-3 py-2 rounded text-sm text-ink/50 hover:bg-ink/[0.04]">
                      {part.label} ({part.x}%, {part.y}%)
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === 'au' ? (
            <div className="space-y-2">
              <button onClick={handleAddAU}
                className="w-full bg-[#8B1538]/10 hover:bg-[#8B1538]/20 text-[#8B1538] py-2.5 rounded text-sm border border-[#8B1538]/30">
                + 새 AU 추가
              </button>
              <p className="text-xs text-ink/25 pt-1">각 AU마다 두 캐릭터의 이미지/이름/대사/관계를 설정합니다.</p>
              <div className="space-y-1">
                <DndContext collisionDetection={closestCenter} onDragEnd={reorderAU}>
                  <SortableContext items={auList.map(a => a.id)} strategy={verticalListSortingStrategy}>
                    {auList.map((au, idx) => (
                      <SortableListItem key={au.id} id={au.id}
                        active={auSelectedIdx === idx}
                        onClick={() => setAUSelectedIdx(idx)}
                        onDelete={() => handleDeleteAU(idx)}>
                        <span className="block truncate">{au.title || '(제목 없음)'}</span>
                        {au.subtitle && <span className="text-[10px] text-ink/30">{au.subtitle}</span>}
                      </SortableListItem>
                    ))}
                  </SortableContext>
                </DndContext>
                {auList.length === 0 && (
                  <p className="text-center text-ink/20 text-xs py-4 italic">아직 AU가 없습니다.</p>
                )}
              </div>
            </div>
          ) : activeTab === 'sheets' ? (
            <div className="space-y-2">
              <button onClick={handleAddSheet}
                className="w-full bg-[#8B1538]/10 hover:bg-[#8B1538]/20 text-[#8B1538] py-2.5 rounded text-sm border border-[#8B1538]/30">
                + 새 시트 추가
              </button>
              <p className="text-xs text-ink/25 pt-1">
                외부 시트/링크 모음. 어드민에게만 보입니다.
              </p>
              <p className="text-xs text-ink/25">
                현재 {sheetsList.length}개 시트
              </p>
            </div>
          ) : activeTab === 'timeline' ? (
            <div className="space-y-2">
              <button onClick={handleAddTimelineEvent}
                className="w-full bg-[#8B1538]/10 hover:bg-[#8B1538]/20 text-[#8B1538] py-2.5 rounded text-sm border border-[#8B1538]/30">
                + 새 이벤트 추가
              </button>
              <p className="text-xs text-ink/25 pt-1">시간순 스토리 이벤트를 관리합니다.</p>
              <div className="space-y-1">
                <DndContext collisionDetection={closestCenter} onDragEnd={reorderTimeline}>
                  <SortableContext items={timelineEvents.map(e => e.id)} strategy={verticalListSortingStrategy}>
                    {timelineEvents.map((ev, idx) => (
                      <SortableListItem key={ev.id} id={ev.id}
                        active={timelineSelectedIdx === idx}
                        onClick={() => setTimelineSelectedIdx(idx)}
                        onDelete={() => handleDeleteTimelineEvent(idx)}>
                        <span className="text-[10px] text-ink/30 block">{ev.storyDate}</span>
                        <span className="block truncate">{ev.title || '(제목 없음)'}</span>
                      </SortableListItem>
                    ))}
                  </SortableContext>
                </DndContext>
                {timelineEvents.length === 0 && (
                  <p className="text-center text-ink/20 text-xs py-4 italic">이벤트가 없습니다.</p>
                )}
              </div>
            </div>
          ) : activeTab === 'chat' ? (
            <div className="space-y-3 p-2">
              <p className="text-xs text-ink/40">{chatMessages.length}개의 메시지</p>
              <button onClick={clearChat}
                className="w-full bg-red-50 hover:bg-red-100 text-red-500 py-2 rounded text-xs border border-red-200">
                채팅 전체 삭제
              </button>
              <button onClick={fetchChat}
                className="w-full bg-ink/[0.03] hover:bg-ink/[0.06] text-ink/60 py-2 rounded text-xs">
                새로고침
              </button>
            </div>
          ) : null}
        </div>
      </div>
      
      {/* 메인 에디터 영역 */}
      <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden">
        {activeTab === 'roleplay' ? (
          // 역극 에디터
          editingRecord ? (
            <>
              <div className="h-16 border-b border-ink/10 flex items-center justify-between px-6 bg-bg-cream">
                <input value={editingRecord.title} onChange={(e) => setEditingRecord({...editingRecord, title: e.target.value})}
                  className="bg-transparent text-lg font-bold text-ink focus:outline-none w-1/2" />
                <div className="flex items-center gap-4">
                  <span className="text-sm text-[#8B1538]">{message}</span>
                  <button onClick={handleSaveRecord} className="bg-[#8B1538] hover:bg-[#A01840] text-white px-6 py-2 rounded font-bold">저장하기</button>
                </div>
              </div>
              
              <div className="flex-1 flex overflow-hidden">
                <div className="w-64 bg-white/50 border-r border-ink/10 flex flex-col">
                  <div className="flex-1 overflow-y-auto p-4">
                    {/* Section-level DnD (cross-phase) */}
                    <DndContext collisionDetection={closestCenter} onDragEnd={(e) => {
                      const { active, over } = e
                      if (!over || active.id === over.id) return
                      
                      // Check if this is a section drag (not phase drag)
                      const allSectionIds = editingRecord.phases.flatMap(p => p.sections.map(s => s.id))
                      const isSection = allSectionIds.includes(active.id as string)
                      
                      if (isSection) {
                        // Find source phase/section
                        let srcPI = -1, srcSI = -1
                        let dstPI = -1, dstSI = -1
                        editingRecord.phases.forEach((p, pi) => {
                          p.sections.forEach((s, si) => {
                            if (s.id === active.id) { srcPI = pi; srcSI = si }
                            if (s.id === over.id) { dstPI = pi; dstSI = si }
                          })
                        })
                        
                        if (srcPI === -1) return
                        
                        // If dropped on a phase header, move to end of that phase
                        if (dstPI === -1) {
                          const phaseIdx = editingRecord.phases.findIndex(p => p.id === over.id)
                          if (phaseIdx === -1) return
                          dstPI = phaseIdx
                          dstSI = editingRecord.phases[phaseIdx].sections.length
                        }
                        
                        const newPhases = editingRecord.phases.map(p => ({ ...p, sections: [...p.sections] }))
                        const [movedSection] = newPhases[srcPI].sections.splice(srcSI, 1)
                        
                        // Recalculate dstSI after removal if same phase
                        if (srcPI === dstPI) {
                          const targetIdx = newPhases[dstPI].sections.findIndex(s => s.id === over.id)
                          const insertAt = targetIdx === -1 ? newPhases[dstPI].sections.length : targetIdx
                          newPhases[dstPI].sections.splice(insertAt, 0, movedSection)
                        } else {
                          const insertAt = Math.min(dstSI, newPhases[dstPI].sections.length)
                          newPhases[dstPI].sections.splice(insertAt, 0, movedSection)
                        }
                        
                        setEditingRecord({ ...editingRecord, phases: newPhases })
                        
                        // Update selection to follow the moved section
                        const newPI = newPhases.findIndex(p => p.sections.some(s => s.id === movedSection.id))
                        const newSI = newPhases[newPI]?.sections.findIndex(s => s.id === movedSection.id) ?? 0
                        if (newPI !== -1) {
                          setSelectedPhaseIdx(newPI)
                          setSelectedSectionIdx(newSI)
                        }
                      } else {
                        // Phase drag
                        const phases = editingRecord.phases
                        const oldIdx = phases.findIndex(p => p.id === active.id)
                        const newIdx = phases.findIndex(p => p.id === over.id)
                        if (oldIdx !== -1 && newIdx !== -1) {
                          setEditingRecord({ ...editingRecord, phases: arrayMove(phases, oldIdx, newIdx) })
                        }
                      }
                    }}>
                      <SortableContext items={[
                        ...editingRecord.phases.map(p => p.id),
                        ...editingRecord.phases.flatMap(p => p.sections.map(s => s.id))
                      ]} strategy={verticalListSortingStrategy}>
                        {editingRecord.phases.map((phase, pIdx) => (
                          <SortablePhase key={phase.id} phase={phase} pIdx={pIdx}
                            selectedPhaseIdx={selectedPhaseIdx} selectedSectionIdx={selectedSectionIdx}
                            onSelectPhase={(idx: number) => { setSelectedPhaseIdx(idx); setSelectedSectionIdx(0) }}
                            onSelectSection={(pi: number, si: number) => { setSelectedPhaseIdx(pi); setSelectedSectionIdx(si) }}
                            onEditPhaseName={(pi: number, name: string) => { const r = {...editingRecord}; r.phases[pi].name = name; setEditingRecord(r) }}
                            onDeletePhase={(pi: number) => { const r = {...editingRecord}; r.phases.splice(pi, 1); setEditingRecord(r) }}
                            onAddSection={(pi: number) => { const r = {...editingRecord}; r.phases[pi].sections.push({ id: generateId(), title: '새 소제목', lines: [] }); setEditingRecord(r) }}
                            onEditSectionName={(pi: number, si: number, name: string) => { const r = {...editingRecord}; r.phases[pi].sections[si].title = name; setEditingRecord(r) }}
                            onDeleteSection={(pi: number, si: number) => { const r = {...editingRecord}; r.phases[pi].sections.splice(si, 1); setEditingRecord(r) }}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </div>
                  <div className="p-4 border-t border-ink/10">
                    <button onClick={() => { const r = {...editingRecord}; r.phases.push({ id: generateId(), name: '새 차수', sections: [] }); setEditingRecord(r) }}
                      className="w-full py-3 border border-dashed border-ink/20 text-ink/30 hover:text-ink/60 rounded">+ 차수 추가</button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-8 bg-bg">
                  <div className="max-w-3xl mx-auto pb-20">
                    {/* 대화 아바타 설정 (섹션별) */}
                    <div className="mb-6 pb-4 border-b border-ink/10">
                      <h2 className="text-xl font-bold text-ink/80 mb-3">
                        {editingRecord.phases[selectedPhaseIdx]?.name} — {editingRecord.phases[selectedPhaseIdx]?.sections[selectedSectionIdx]?.title}
                      </h2>
                      {/* 섹션별 비밀번호 */}
                      {(() => {
                        const sec = editingRecord.phases[selectedPhaseIdx]?.sections[selectedSectionIdx]
                        if (!sec) return null
                        return (
                          <div className="flex items-center gap-3 mb-4 p-3 rounded bg-ink/[0.03] border border-ink/8">
                            <span className="text-xs text-ink/50 font-semibold shrink-0">🔒 챕터 비밀번호</span>
                            <input
                              type="text"
                              placeholder="비밀번호 없음 (공개)"
                              value={sec.password || ''}
                              onChange={(e) => {
                                const r = {...editingRecord}
                                r.phases[selectedPhaseIdx].sections[selectedSectionIdx] = { ...sec, password: e.target.value || undefined }
                                setEditingRecord(r)
                              }}
                              className="bg-white border border-ink/15 rounded px-3 py-1.5 text-sm text-ink focus:outline-none focus:border-[#8B1538] w-48"
                            />
                            {sec.password && (
                              <button onClick={() => {
                                const r = {...editingRecord}
                                r.phases[selectedPhaseIdx].sections[selectedSectionIdx] = { ...sec, password: undefined }
                                setEditingRecord(r)
                              }}
                                className="text-xs text-red-500 hover:text-red-700">해제</button>
                            )}
                          </div>
                        )
                      })()}
                      {(() => {
                        const sec = editingRecord.phases[selectedPhaseIdx]?.sections[selectedSectionIdx]
                        if (!sec) return null
                        const updateSectionAvatar = (field: 'manonAvatar' | 'dylanAvatar', value: string | undefined) => {
                          const r = {...editingRecord}
                          r.phases[selectedPhaseIdx].sections[selectedSectionIdx] = { ...sec, [field]: value }
                          setEditingRecord(r)
                        }
                        return (
                          <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                              <span className="text-xs italic" style={{ color: '#D9809A' }}>KIM MINJAE:</span>
                              <button onClick={() => updateSectionAvatar('manonAvatar', undefined)}
                                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[9px] italic ${!sec.manonAvatar ? 'border-[#D9809A] bg-ink/5 text-ink/40' : 'border-transparent bg-ink/[0.03] text-ink/20 hover:bg-ink/[0.06]'}`}>
                                K
                              </button>
                              {(characterData.manonAvatars || []).map((url, i) => (
                                <button key={i} onClick={() => updateSectionAvatar('manonAvatar', url)}
                                  className={`w-8 h-8 rounded-full border-2 overflow-hidden ${sec.manonAvatar === url ? 'border-[#D9809A]' : 'border-transparent opacity-50 hover:opacity-100'}`}>
                                  <img src={url} alt="" className="w-full h-full object-cover" />
                                </button>
                              ))}
                              {(characterData.manonAvatars || []).length === 0 && (
                                <span className="text-[10px] text-ink/20">캐릭터 탭에서 후보 등록</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs italic text-ink/60">LEE SUN:</span>
                              <button onClick={() => updateSectionAvatar('dylanAvatar', undefined)}
                                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[9px] italic ${!sec.dylanAvatar ? 'border-ink/40 bg-ink/5 text-ink/40' : 'border-transparent bg-ink/[0.03] text-ink/20 hover:bg-ink/[0.06]'}`}>
                                L
                              </button>
                              {(characterData.dylanAvatars || []).map((url, i) => (
                                <button key={i} onClick={() => updateSectionAvatar('dylanAvatar', url)}
                                  className={`w-8 h-8 rounded-full border-2 overflow-hidden ${sec.dylanAvatar === url ? 'border-ink/50' : 'border-transparent opacity-50 hover:opacity-100'}`}>
                                  <img src={url} alt="" className="w-full h-full object-cover" />
                                </button>
                              ))}
                              {(characterData.dylanAvatars || []).length === 0 && (
                                <span className="text-[10px] text-ink/20">캐릭터 탭에서 후보 등록</span>
                              )}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={editingRecord.phases[selectedPhaseIdx]?.sections[selectedSectionIdx]?.lines?.map(l => l.id) || []} strategy={verticalListSortingStrategy}>
                        {editingRecord.phases[selectedPhaseIdx]?.sections[selectedSectionIdx]?.lines?.map((line) => (
                            <SortableLine key={line.id} line={line} onChange={handleLineChange} onDelete={handleLineDelete}
                              onImagesUpload={handleImagesUpload} onImageDelete={handleImageDelete} />
                        ))}
                      </SortableContext>
                    </DndContext>
                    <button onClick={() => { 
                      const r = {...editingRecord}
                      r.phases[selectedPhaseIdx].sections[selectedSectionIdx].lines.push({ id: generateId(), speaker: 'LEE SUN', text: '' })
                      setEditingRecord(r)
                    }} className="w-full py-4 mt-4 border border-dashed border-ink/10 text-ink/20 hover:text-ink/50 rounded">+ 대사 추가</button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-ink/30 gap-4">
              <div className="text-4xl">📝</div>
              <p>파일을 불러오거나 목록에서 선택하세요.</p>
            </div>
          )
        ) : activeTab === 'trpg' ? (
          // TRPG 에디터
          editingTRPG ? (
            <>
              <div className="border-b border-ink/10 bg-bg-cream">
                <div className="h-16 flex items-center justify-between px-6">
                  <input value={editingTRPG.title} onChange={(e) => setEditingTRPG({...editingTRPG, title: e.target.value})}
                    className="bg-transparent text-lg font-bold text-ink focus:outline-none w-1/3" placeholder="세션 제목" />
                  <input value={editingTRPG.date || ''} onChange={(e) => setEditingTRPG({...editingTRPG, date: e.target.value})}
                    className="bg-transparent text-sm text-ink/60 focus:outline-none w-32" placeholder="날짜 (YYYY.MM.DD)" />
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-[#8B1538]">{message}</span>
                    <button onClick={handleSaveTRPG} className="bg-[#8B1538] hover:bg-[#A01840] text-white px-6 py-2 rounded font-bold">저장하기</button>
                  </div>
                </div>
                <div className="px-6 pb-3 flex items-center gap-3">
                  <span className="text-xs text-ink/50 font-semibold shrink-0">🔒 세션 비밀번호</span>
                  <input
                    type="text"
                    placeholder="비밀번호 없음 (공개)"
                    value={editingTRPG.password || ''}
                    onChange={(e) => setEditingTRPG({...editingTRPG, password: e.target.value || undefined})}
                    className="bg-white border border-ink/15 rounded px-3 py-1.5 text-sm text-ink focus:outline-none focus:border-[#8B1538] w-48"
                  />
                  {editingTRPG.password && (
                    <button onClick={() => setEditingTRPG({...editingTRPG, password: undefined})}
                      className="text-xs text-red-500 hover:text-red-700">해제</button>
                  )}
                </div>
              </div>
              
              <div className="flex-1 flex overflow-hidden">
                {/* 캐릭터 & 설정 사이드바 */}
                <div className="w-72 bg-white/50 border-r border-ink/10 overflow-y-auto p-4">
                  {/* 커버 이미지 */}
                  <div className="mb-6">
                    <h3 className="text-sm font-bold text-ink/60 mb-2">세션 카드</h3>
                    {editingTRPG.coverImage ? (
                      <div className="relative">
                        <img src={editingTRPG.coverImage} className="w-full rounded" />
                        <button onClick={() => setEditingTRPG({...editingTRPG, coverImage: undefined})}
                          className="absolute top-1 right-1 bg-red-500/80 text-white rounded-full w-6 h-6 text-xs">✕</button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center w-full aspect-video bg-ink/[0.03] border border-dashed border-ink/20 rounded cursor-pointer hover:bg-ink/[0.06]">
                        <span className="text-ink/40 text-sm">+ 커버 이미지</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                      </label>
                    )}
                  </div>
                  
                  {/* 캐릭터 목록 */}
                  <h3 className="text-sm font-bold text-ink/60 mb-3">캐릭터 ({editingTRPG.characters.length})</h3>
                  <div className="space-y-3">
                    {editingTRPG.characters.map((char) => (
                      <div key={char.name} className="p-3 bg-ink/[0.03] rounded">
                        <div className="flex items-center gap-2 mb-2">
                          {char.avatar ? (
                            <img src={char.avatar} alt={char.name} className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                              style={{ backgroundColor: `${char.color}30`, color: char.color }}>
                              {char.name.charAt(0)}
                            </div>
                          )}
                          <span className="text-ink/80 text-sm flex-1">{char.name}</span>
                          <button onClick={() => handleCharacterPCToggle(char.name)}
                            className={`text-xs px-2 py-1 rounded ${char.isPC ? 'bg-blue-500/30 text-blue-600' : 'bg-ink/10 text-ink/40'}`}>
                            {char.isPC ? 'PC' : 'NPC'}
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="text"
                            value={char.avatar || ''}
                            onChange={(e) => {
                              const newChars = editingTRPG.characters.map(c =>
                                c.name === char.name ? { ...c, avatar: e.target.value || undefined } : c
                              )
                              setEditingTRPG({ ...editingTRPG, characters: newChars })
                            }}
                            placeholder="아바타 이미지 URL"
                            className="flex-1 bg-white/60 text-ink/70 text-xs px-2 py-1 rounded focus:outline-none"
                          />
                          <label className="text-xs text-ink/40 hover:text-ink/60 cursor-pointer">
                            <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              try {
                                const path = await uploadImage(file)
                                const newChars = editingTRPG.characters.map(c =>
                                  c.name === char.name ? { ...c, avatar: path } : c
                                )
                                setEditingTRPG({ ...editingTRPG, characters: newChars })
                              } catch (err: any) {
                                alert(`업로드 실패: ${err.message}`)
                              }
                            }} />
                            업로드
                          </label>
                        </div>
                        <ColorPicker color={char.color} onChange={(c) => handleCharacterColorChange(char.name, c)} />
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* 로그 편집 영역 */}
                <div className="flex-1 overflow-y-auto p-8 bg-bg">
                  <div className="max-w-3xl mx-auto pb-20">
                    <h2 className="text-xl font-bold text-ink/80 mb-6 pb-4 border-b border-ink/10">
                      로그 편집 ({editingTRPG.lines.length}줄)
                    </h2>
                    <DndContext collisionDetection={closestCenter} onDragEnd={handleTRPGLineDragEnd}>
                      <SortableContext items={editingTRPG.lines.map(l => l.id)} strategy={verticalListSortingStrategy}>
                        {editingTRPG.lines.map((line, idx) => (
                          <TRPGLineEditor key={line.id} line={line} characters={editingTRPG.characters}
                            onChange={(l) => handleTRPGLineChange(idx, l)}
                            onDelete={() => {
                              const lines = [...editingTRPG.lines]
                              lines.splice(idx, 1)
                              setEditingTRPG({...editingTRPG, lines})
                            }}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                    <button onClick={() => {
                      setEditingTRPG({...editingTRPG, lines: [...editingTRPG.lines, { id: generateId(), type: 'dialogue', speaker: '', text: '' }]})
                    }} className="w-full py-4 mt-4 border border-dashed border-ink/10 text-ink/20 hover:text-ink/50 rounded">+ 라인 추가</button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-ink/30 gap-4">
              <div className="text-4xl">🎲</div>
              <p>Roll20 HTML 파일을 업로드하거나 목록에서 선택하세요.</p>
            </div>
          )
        ) : activeTab === 'character' ? (
          // 캐릭터 에디터
          <>
            <div className="h-16 border-b border-ink/10 flex items-center justify-between px-6 bg-bg-cream">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-ink">{getCurrentCharPhase().nameKr}</span>
                <span className="text-sm text-ink/40">{getCurrentCharPhase().label}</span>
              </div>
              <div className="flex items-center gap-4">
                {charUploading && <span className="text-sm text-yellow-400">업로드 중...</span>}
                <span className="text-sm text-[#8B1538]">{message}</span>
                <button onClick={handleSaveCharacterData} className="bg-[#8B1538] hover:bg-[#A01840] text-white px-6 py-2 rounded font-bold">저장하기</button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 bg-bg">
              <div className="max-w-4xl mx-auto pb-20 space-y-8">
                
                {/* 프로필 이미지 & 보이스 */}
                <div className="grid grid-cols-2 gap-6">
                  {/* 프로필 이미지 */}
                  <div>
                    <h3 className="text-sm font-bold text-ink/60 mb-3 flex items-center gap-2">
                      <span>🖼️</span> 프로필 이미지
                    </h3>
                    {getCurrentCharPhase().profileImage ? (
                      <div className="relative">
                        <img src={getCurrentCharPhase().profileImage} className="w-full max-h-[400px] object-cover rounded border border-ink/10" />
                        <button onClick={() => updateCharPhase({ profileImage: undefined })}
                          className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm">✕</button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full aspect-[3/4] bg-ink/[0.03] border-2 border-dashed border-ink/15 rounded-lg cursor-pointer hover:bg-ink/[0.06] hover:border-ink/25 transition-colors">
                        <span className="text-3xl mb-2">📷</span>
                        <span className="text-ink/40 text-sm">클릭하여 이미지 업로드</span>
                        <span className="text-ink/20 text-xs mt-1">JPG, PNG, WebP</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleCharProfileUpload} />
                      </label>
                    )}
                    {getCurrentCharPhase().profileImage && (
                      <label className="flex items-center justify-center gap-2 w-full mt-2 py-2 bg-ink/[0.03] hover:bg-ink/[0.06] rounded cursor-pointer text-sm text-ink/50">
                        <span>🔄 이미지 변경</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleCharProfileUpload} />
                      </label>
                    )}
                  </div>

                  {/* 보이스 파일 */}
                  <div>
                    <h3 className="text-sm font-bold text-ink/60 mb-3 flex items-center gap-2">
                      <span>🔊</span> 보이스
                    </h3>
                    {getCurrentCharPhase().voiceFile ? (
                      <div className="p-4 bg-ink/[0.03] border border-ink/10 rounded-lg space-y-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${charTab === 'manon' ? 'bg-[#8B1538]/30 text-[#8B1538]' : 'bg-[#5E7B97]/30 text-[#5E7B97]'}`}>
                            ♪
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-ink/70 truncate">{getCurrentCharPhase().voiceLabel || '음성 파일'}</div>
                          </div>
                          <button onClick={() => updateCharPhase({ voiceFile: undefined, voiceLabel: undefined })}
                            className="text-ink/30 hover:text-red-500 text-lg">✕</button>
                        </div>
                        <audio controls src={getCurrentCharPhase().voiceFile} className="w-full h-10" />
                        <label className="flex items-center justify-center gap-2 w-full py-2 bg-ink/[0.03] hover:bg-ink/[0.06] rounded cursor-pointer text-sm text-ink/50">
                          <span>🔄 보이스 변경</span>
                          <input type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a" className="hidden" onChange={handleVoiceUpload} />
                        </label>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-40 bg-ink/[0.03] border-2 border-dashed border-ink/15 rounded-lg cursor-pointer hover:bg-ink/[0.06] hover:border-ink/25 transition-colors">
                        <span className="text-3xl mb-2">🎵</span>
                        <span className="text-ink/40 text-sm">클릭하여 보이스 업로드</span>
                        <span className="text-ink/20 text-xs mt-1">MP3, WAV, OGG, M4A</span>
                        <input type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a" className="hidden" onChange={handleVoiceUpload} />
                      </label>
                    )}
                  </div>
                </div>

                {/* 채팅 아바타 후보 */}
                <div>
                  <h3 className="text-sm font-bold text-ink/60 mb-3 flex items-center gap-2">
                    <span>💬</span> 채팅 아바타 후보
                  </h3>
                  <p className="text-xs text-ink/30 mb-3">역극 기록마다 선택할 수 있는 아바타 후보를 등록하세요.</p>
                  <div className="flex flex-wrap gap-3 mb-3">
                    {(characterData[charTab === 'manon' ? 'manonAvatars' : 'dylanAvatars'] || []).map((url, idx) => (
                      <div key={idx} className="relative group">
                        <img src={url} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-ink/10" />
                        <button onClick={() => {
                          const key = charTab === 'manon' ? 'manonAvatars' : 'dylanAvatars'
                          const arr = [...(characterData[key] || [])]
                          arr.splice(idx, 1)
                          setCharacterData(prev => ({ ...prev, [key]: arr }))
                        }} className="absolute -top-1 -right-1 bg-red-500/80 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100">✕</button>
                      </div>
                    ))}
                    <label className="w-16 h-16 rounded-full border-2 border-dashed border-ink/15 flex items-center justify-center cursor-pointer hover:bg-ink/[0.03] text-ink/30 text-lg">
                      +
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setCharUploading(true)
                        try {
                          const path = await uploadImage(file)
                          const key = charTab === 'manon' ? 'manonAvatars' : 'dylanAvatars'
                          setCharacterData(prev => ({ ...prev, [key]: [...(prev[key] || []), path] }))
                        } catch (err: any) { alert(`업로드 실패: ${err.message}`) }
                        setCharUploading(false)
                        e.target.value = ''
                      }} />
                    </label>
                  </div>
                </div>

                {/* 기본 정보 */}
                <div>
                  <h3 className="text-sm font-bold text-ink/60 mb-3 flex items-center gap-2">
                    <span>📋</span> 기본 정보
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-ink/30 mb-1 block">페이즈 라벨</label>
                      <input value={getCurrentCharPhase().label} onChange={(e) => updateCharPhase({ label: e.target.value })}
                        className="w-full bg-white/60 border border-ink/10 rounded px-3 py-2 text-ink text-sm focus:outline-none focus:border-ink/25" placeholder="PHASE 00" />
                    </div>
                    <div>
                      <label className="text-xs text-ink/30 mb-1 block">한국어 이름</label>
                      <input value={getCurrentCharPhase().nameKr} onChange={(e) => updateCharPhase({ nameKr: e.target.value })}
                        className="w-full bg-white/60 border border-ink/10 rounded px-3 py-2 text-ink text-sm focus:outline-none focus:border-ink/25" />
                    </div>
                    <div>
                      <label className="text-xs text-ink/30 mb-1 block">영어 이름</label>
                      <input value={getCurrentCharPhase().nameEn} onChange={(e) => updateCharPhase({ nameEn: e.target.value })}
                        className="w-full bg-white/60 border border-ink/10 rounded px-3 py-2 text-ink text-sm focus:outline-none focus:border-ink/25" />
                    </div>
                    <div>
                      <label className="text-xs text-ink/30 mb-1 block">한자 심볼</label>
                      <input value={getCurrentCharPhase().symbol} onChange={(e) => updateCharPhase({ symbol: e.target.value })}
                        className="w-full bg-white/60 border border-ink/10 rounded px-3 py-2 text-ink text-sm focus:outline-none focus:border-ink/25" />
                    </div>
                    <div>
                      <label className="text-xs text-ink/30 mb-1 block">별명</label>
                      <input value={getCurrentCharPhase().name} onChange={(e) => updateCharPhase({ name: e.target.value })}
                        className="w-full bg-white/60 border border-ink/10 rounded px-3 py-2 text-ink text-sm focus:outline-none focus:border-ink/25" />
                    </div>
                    <div>
                      <label className="text-xs text-ink/30 mb-1 block">나이</label>
                      <input value={getCurrentCharPhase().age} onChange={(e) => updateCharPhase({ age: e.target.value })}
                        className="w-full bg-white/60 border border-ink/10 rounded px-3 py-2 text-ink text-sm focus:outline-none focus:border-ink/25" />
                    </div>
                    <div>
                      <label className="text-xs text-ink/30 mb-1 block">키</label>
                      <input value={getCurrentCharPhase().height} onChange={(e) => updateCharPhase({ height: e.target.value })}
                        className="w-full bg-white/60 border border-ink/10 rounded px-3 py-2 text-ink text-sm focus:outline-none focus:border-ink/25" />
                    </div>
                    <div>
                      <label className="text-xs text-ink/30 mb-1 block">몸무게</label>
                      <input value={getCurrentCharPhase().weight} onChange={(e) => updateCharPhase({ weight: e.target.value })}
                        className="w-full bg-white/60 border border-ink/10 rounded px-3 py-2 text-ink text-sm focus:outline-none focus:border-ink/25" />
                    </div>
                    <div>
                      <label className="text-xs text-ink/30 mb-1 block">인용구</label>
                      <input value={getCurrentCharPhase().quote} onChange={(e) => updateCharPhase({ quote: e.target.value })}
                        className="w-full bg-white/60 border border-ink/10 rounded px-3 py-2 text-ink text-sm focus:outline-none focus:border-ink/25" />
                    </div>
                  </div>
                </div>

                {/* 성격 태그 */}
                <div>
                  <h3 className="text-sm font-bold text-ink/60 mb-3 flex items-center gap-2">
                    <span>💠</span> 성격 태그
                  </h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {getCurrentCharPhase().personality.map((tag, idx) => (
                      <div key={idx} className="flex items-center gap-1 bg-white/60 border border-ink/10 rounded px-2 py-1">
                        <input value={tag} onChange={(e) => handleUpdatePersonality(idx, e.target.value)}
                          className="bg-transparent text-sm text-ink/80 w-20 focus:outline-none" />
                        <button onClick={() => handleDeletePersonality(idx)} className="text-ink/30 hover:text-red-500 text-xs">✕</button>
                      </div>
                    ))}
                    <button onClick={handleAddPersonality}
                      className="px-3 py-1 border border-dashed border-ink/20 rounded text-ink/30 hover:text-ink/60 text-sm">+ 추가</button>
                  </div>
                </div>

                {/* 스탯 */}
                <div>
                  <h3 className="text-sm font-bold text-ink/60 mb-3 flex items-center gap-2">
                    <span>📊</span> 스탯
                  </h3>
                  <div className="space-y-2">
                    {(getCurrentCharPhase().stats || []).map((stat, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <input value={stat.label} onChange={(e) => handleUpdateStat(idx, 'label', e.target.value)}
                          className="bg-white/60 border border-ink/10 rounded px-2 py-1.5 text-ink text-sm w-24 focus:outline-none" />
                        <input type="range" min="0" max="10" value={stat.value}
                          onChange={(e) => handleUpdateStat(idx, 'value', parseInt(e.target.value))}
                          className="flex-1 accent-[#8B1538]" />
                        <span className="text-ink/50 text-sm w-6 text-center">{stat.value}</span>
                        <button onClick={() => handleDeleteStat(idx)} className="text-ink/30 hover:text-red-500">✕</button>
                      </div>
                    ))}
                    <button onClick={handleAddStat}
                      className="w-full py-2 border border-dashed border-ink/15 rounded text-ink/30 hover:text-ink/60 text-sm">+ 스탯 추가</button>
                  </div>
                </div>

                {/* 능력 */}
                <div>
                  <h3 className="text-sm font-bold text-ink/60 mb-3 flex items-center gap-2">
                    <span>⚡</span> 능력
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-ink/30 mb-1 block">능력 이름</label>
                      <input value={getCurrentCharPhase().abilityName} onChange={(e) => updateCharPhase({ abilityName: e.target.value })}
                        className="w-full bg-white/60 border border-ink/10 rounded px-3 py-2 text-ink text-sm focus:outline-none focus:border-ink/25" />
                    </div>
                    <div>
                      <label className="text-xs text-ink/30 mb-1 block">능력 설명</label>
                      <textarea value={getCurrentCharPhase().abilityDesc} onChange={(e) => updateCharPhase({ abilityDesc: e.target.value })}
                        className="w-full bg-white/60 border border-ink/10 rounded px-3 py-2 text-ink text-sm focus:outline-none focus:border-ink/25 resize-none"
                        rows={3} />
                    </div>
                  </div>
                </div>

                {/* 메인 대사 */}
                <div>
                  <h3 className="text-sm font-bold text-ink/60 mb-3 flex items-center gap-2">
                    <span>💬</span> 메인 대사
                  </h3>
                  <textarea value={getCurrentCharPhase().mainQuote} onChange={(e) => updateCharPhase({ mainQuote: e.target.value })}
                    className="w-full bg-white/60 border border-ink/10 rounded px-3 py-2 text-ink text-sm focus:outline-none focus:border-ink/25 resize-none"
                    rows={3} />
                </div>

              </div>
            </div>
          </>
        ) : activeTab === 'game' ? (
          // 게임 대사 에디터
          <>
            <div className="h-16 border-b border-ink/10 flex items-center justify-between px-6 bg-bg-cream">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-ink">
                  {gameTab === 'foreword' ? 'Foreword by KIM MINJAE' : 'Rebuttal by LEE SUN'}
                </span>
              </div>
              <div className="flex items-center gap-4">
                {gameUploading && <span className="text-sm text-yellow-400">업로드 중...</span>}
                <span className="text-sm text-[#8B1538]">{message}</span>
                <button onClick={handleSaveGameData} className="bg-[#8B1538] hover:bg-[#A01840] text-white px-6 py-2 rounded font-bold">저장하기</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-bg">
              <div className="max-w-4xl mx-auto pb-20 space-y-8">

                {/* 캐릭터 이미지 + 그리기 캔버스 */}
                <div>
                  <h3 className="text-sm font-bold text-ink/60 mb-3">캐릭터 이미지</h3>
                  {currentGameSection.characterImage ? (
                    <div className="space-y-3">
                      <div className="relative inline-block">
                        <img src={currentGameSection.characterImage} className="max-h-[70vh] rounded border border-ink/10" />
                        <button onClick={() => updateGameSection({ characterImage: undefined })}
                          className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm">✕</button>
                        <label className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded px-3 py-1 text-xs cursor-pointer">
                          변경
                          <input type="file" accept="image/*" className="hidden" onChange={handleGameImageUpload} />
                        </label>
                      </div>

                      {/* 그리기 캔버스 */}
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-sm font-bold text-ink/60">부위 그리기</h3>
                          {drawingPartIdx !== null && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-[#8B1538]/10 text-[#8B1538] font-bold animate-pulse">
                              그리기 모드 — 이미지를 클릭하여 꼭짓점 추가
                            </span>
                          )}
                        </div>
                        <div
                          ref={gameCanvasRef}
                          className="relative inline-block select-none"
                          style={{ cursor: draggingVertex ? 'grabbing' : drawingPartIdx !== null ? 'crosshair' : 'default' }}
                          onClick={draggingVertex ? undefined : handleImageClick}
                          onMouseMove={handleCanvasMouseMove}
                          onMouseUp={handleCanvasMouseUp}
                          onMouseLeave={handleCanvasMouseUp}
                        >
                          <img ref={gameImgRef} src={currentGameSection.characterImage} className="max-w-full max-h-[80vh] rounded border border-ink/10" draggable={false} />
                          {/* SVG 오버레이 */}
                          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none"
                            style={{ pointerEvents: 'none' }}>
                            {currentGameSection.parts.map((part, idx) => {
                              const pts = part.points && part.points.length >= 3 ? part.points : null
                              if (!pts) return null
                              const accent = gameTab === 'foreword' ? '#8B1538' : '#5E7B97'
                              const isDrawing = drawingPartIdx === idx
                              return (
                                <g key={part.id}>
                                  <polygon
                                    points={pts.map(p => `${p[0]},${p[1]}`).join(' ')}
                                    fill={isDrawing ? `${accent}22` : `${accent}15`}
                                    stroke={accent}
                                    strokeWidth="0.5"
                                    strokeDasharray={isDrawing ? '1.5 1' : 'none'}
                                  />
                                  {/* 라벨 */}
                                  {(() => {
                                    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length
                                    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length
                                    return (
                                      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
                                        fill={accent} fontSize="2.5" fontWeight="bold">{part.label}</text>
                                    )
                                  })()}
                                  {/* 드래그 가능한 꼭짓점 */}
                                  {drawingPartIdx === null && pts.map((p, pi) => (
                                    <circle key={pi} cx={p[0]} cy={p[1]} r="1.2"
                                      fill="white" stroke={accent} strokeWidth="0.4"
                                      style={{ pointerEvents: 'auto', cursor: 'grab' }}
                                      onMouseDown={(e) => handleVertexMouseDown(e as any, idx, pi)} />
                                  ))}
                                </g>
                              )
                            })}
                            {/* 현재 그리기 중인 임시 점들 */}
                            {drawingPartIdx !== null && drawingPoints.length > 0 && (
                              <g>
                                {drawingPoints.length >= 2 && (
                                  <polyline
                                    points={drawingPoints.map(p => `${p[0]},${p[1]}`).join(' ')}
                                    fill="none"
                                    stroke={gameTab === 'foreword' ? '#8B1538' : '#5E7B97'}
                                    strokeWidth="0.4"
                                    strokeDasharray="1.5 1"
                                  />
                                )}
                                {drawingPoints.map((p, pi) => (
                                  <circle key={pi} cx={p[0]} cy={p[1]} r="0.8"
                                    fill={gameTab === 'foreword' ? '#8B1538' : '#5E7B97'} />
                                ))}
                              </g>
                            )}
                          </svg>
                        </div>

                        {/* 그리기 도구 */}
                        {drawingPartIdx !== null && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-ink/40">{drawingPoints.length}개 점</span>
                            <button onClick={undoLastPoint}
                              className="text-xs px-2 py-1 bg-ink/5 hover:bg-ink/10 rounded text-ink/50" disabled={drawingPoints.length === 0}>
                              ↩ 되돌리기
                            </button>
                            <button onClick={finishDrawing}
                              className="text-xs px-3 py-1 bg-[#8B1538] hover:bg-[#A01840] text-white rounded font-bold"
                              disabled={drawingPoints.length < 3}>
                              ✓ 완료 ({drawingPoints.length < 3 ? `최소 ${3 - drawingPoints.length}점 더` : '닫기'})
                            </button>
                            <button onClick={() => { setDrawingPartIdx(null); setDrawingPoints([]) }}
                              className="text-xs px-2 py-1 text-ink/30 hover:text-red-500">
                              취소
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full max-w-md aspect-[3/4] bg-ink/[0.03] border-2 border-dashed border-ink/15 rounded-lg cursor-pointer hover:bg-ink/[0.06]">
                      <span className="text-3xl mb-2">📷</span>
                      <span className="text-ink/40 text-sm">캐릭터 이미지 업로드</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleGameImageUpload} />
                    </label>
                  )}
                </div>

                {/* 부위 목록 */}
                <div>
                  <h3 className="text-sm font-bold text-ink/60 mb-3">부위 목록 ({currentGameSection.parts.length})</h3>
                  <div className="space-y-3">
                    {currentGameSection.parts.map((part, idx) => (
                      <div key={part.id} className={`p-4 border rounded-lg space-y-3 group ${drawingPartIdx === idx ? 'border-[#8B1538]/40 bg-[#8B1538]/5' : 'border-ink/10 bg-white/50'}`}>
                        <div className="flex items-center justify-between">
                          <input value={part.label} onChange={(e) => handleUpdateBodyPart(idx, { label: e.target.value })}
                            className="bg-transparent text-ink font-bold text-sm focus:outline-none border-b border-transparent focus:border-ink/20 w-40"
                            placeholder="부위 이름 (예: 눈)" />
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-ink/25">{part.points && part.points.length >= 3 ? `${part.points.length}각형` : '영역 없음'}</span>
                            {drawingPartIdx !== idx ? (
                              <button onClick={() => restartDrawing(idx)}
                                className="text-xs px-2 py-0.5 bg-ink/5 hover:bg-ink/10 rounded text-ink/40 hover:text-ink/70">
                                {part.points && part.points.length >= 3 ? '다시 그리기' : '그리기'}
                              </button>
                            ) : (
                              <span className="text-[10px] text-[#8B1538] font-bold">그리기 중...</span>
                            )}
                            <button onClick={() => handleDeleteBodyPart(idx)}
                              className="text-ink/20 hover:text-red-500 text-sm opacity-0 group-hover:opacity-100">✕</button>
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-ink/30 block mb-1">대사</label>
                          <textarea value={part.dialogue}
                            onChange={(e) => handleUpdateBodyPart(idx, { dialogue: e.target.value })}
                            className="w-full bg-white/60 border border-ink/10 rounded px-3 py-2 text-sm text-ink focus:outline-none resize-none"
                            rows={3} placeholder="이 부위를 클릭했을 때 표시될 대사..." />
                        </div>
                      </div>
                    ))}
                    <button onClick={handleAddBodyPart}
                      className="w-full py-4 border border-dashed border-ink/15 text-ink/30 hover:text-ink/60 rounded-lg">+ 부위 추가</button>
                  </div>
                </div>

              </div>
            </div>
          </>
        ) : activeTab === 'au' ? (
          // AU 에디터
          <>
            <div className="h-16 border-b border-ink/10 flex items-center justify-between px-6 bg-bg-cream">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-ink">
                  {auList[auSelectedIdx]?.title || 'AU'}
                </span>
                <span className="text-sm text-ink/40">
                  {auList.length > 0 ? `${auSelectedIdx + 1} / ${auList.length}` : ''}
                </span>
              </div>
              <span className="text-xs text-ink/30">변경 시 자동 저장됩니다</span>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {auList.length === 0 ? (
                <div className="text-center text-ink/30 py-20">
                  <p className="text-lg italic mb-2">AU가 없습니다</p>
                  <p className="text-sm">왼쪽에서 "+ 새 AU 추가" 버튼을 눌러주세요.</p>
                </div>
              ) : auList[auSelectedIdx] ? (() => {
                const au = auList[auSelectedIdx]
                const idx = auSelectedIdx
                return (
                  <div className="max-w-5xl mx-auto space-y-6">
                    {/* AU 메타 */}
                    <div className="space-y-3 p-5 bg-white/50 border border-ink/10 rounded-lg">
                      <h3 className="text-sm font-bold text-ink/60">AU 정보</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] text-ink/40 block mb-1">제목</label>
                          <input value={au.title || ''}
                            onChange={(e) => updateAU(idx, { title: e.target.value })}
                            className="w-full bg-white border border-ink/10 rounded px-3 py-2 text-sm text-ink focus:outline-none focus:border-[#8B1538]/40"
                            placeholder="예: 한국 국적 AU" />
                        </div>
                        <div>
                          <label className="text-[11px] text-ink/40 block mb-1">부제 (작은 글씨)</label>
                          <input value={au.subtitle || ''}
                            onChange={(e) => updateAU(idx, { subtitle: e.target.value })}
                            className="w-full bg-white border border-ink/10 rounded px-3 py-2 text-sm text-ink focus:outline-none focus:border-[#8B1538]/40"
                            placeholder="예: 검은 들녘 위의 이데아" />
                        </div>
                        <div>
                          <label className="text-[11px] text-ink/40 block mb-1">관계 (가운데 표시)</label>
                          <input value={au.relationship || ''}
                            onChange={(e) => updateAU(idx, { relationship: e.target.value })}
                            className="w-full bg-white border border-ink/10 rounded px-3 py-2 text-sm text-ink focus:outline-none focus:border-[#8B1538]/40"
                            placeholder="예: 연인, ?, 적, ⟷" />
                        </div>
                        <div>
                          <label className="text-[11px] text-ink/40 block mb-1">테마 색상 (관계 텍스트 색)</label>
                          <div className="flex gap-2">
                            <input type="color" value={au.themeColor || '#D9809A'}
                              onChange={(e) => updateAU(idx, { themeColor: e.target.value })}
                              className="h-9 w-16 rounded border border-ink/10" />
                            <input value={au.themeColor || ''}
                              onChange={(e) => updateAU(idx, { themeColor: e.target.value })}
                              className="flex-1 bg-white border border-ink/10 rounded px-3 py-2 text-sm text-ink focus:outline-none font-mono"
                              placeholder="#D9809A" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 두 캐릭터 카드 */}
                    <div className="grid grid-cols-2 gap-4">
                      {(['manon', 'dylan'] as const).map(who => {
                        const accent = who === 'manon' ? '#D9809A' : '#888888'
                        const character = au[who] || { name: '', image: '', dialogue: '' }
                        return (
                          <div key={who} className="p-5 bg-white/50 border border-ink/10 rounded-lg space-y-3"
                            style={{ borderLeftColor: accent, borderLeftWidth: '3px' }}>
                            <h3 className="text-sm font-bold" style={{ color: accent }}>
                              {who === 'manon' ? 'KIM MINJAE (분홍)' : 'LEE SUN (무채색)'}
                            </h3>

                            {/* 이미지 업로드 */}
                            <div>
                              <label className="text-[11px] text-ink/40 block mb-1">이미지</label>
                              {character.image ? (
                                <div className="relative group">
                                  <img src={character.image} alt={who}
                                    className="w-full aspect-[3/4] object-cover rounded border border-ink/10" />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                    <label className="bg-white/90 px-3 py-1 rounded text-xs cursor-pointer">
                                      교체
                                      <input type="file" accept="image/*" className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0]
                                          if (file) handleAUImageUpload(idx, who, file)
                                        }} />
                                    </label>
                                    <button onClick={() => updateAUCharacter(idx, who, { image: '' })}
                                      className="bg-red-500/90 text-white px-3 py-1 rounded text-xs">삭제</button>
                                  </div>
                                </div>
                              ) : (
                                <label className="flex flex-col items-center justify-center w-full aspect-[3/4] bg-ink/[0.03] border-2 border-dashed border-ink/15 rounded cursor-pointer hover:bg-ink/[0.06]">
                                  {auUploadingFor?.idx === idx && auUploadingFor?.who === who ? (
                                    <span className="text-ink/40 text-sm">업로드 중...</span>
                                  ) : (
                                    <>
                                      <span className="text-2xl mb-1">📷</span>
                                      <span className="text-ink/40 text-xs">이미지 업로드</span>
                                    </>
                                  )}
                                  <input type="file" accept="image/*" className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0]
                                      if (file) handleAUImageUpload(idx, who, file)
                                    }} />
                                </label>
                              )}
                            </div>

                            {/* 이름 */}
                            <div>
                              <label className="text-[11px] text-ink/40 block mb-1">이름 (이 AU에서)</label>
                              <input value={character.name || ''}
                                onChange={(e) => updateAUCharacter(idx, who, { name: e.target.value })}
                                className="w-full bg-white border border-ink/10 rounded px-3 py-2 text-sm text-ink focus:outline-none"
                                placeholder={who === 'manon' ? '예: 백연우' : '예: 서정원'} />
                            </div>

                            {/* 대사 */}
                            <div>
                              <label className="text-[11px] text-ink/40 block mb-1">대사 / 인용</label>
                              <textarea value={character.dialogue || ''}
                                onChange={(e) => updateAUCharacter(idx, who, { dialogue: e.target.value })}
                                rows={3}
                                className="w-full bg-white border border-ink/10 rounded px-3 py-2 text-sm text-ink focus:outline-none resize-none"
                                placeholder="이 캐릭터의 대사 또는 인용..." />
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* 미리보기 링크 */}
                    <div className="flex justify-center pt-2">
                      <a href="/timeline" target="_blank" rel="noreferrer"
                        className="text-xs text-[#8B1538] hover:underline">
                        ↗ /timeline 페이지에서 미리보기
                      </a>
                    </div>
                  </div>
                )
              })() : null}
            </div>
          </>
        ) : activeTab === 'sheets' ? (
          // 시트 리스트 에디터
          <>
            <div className="h-16 border-b border-ink/10 flex items-center justify-between px-6 bg-bg-cream">
              <div className="flex items-baseline gap-3">
                <span className="text-lg font-bold text-ink italic">시트 리스트</span>
                <span className="text-sm text-ink/40">sheet list</span>
              </div>
              <span className="text-xs text-ink/30">변경 시 자동 저장됩니다</span>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-bg">
              <p className="text-xs text-ink/40 mb-4 max-w-3xl">
                체크리스트, 외부 시트, 링크 등을 정리해둡니다. 어드민 로그인 시에만 보입니다.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-5xl">
                <DndContext collisionDetection={closestCenter} onDragEnd={reorderSheets}>
                  <SortableContext items={sheetsList.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    {sheetsList.map((sheet, idx) => (
                      <SortableSheetCard key={sheet.id} sheet={sheet} idx={idx}
                        onDelete={() => handleDeleteSheet(idx)}
                        onUpdate={(updates) => updateSheet(idx, updates)} />
                    ))}
                  </SortableContext>
                </DndContext>

                {sheetsList.length === 0 && (
                  <div className="col-span-full text-center text-ink/30 py-16">
                    <p className="text-lg italic mb-2">시트가 없습니다</p>
                    <p className="text-sm">왼쪽에서 "+ 새 시트 추가" 버튼을 눌러주세요.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : activeTab === 'timeline' ? (
          timelineEvents.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-ink/30 flex-col gap-3">
              <p className="text-lg italic">이벤트가 없습니다</p>
              <p className="text-sm">왼쪽에서 "+ 새 이벤트 추가"를 눌러주세요.</p>
            </div>
          ) : (
            <>
              <div className="h-16 border-b border-ink/10 flex items-center justify-between px-6 bg-bg-cream">
                <span className="font-bold text-ink/70">
                  {timelineEvents[timelineSelectedIdx]?.title || '이벤트 편집'}
                </span>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-[#8B1538]">{message}</span>
                  <button onClick={() => saveTimeline(timelineEvents)}
                    className="bg-[#8B1538] hover:bg-[#A01840] text-white px-6 py-2 rounded font-bold text-sm">
                    저장하기
                  </button>
                </div>
              </div>
              {timelineEvents[timelineSelectedIdx] && (
                <div className="flex-1 overflow-y-auto p-6 space-y-4 max-w-2xl">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-ink/40 block mb-1">날짜/시기</label>
                      <input
                        value={timelineEvents[timelineSelectedIdx].storyDate || ''}
                        onChange={e => updateTimelineEvent(timelineSelectedIdx, { storyDate: e.target.value })}
                        placeholder="e.g. Year 1, Spring"
                        className="w-full border border-ink/15 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#8B1538]/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-ink/40 block mb-1">유형</label>
                      <select
                        value={timelineEvents[timelineSelectedIdx].type || 'event'}
                        onChange={e => updateTimelineEvent(timelineSelectedIdx, { type: e.target.value })}
                        className="w-full border border-ink/15 rounded px-3 py-2 text-sm bg-white focus:outline-none">
                        <option value="event">Event</option>
                        <option value="milestone">Milestone</option>
                        <option value="memory">Memory</option>
                        <option value="turning">Turning Point</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-ink/40 block mb-1">제목</label>
                    <input
                      value={timelineEvents[timelineSelectedIdx].title || ''}
                      onChange={e => updateTimelineEvent(timelineSelectedIdx, { title: e.target.value })}
                      placeholder="이벤트 제목"
                      className="w-full border border-ink/15 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#8B1538]/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-ink/40 block mb-1">관련 캐릭터</label>
                    <select
                      value={timelineEvents[timelineSelectedIdx].character || 'both'}
                      onChange={e => updateTimelineEvent(timelineSelectedIdx, { character: e.target.value })}
                      className="w-full border border-ink/15 rounded px-3 py-2 text-sm bg-white focus:outline-none">
                      <option value="both">KIM MINJAE × LEE SUN</option>
                      <option value="manon">KIM MINJAE</option>
                      <option value="dylan">LEE SUN</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-ink/40 block mb-1">내용</label>
                    <textarea
                      value={timelineEvents[timelineSelectedIdx].description || ''}
                      onChange={e => updateTimelineEvent(timelineSelectedIdx, { description: e.target.value })}
                      placeholder="이벤트 상세 내용..."
                      rows={8}
                      className="w-full border border-ink/15 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#8B1538]/50 resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-ink/40 block mb-1">순서 (숫자가 작을수록 먼저)</label>
                    <input
                      type="number"
                      value={timelineEvents[timelineSelectedIdx].order ?? timelineSelectedIdx}
                      onChange={e => updateTimelineEvent(timelineSelectedIdx, { order: Number(e.target.value) })}
                      className="w-32 border border-ink/15 rounded px-3 py-2 text-sm bg-white focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </>
          )
        ) : activeTab === 'chat' ? (
          <ChatAdminPanel
            messages={chatMessages}
            message={message}
            onRefresh={fetchChat}
            onUpdate={(msgs) => setChatMessages(msgs)}
            onMessageChange={(id, patch) => {
              const next = chatMessages.map(m => m.id === id ? { ...m, ...patch } : m)
              setChatMessages(next)
            }}
          />
        ) : null}
      </div>
    </div>
  )
}

function ChatAdminPanel({ messages, message, onRefresh, onUpdate, onMessageChange }: {
  messages: any[]
  message: string
  onRefresh: () => void
  onUpdate: (msgs: any[]) => void
  onMessageChange: (id: string, patch: any) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editSender, setEditSender] = useState<'manon' | 'dylan'>('manon')
  const [saving, setSaving] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
  }, [messages.length])

  const startEdit = (msg: any) => {
    setEditingId(msg.id)
    setEditContent(msg.content || '')
    setEditSender(msg.sender)
  }

  const cancelEdit = () => { setEditingId(null) }

  const saveEdit = async (id: string) => {
    setSaving(true)
    try {
      await fetch('/api/chat', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, content: editContent, sender: editSender }),
      })
      onMessageChange(id, { content: editContent, sender: editSender })
      setEditingId(null)
    } catch {}
    setSaving(false)
  }

  const deleteMsg = async (id: string) => {
    if (!confirm('이 메시지를 삭제할까요?')) return
    try {
      await fetch(`/api/chat?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      onUpdate(messages.filter(m => m.id !== id))
    } catch {}
  }

  return (
    <>
      <div className="h-16 border-b border-ink/10 flex items-center justify-between px-6 bg-bg-cream">
        <div className="flex items-baseline gap-3">
          <span className="font-bold text-ink/70">채팅 내역</span>
          <span className="text-xs text-ink/35">{messages.length}개 메시지</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#8B1538]">{message}</span>
          <button onClick={onRefresh}
            className="text-xs text-ink/50 hover:text-ink/80 border border-ink/15 px-3 py-1.5 rounded">
            새로고침
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-ink/30">
            <p className="italic">채팅 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-2 max-w-2xl">
            {messages.map(msg => {
              const isManon = msg.sender === 'manon'
              const color = isManon ? '#D9809A' : '#888'
              const isEditing = editingId === msg.id

              return (
                <div key={msg.id}
                  className={`group relative flex flex-col ${isManon ? 'items-start' : 'items-end'}`}>
                  {/* Action buttons */}
                  <div className={`absolute top-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 ${isManon ? 'right-0' : 'left-0'}`}>
                    <button onClick={() => startEdit(msg)}
                      className="text-[10px] px-1.5 py-0.5 bg-white border border-ink/15 text-ink/50 hover:text-ink/80 rounded">
                      ✏ 편집
                    </button>
                    <button onClick={() => deleteMsg(msg.id)}
                      className="text-[10px] px-1.5 py-0.5 bg-white border border-red-200 text-red-400 hover:text-red-600 rounded">
                      × 삭제
                    </button>
                  </div>

                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-xs font-medium italic" style={{ color }}>
                      {isManon ? 'KIM MINJAE' : 'LEE SUN'}
                    </span>
                    <span className="text-[10px] text-ink/30">
                      {new Date(msg.timestamp).toLocaleString('ko-KR', {
                        month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {isEditing ? (
                    <div className="w-full max-w-md space-y-2 p-3 bg-white border border-[#8B1538]/30 rounded">
                      <div className="flex gap-2 mb-2">
                        {(['manon', 'dylan'] as const).map(s => (
                          <button key={s}
                            onClick={() => setEditSender(s)}
                            className={`flex-1 py-1 rounded text-xs font-medium italic ${
                              editSender === s
                                ? s === 'manon' ? 'bg-[#D9809A]/20 text-[#D9809A] border border-[#D9809A]/40' : 'bg-gray-100 text-gray-600 border border-gray-300'
                                : 'bg-ink/[0.03] text-ink/30'
                            }`}>
                            {CHARACTER_LABELS[s]}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        rows={3}
                        className="w-full border border-ink/15 rounded px-2 py-1.5 text-sm text-ink/80 resize-none focus:outline-none focus:border-[#8B1538]/40"
                        autoFocus
                      />
                      {msg.imageUrl && (
                        <img src={msg.imageUrl} alt="" className="max-h-24 object-cover rounded" />
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(msg.id)} disabled={saving}
                          className="flex-1 py-1.5 bg-[#8B1538] hover:bg-[#A01840] text-white text-xs rounded">
                          {saving ? '저장 중…' : '저장'}
                        </button>
                        <button onClick={cancelEdit}
                          className="flex-1 py-1.5 bg-ink/[0.04] text-ink/50 text-xs rounded border border-ink/10">
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-[75%] overflow-hidden rounded border border-ink/10 bg-white">
                      {msg.imageUrl && (
                        <img src={msg.imageUrl} alt="" className="max-h-32 object-cover w-full" />
                      )}
                      {msg.content && (
                        <p className="px-3 py-2 text-sm text-ink/80">{msg.content}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </>
  )
}
