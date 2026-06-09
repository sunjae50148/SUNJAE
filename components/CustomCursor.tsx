'use client'

import { useState, useEffect, useRef } from 'react'

export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [onDark, setOnDark] = useState(false)

  useEffect(() => {
    // Skip on touch devices
    if (typeof window === 'undefined') return
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    if (isTouchDevice) return

    const cursor = cursorRef.current
    if (!cursor) return

    // Walk up DOM tree to find the actual visible background color
    const getEffectiveBg = (el: HTMLElement | null): [number, number, number] | null => {
      let node: HTMLElement | null = el
      while (node) {
        const bg = window.getComputedStyle(node).backgroundColor
        const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/)
        if (match) {
          const alpha = match[4] !== undefined ? parseFloat(match[4]) : 1
          if (alpha > 0.1) {
            return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]
          }
        }
        node = node.parentElement
      }
      return null
    }

    const move = (e: MouseEvent) => {
      cursor.style.left = `${e.clientX}px`
      cursor.style.top = `${e.clientY}px`
      if (!visible) setVisible(true)

      // Check if cursor is over a dark background
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
      if (el) {
        const rgb = getEffectiveBg(el)
        if (rgb) {
          const luminance = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000
          setOnDark(luminance < 128)
        }
      }
    }

    const checkHover = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const isInteractive = target.closest('button, a, [role="button"], input, textarea, select, label[for], .cursor-pointer')
      setHovering(!!isInteractive)
    }

    const hide = () => setVisible(false)
    const show = () => setVisible(true)

    window.addEventListener('mousemove', move)
    window.addEventListener('mouseover', checkHover)
    window.addEventListener('mouseleave', hide)
    window.addEventListener('mouseenter', show)

    // Add cursor-hidden class to html element
    document.documentElement.classList.add('custom-cursor-active')

    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseover', checkHover)
      window.removeEventListener('mouseleave', hide)
      window.removeEventListener('mouseenter', show)
      document.documentElement.classList.remove('custom-cursor-active')
    }
  }, [visible])

  return (
    <div
      ref={cursorRef}
      className="fixed pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2 rounded-full border transition-[width,height,opacity,border-color] duration-150 ease-out"
      style={{
        width: hovering ? '40px' : '24px',
        height: hovering ? '40px' : '24px',
        borderWidth: '1.5px',
        borderColor: hovering
          ? 'rgba(0, 255, 204, 0.7)'
          : (onDark ? 'rgba(0, 255, 204, 0.4)' : 'rgba(0, 255, 204, 0.3)'),
        opacity: visible ? 1 : 0,
        top: 0,
        left: 0,
      }}
    />
  )
}
