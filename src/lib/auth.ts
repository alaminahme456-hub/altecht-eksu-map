// Minimal, dependency-free admin session handling.
// A password (ADMIN_PASSWORD env, with a safe default) exchanges for an
// HMAC-signed, httpOnly session cookie. All admin API routes verify it.
import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'

export const SESSION_COOKIE = 'eksu_admin_session'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || 'eksu-admin-2026'
}

function sessionSecret(): string {
  return process.env.SESSION_SECRET || `eksu-map-secret::${adminPassword()}`
}

function sign(payload: string): string {
  return createHmac('sha256', sessionSecret()).update(payload).digest('hex')
}

export function createSessionToken(): string {
  const payload = JSON.stringify({
    role: 'admin',
    exp: Date.now() + SESSION_TTL_MS,
  })
  const body = Buffer.from(payload).toString('base64url')
  return `${body}.${sign(body)}`
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return false
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = sign(body)
  try {
    const a = Buffer.from(sig, 'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as {
      role: string
      exp: number
    }
    return payload.role === 'admin' && Date.now() < payload.exp
  } catch {
    return false
  }
}

export function checkPassword(input: string): boolean {
  const a = Buffer.from(input)
  const b = Buffer.from(adminPassword())
  return a.length === b.length && timingSafeEqual(a, b)
}

// Server-side guard for API routes.
export async function isAdminRequest(): Promise<boolean> {
  const store = await cookies()
  return verifySessionToken(store.get(SESSION_COOKIE)?.value)
}
