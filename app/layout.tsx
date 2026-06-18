import './globals.css'
import type { Metadata } from 'next'
import Sidebar from '@/components/Sidebar'
import CustomCursor from '@/components/CustomCursor'
import SketchyFilter from '@/components/SketchyFilter'
import ChatPopup from '@/components/ChatPopup'

export const metadata: Metadata = {
  title: 'SUNJAE',
  description: 'SUNJAE Archive',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="bg-black text-white min-h-screen">
        <SketchyFilter />
        <CustomCursor />
        <Sidebar />
        <ChatPopup />
        <main className="pt-[44px] min-h-screen">
          {children}
        </main>
      </body>
    </html>
  )
}
