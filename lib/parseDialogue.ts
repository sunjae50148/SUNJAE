// --- 타입 정의 ---
export interface DialogueLine {
  id: string
  speaker: string
  text: string
  images?: string[] // Vercel Blob URL 배열 (예: ['https://xxx.blob.vercel-storage.com/abc.jpg'])
}

export interface Section {
  id: string
  title: string
  lines: DialogueLine[]
  manonAvatar?: string
  dylanAvatar?: string
  password?: string
}

export interface Phase {
  id: string
  name: string
  sections: Section[]
}

export interface DialogueRecord {
  id: string
  title: string
  phases: Phase[]
  createdAt: string
  updatedAt: string
  password?: string
}

// --- TRPG 타입 정의 ---
export interface TRPGLine {
  id: string
  type: 'narration' | 'dialogue' | 'roll' | 'system' | 'emote' | 'diceroll' | 'madness'
  speaker?: string
  text: string
  images?: string[]
  rollData?: {
    skillName: string
    target: number
    rolled: number
    result: 'critical' | 'extreme' | 'hard' | 'success' | 'fail' | 'fumble'
    rolledAll?: number[]
    bonusResults?: { bonus: number; result: 'critical' | 'extreme' | 'hard' | 'success' | 'fail' | 'fumble' }[]
  }
  diceData?: {
    formula: string
    dice: { value: number; sides: number; crit?: 'success' | 'fail' }[]
    total: number
  }
  madnessData?: {
    title: string
    effectName: string
    effectDesc: string
    rounds?: number
    duration?: number
  }
}

export interface TRPGCharacter {
  name: string
  color: string
  isPC?: boolean
  avatar?: string
}

export interface TRPGSession {
  id: string
  title: string
  coverImage?: string
  date?: string
  characters: TRPGCharacter[]
  lines: TRPGLine[]
  createdAt: string
  updatedAt: string
  password?: string
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

function normalizeSpeaker(speaker: string): string {
  const normalized = speaker.trim()
  const nameMap: Record<string, string> = {
    '사드함': '사드함',
    '사드함 눈': '사드함',
    '메디아': '메디아',
    '메디아 아우렐리우스': '메디아',
  }
  return nameMap[normalized] || normalized
}

export function parseDialogue(text: string, recordTitle: string = '새 기록'): DialogueRecord {
  const phases: Phase[] = []
  const lines = text.split('\n').map(l => l.trim())

  let currentPhase: Phase | null = null
  let currentSection: Section | null = null
  let currentSpeaker: string | null = null

  const ensureContext = () => {
    if (!currentPhase) {
      currentPhase = { id: generateId(), name: '기록', sections: [] }
    }
    if (!currentSection) {
      currentSection = { id: generateId(), title: '대화', lines: [] }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (!line) {
      currentSpeaker = null
      continue
    }

    if (line.match(/^\d+차$/)) {
      if (currentSection && currentPhase && currentSection.lines.length > 0) {
        currentPhase.sections.push(currentSection)
        currentSection = null
      }
      if (currentPhase && currentPhase.sections.length > 0) {
        phases.push(currentPhase)
      }
      currentPhase = { id: generateId(), name: line, sections: [] }
      currentSpeaker = null
      continue
    }

    const sectionMatch = line.match(/^\[(.+)\]$/)
    if (sectionMatch) {
      ensureContext()
      if (currentSection && currentSection.lines.length > 0) {
        currentPhase!.sections.push(currentSection)
      }
      currentSection = { id: generateId(), title: sectionMatch[1], lines: [] }
      currentSpeaker = null
      continue
    }

    ensureContext()

    if (!currentSpeaker) {
      if (line.match(/^[·\-─═]+$/)) continue;
      currentSpeaker = normalizeSpeaker(line)
      continue 
    }

    if (currentSpeaker) {
      currentSection!.lines.push({
        id: generateId(),
        speaker: currentSpeaker,
        text: line
      })
    }
  }

  if (currentSection && currentPhase && currentSection.lines.length > 0) {
    currentPhase.sections.push(currentSection)
  }
  if (currentPhase) {
     if (currentPhase.sections.length === 0 && currentSection && currentSection.lines.length > 0) {
       currentPhase.sections.push(currentSection)
     }
     if (currentPhase.sections.length > 0) {
       phases.push(currentPhase)
     }
  }

  if (phases.length === 0) {
    phases.push({
      id: generateId(),
      name: '기록',
      sections: [{ id: generateId(), title: '대화', lines: [] }]
    })
  }

  return {
    id: generateId(),
    title: recordTitle,
    phases,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}