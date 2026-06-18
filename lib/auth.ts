import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'

const readServerEnv = (name: string) => process.env[name]?.trim()
const secretKey = readServerEnv(['JWT', 'SECRET'].join('_')) || 'fallback-secret-key'
const key = new TextEncoder().encode(secretKey)

export function hasPasswordConfig(): boolean {
  return Boolean(
    readServerEnv(['ADMIN', 'PASSWORD'].join('_'))
    || readServerEnv(['ADMIN', 'PASSWORD', 'HASH'].join('_'))
  )
}

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(key)
}

export async function decrypt(token: string): Promise<any> {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
    })
    return payload
  } catch (error) {
    return null
  }
}

export async function verifyPassword(password: string): Promise<boolean> {
  const candidate = password.trim()
  const hash = readServerEnv(['ADMIN', 'PASSWORD', 'HASH'].join('_'))
  if (hash) {
    try {
      if (await bcrypt.compare(candidate, hash)) return true
    } catch {
      console.error('Invalid ADMIN_PASSWORD_HASH configuration')
    }
  }

  const plain = readServerEnv(['ADMIN', 'PASSWORD'].join('_'))
  if (plain) return candidate === plain

  console.error('Auth env missing: set ADMIN_PASSWORD or ADMIN_PASSWORD_HASH')
  return false
}

export async function getSession() {
  const cookieStore = cookies()
  const token = cookieStore.get('session')?.value
  if (!token) return null
  return await decrypt(token)
}

export async function isAdmin(): Promise<boolean> {
  const session = await getSession()
  return session?.isAdmin === true
}

// 비밀번호 해시 생성 헬퍼 (초기 설정용)
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}
