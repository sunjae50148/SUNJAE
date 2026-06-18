'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', label: '서장', en: 'Prologue', id: 'PRO' },
  { href: '/character', label: '캐릭터', en: 'Characters', id: 'CHR' },
  { href: '/record', label: '기록', en: 'Records', id: 'REC' },
  { href: '/timeline', label: '연대기', en: 'Timeline', id: 'TML' },
  { href: '/au', label: '세계관', en: 'Universes', id: 'UNI' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const isHome = pathname === '/'
  const current = navItems.find(n => n.href === pathname)

  return (
    <>
      {/* Fixed Top Bar */}
      <nav
        className="fixed top-0 left-0 right-0 h-[44px] flex items-center justify-between px-5 z-50"
        style={{
          background: 'rgba(0,0,0,0.92)',
          borderBottom: '1px solid var(--sf-border, rgba(0,255,204,0.15))',
          fontFamily: "var(--sf-font, 'Courier New', monospace)",
        }}
      >
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <Link href="/"
            className="hover:opacity-70 transition-opacity"
            style={{
              fontSize: '0.75rem',
              color: 'var(--sf-accent, #00FFCC)',
              letterSpacing: '0.2em',
              fontWeight: 700,
            }}>
            SYS://SUNJAE
          </Link>
        </div>

        {/* Center: Navigation */}
        <div className="hidden md:flex items-center gap-6">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href} className="group relative transition-colors">
                <span style={{
                  fontSize: '0.6rem',
                  letterSpacing: '0.15em',
                  color: isActive ? 'var(--sf-accent, #00FFCC)' : 'rgba(255,255,255,0.3)',
                  transition: 'color 0.2s',
                }}>
                  [{item.id}] {item.en.toUpperCase()}
                </span>
                {isActive && (
                  <span className="absolute -bottom-1 left-0 right-0"
                    style={{ height: '1px', background: 'var(--sf-accent, #00FFCC)', opacity: 0.5 }} />
                )}
              </Link>
            )
          })}
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          {current && !isHome && (
            <span style={{
              fontSize: '0.5rem',
              letterSpacing: '0.25em',
              color: 'rgba(255,255,255,0.35)',
            }}>
              {current.label}
            </span>
          )}
        </div>
      </nav>

      {/* Mobile Bottom Nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 h-12 flex items-center justify-around z-50"
        style={{
          background: 'rgba(0,0,0,0.95)',
          borderTop: '1px solid var(--sf-border, rgba(0,255,204,0.15))',
          fontFamily: "var(--sf-font, 'Courier New', monospace)",
        }}
      >
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link key={item.href} href={item.href} className="py-2 px-3 transition-colors"
              style={{
                fontSize: '0.55rem',
                letterSpacing: '0.1em',
                color: isActive ? 'var(--sf-accent, #00FFCC)' : 'rgba(255,255,255,0.3)',
              }}>
              {item.en.toUpperCase()}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
