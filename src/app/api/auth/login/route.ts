import { NextRequest, NextResponse } from 'next/server'
import { checkPassword, createSessionToken, SESSION_COOKIE } from '@/lib/auth'

export async function POST(req: NextRequest) {
  let password = ''
  try {
    const body = (await req.json()) as { password?: string }
    password = body.password ?? ''
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!checkPassword(password)) {
    return NextResponse.json(
      { error: 'Incorrect administrator password' },
      { status: 401 }
    )
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  })
  return res
}
