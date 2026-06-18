'use client'

import { useState, useEffect, useRef } from 'react'
import type { ChatMessage } from '@/app/api/chat/route'

const MANON_COLOR = '#D9809A'
const DYLAN_COLOR = '#C8C8C8'
const SENDER_COLORS = { manon: MANON_COLOR, dylan: DYLAN_COLOR }
const SENDER_LABELS = { manon: 'KIM MINJAE', dylan: 'LEE SUN' } as const

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

export default function ChatPopup() {
  const [open, setOpen] = useState(false)
  const [screen, setScreen] = useState<'select' | 'chat'>('select')
  const [chatAs, setChatAs] = useState<'manon' | 'dylan' | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [hasNew, setHasNew] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const lastIdRef = useRef<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Track login state
  useEffect(() => {
    const check = () => setIsLoggedIn(localStorage.getItem('same_admin_login') === 'true')
    check()
    window.addEventListener('storage', check)
    const interval = setInterval(check, 1000)
    return () => { window.removeEventListener('storage', check); clearInterval(interval) }
  }, [])

  // Restore character from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sunjae_chat_as')
    if (saved === 'manon' || saved === 'dylan') {
      setChatAs(saved)
      setScreen('chat')
    }
  }, [])

  const fetchMessages = async (silent = false) => {
    try {
      const res = await fetch('/api/chat')
      const data = await res.json()
      const msgs: ChatMessage[] = data.messages || []
      setMessages(msgs)
      if (msgs.length > 0) {
        const newest = msgs[msgs.length - 1]
        if (lastIdRef.current && newest.id !== lastIdRef.current && !open) setHasNew(true)
        lastIdRef.current = newest.id
      }
    } catch {}
  }

  useEffect(() => {
    fetchMessages(true)
    pollRef.current = setInterval(() => fetchMessages(), 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [open])

  useEffect(() => {
    if (open && screen === 'chat') {
      setHasNew(false)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, screen, messages.length])

  const selectCharacter = (char: 'manon' | 'dylan') => {
    setChatAs(char)
    localStorage.setItem('sunjae_chat_as', char)
    setScreen('chat')
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || sending || !chatAs) return
    setSending(true)
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: chatAs, content: input.trim() }),
      })
      setInput('')
      await fetchMessages(true)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
    } catch {}
    setSending(false)
  }

  const sendImage = async (file: File) => {
    if (!chatAs) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch('/api/upload-image', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.path) {
        await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender: chatAs, content: '', imageUrl: data.path }),
        })
        await fetchMessages(true)
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
      }
    } catch {}
    setUploading(false)
  }

  // Who is "me" vs "other"
  const isMyMessage = (msg: ChatMessage) => msg.sender === chatAs
  const myColor = chatAs ? SENDER_COLORS[chatAs] : MANON_COLOR
  const otherColor = chatAs === 'manon' ? DYLAN_COLOR : MANON_COLOR

  if (!isLoggedIn) return null

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed z-[500] flex items-center justify-center transition-all duration-300"
        style={{
          bottom: 'clamp(20px, 3vh, 32px)',
          right: 'clamp(20px, 3vw, 36px)',
          width: '42px', height: '42px',
          background: 'rgba(0,0,0,0.88)',
          border: `1px solid ${open ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)'}`,
          backdropFilter: 'blur(8px)',
        }}
        title="채팅"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 2.5h12a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5H9l-3 3v-3H2a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5z"
            stroke="rgba(255,255,255,0.6)" strokeWidth="1" fill="none" />
        </svg>
        {hasNew && !open && (
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: MANON_COLOR }} />
        )}
      </button>

      {open && (
        <div
          className="fixed z-[499] flex flex-col"
          style={{
            bottom: 'clamp(68px, 9vh, 84px)',
            right: 'clamp(20px, 3vw, 36px)',
            width: 'clamp(280px, 28vw, 360px)',
            height: 'clamp(360px, 48vh, 500px)',
            background: 'rgba(4,4,4,0.97)',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {screen === 'select' ? (
            <SelectScreen onSelect={selectCharacter} />
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center justify-between px-4 py-2.5" style={{
                borderBottom: '1px solid rgba(255,255,255,0.07)',
              }}>
                <div className="flex items-center gap-2">
                  <span className="label-caps" style={{
                    fontSize: '0.42rem', letterSpacing: '0.28em',
                    color: 'rgba(255,255,255,0.3)',
                  }}>LIVE CHAT</span>
                  <span className="inline-block w-1 h-1 rounded-full animate-pulse" style={{ background: MANON_COLOR }} />
                </div>
                <div className="flex items-center gap-2">
                  {/* Current character indicator */}
                  <button
                    onClick={() => { setScreen('select'); setChatAs(null); localStorage.removeItem('sunjae_chat_as') }}
                    style={{
                      fontFamily: "'Playfair Display', serif",
                      fontStyle: 'italic',
                      fontSize: '0.58rem',
                      color: myColor,
                      letterSpacing: '0.04em',
                      background: 'none', border: 'none', cursor: 'pointer',
                      opacity: 0.8,
                    }}
                    title="캐릭터 변경"
                  >
                    {chatAs ? SENDER_LABELS[chatAs] : ''} ↺
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="text-white/30 hover:text-white/70 transition-colors"
                    style={{ fontSize: '0.75rem', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2"
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
                {messages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="heading-condensed text-white/20" style={{ fontSize: '0.8rem', fontStyle: 'italic' }}>
                      No messages yet.
                    </p>
                  </div>
                ) : (
                  messages.map(msg => {
                    const mine = isMyMessage(msg)
                    const color = SENDER_COLORS[msg.sender]
                    return (
                      <div key={msg.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                        <div className={`flex items-baseline gap-1.5 mb-0.5 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
                          <span style={{
                            fontFamily: "'Playfair Display', serif",
                            fontStyle: 'italic',
                            fontSize: '0.55rem',
                            color,
                            letterSpacing: '0.04em',
                          }}>
                            {SENDER_LABELS[msg.sender]}
                          </span>
                          <span style={{ fontSize: '0.4rem', color: 'rgba(255,255,255,0.2)' }}>
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>
                        <div style={{
                          maxWidth: '88%',
                          background: mine ? `${myColor}15` : `${otherColor}0C`,
                          border: `1px solid ${color}22`,
                          overflow: 'hidden',
                        }}>
                          {msg.imageUrl && (
                            <img src={msg.imageUrl} alt=""
                              className="block w-full max-w-[200px]"
                              style={{ display: 'block' }}
                            />
                          )}
                          {msg.content && (
                            <p style={{
                              padding: '7px 11px',
                              color: 'rgba(255,255,255,0.82)',
                              fontSize: '0.8rem',
                              fontFamily: "'Noto Serif KR', serif",
                              lineHeight: 1.65,
                              wordBreak: 'break-word',
                            }}>
                              {msg.content}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <form onSubmit={send} className="flex items-center gap-0" style={{
                borderTop: '1px solid rgba(255,255,255,0.07)',
              }}>
                {/* Image upload */}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  style={{
                    padding: '10px 10px',
                    background: 'transparent', border: 'none',
                    color: uploading ? myColor : 'rgba(255,255,255,0.25)',
                    cursor: 'pointer', fontSize: '0.75rem',
                    transition: 'color 0.2s',
                  }}
                  title="이미지 전송"
                >
                  {uploading ? '…' : '⊕'}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) sendImage(f); e.target.value = '' }}
                />
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={`${chatAs ? SENDER_LABELS[chatAs] : ''} says...`}
                  disabled={sending}
                  style={{
                    flex: 1,
                    background: 'transparent', border: 'none', outline: 'none',
                    padding: '10px 8px',
                    color: 'rgba(255,255,255,0.82)',
                    fontSize: '0.8rem',
                    fontFamily: "'Noto Serif KR', serif",
                    caretColor: myColor,
                  }}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  style={{
                    padding: '10px 14px',
                    background: 'transparent', border: 'none',
                    cursor: input.trim() && !sending ? 'pointer' : 'default',
                    color: input.trim() && !sending ? myColor : 'rgba(255,255,255,0.18)',
                    fontSize: '0.65rem', letterSpacing: '0.12em',
                    fontFamily: "'Pretendard Variable', sans-serif",
                    transition: 'color 0.2s',
                  }}
                >
                  {sending ? '…' : '↵'}
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  )
}

function SelectScreen({ onSelect }: { onSelect: (c: 'manon' | 'dylan') => void }) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <p className="label-caps text-center" style={{
          fontSize: '0.42rem', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.3)',
        }}>
          누구로 입장할까요?
        </p>
      </div>

      {/* Character cards */}
      <div className="flex flex-1 min-h-0">
        {/* KIM MINJAE */}
        <button
          onClick={() => onSelect('manon')}
          className="flex-1 flex flex-col items-center justify-center gap-3 group transition-all duration-300"
          style={{
            background: 'transparent',
            border: 'none',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = `${MANON_COLOR}0A` }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          {/* Portrait circle */}
          <div style={{
            width: '52px', height: '52px',
            borderRadius: '50%',
            border: `1px solid ${MANON_COLOR}50`,
            background: `${MANON_COLOR}10`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontFamily: "'Playfair Display', serif",
              fontStyle: 'italic',
              fontSize: '1.4rem',
              color: MANON_COLOR,
              opacity: 0.7,
            }}>K</span>
          </div>
          <div className="text-center">
            <p className="heading-display" style={{
              fontSize: '1rem', fontStyle: 'italic',
              color: MANON_COLOR, letterSpacing: '-0.01em',
            }}>KIM MINJAE</p>
            <p className="label-caps mt-1" style={{
              fontSize: '0.38rem', letterSpacing: '0.18em',
              color: 'rgba(255,255,255,0.2)',
            }}>클릭하여 입장</p>
          </div>
        </button>

        {/* LEE SUN */}
        <button
          onClick={() => onSelect('dylan')}
          className="flex-1 flex flex-col items-center justify-center gap-3 transition-all duration-300"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = `${DYLAN_COLOR}08` }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <div style={{
            width: '52px', height: '52px',
            borderRadius: '50%',
            border: `1px solid ${DYLAN_COLOR}40`,
            background: `${DYLAN_COLOR}08`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontFamily: "'Playfair Display', serif",
              fontStyle: 'italic',
              fontSize: '1.4rem',
              color: DYLAN_COLOR,
              opacity: 0.7,
            }}>L</span>
          </div>
          <div className="text-center">
            <p className="heading-display" style={{
              fontSize: '1rem', fontStyle: 'italic',
              color: DYLAN_COLOR, letterSpacing: '-0.01em',
            }}>LEE SUN</p>
            <p className="label-caps mt-1" style={{
              fontSize: '0.38rem', letterSpacing: '0.18em',
              color: 'rgba(255,255,255,0.2)',
            }}>클릭하여 입장</p>
          </div>
        </button>
      </div>

      {/* Divider text */}
      <div className="px-4 py-3 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <p style={{
          fontFamily: "'Playfair Display', serif",
          fontStyle: 'italic',
          fontSize: '0.6rem',
          color: 'rgba(255,255,255,0.15)',
          letterSpacing: '0.04em',
        }}>
          Where Eyes Linger
        </p>
      </div>
    </div>
  )
}
