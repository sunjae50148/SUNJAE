import { NextRequest, NextResponse } from 'next/server'
import { encrypt, verifyPassword } from '@/lib/auth'
import { cookies } from 'next/headers'

const VALID_USERNAMES = ['manon', 'dylan']

function normalizeUsername(username: unknown) {
  if (typeof username !== 'string') return null
  const key = username.trim().toLowerCase().replace(/_/g, ' ')
  if (key === 'manon' || key === 'kim minjae') return 'manon'
  if (key === 'dylan' || key === 'lee sun') return 'dylan'
  return null
}

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()
    const normalizedUsername = normalizeUsername(username)
    const hasPasswordConfig = Boolean(
      process.env.ADMIN_PASSWORD?.trim() || process.env.ADMIN_PASSWORD_HASH?.trim()
    )

    if (!normalizedUsername || !VALID_USERNAMES.includes(normalizedUsername)) {
      return NextResponse.json(
        { error: '유효하지 않은 사용자입니다.', code: 'INVALID_USERNAME' },
        { status: 400 }
      )
    }

    if (!password) {
      return NextResponse.json(
        { error: '비밀번호를 입력해주세요.', code: 'MISSING_PASSWORD' },
        { status: 400 }
      )
    }

    if (!hasPasswordConfig) {
      return NextResponse.json(
        { error: '서버에 ADMIN_PASSWORD가 설정되지 않았습니다.', code: 'AUTH_ENV_MISSING' },
        { status: 500 }
      )
    }

    const isValid = await verifyPassword(password)

    if (!isValid) {
      return NextResponse.json(
        { error: '비밀번호가 올바르지 않습니다.', code: 'INVALID_PASSWORD' },
        { status: 401 }
      )
    }

    const token = await encrypt({ isAdmin: true, username: normalizedUsername })

    cookies().set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
    })

    return NextResponse.json({ success: true, username: normalizedUsername })
  } catch (error) {
    console.error('Auth error:', error)
    return NextResponse.json(
      { error: '인증 처리 중 오류가 발생했습니다.', code: 'AUTH_ERROR' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  cookies().delete('session')
  return NextResponse.json({ success: true })
}
