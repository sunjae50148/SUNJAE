import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@/lib/db'

export const dynamic = 'force-dynamic'

const KEEPALIVE_KEY = 'sombre_kv_keepalive'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (process.env.NODE_ENV === 'production' && !cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 500 },
    )
  }

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const touchedAt = new Date().toISOString()
    await kv.set(KEEPALIVE_KEY, {
      touchedAt,
      source: 'vercel-cron',
    })

    return NextResponse.json({ success: true, touchedAt })
  } catch {
    return NextResponse.json({ error: 'Keepalive failed' }, { status: 500 })
  }
}
